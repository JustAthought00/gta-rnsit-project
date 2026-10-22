-- GTA audit fixes — round 2 (2026-10-22)
-- Verified against the live project ylliuejawkswxnzfyiym before writing.
--
-- 1) A7 — a rejected join request permanently blocked re-joining.
--    The table still carried a hard UNIQUE(community_id, user_id), so the
--    "Request Again" INSERT failed with 23505 (duplicate key) no matter what
--    the relaxed RLS policy allowed. Replace the hard unique with partial
--    unique indexes (one pending row and one accepted row per pair) and add a
--    BEFORE INSERT trigger that clears the stale 'rejected' row so a fresh
--    'pending' request can be made.
--
-- 2) Regression introduced by the C7 RLS tightening — community_members is no
--    longer world-readable, so the client could no longer derive "N members"
--    for communities the viewer does not belong to; every card showed
--    "0 members". Publish aggregate counts through a SECURITY DEFINER
--    function (counts only, no identities) so the public card shows a real
--    number again without re-opening the moderation data.
--
-- 3) connections.status still allowed the legacy 'declined' value, which is
--    what let two UIs diverge in the first place. Normalize and tighten the
--    CHECK so the divergent decline path cannot come back.

-- ------------------------------------------------------------------
-- 1) Re-requesting after a rejection
-- ------------------------------------------------------------------

-- Deduplicate before relaxing the unique index: keep the most advanced row per
-- pair (accepted > pending > rejected), newest wins within a status.
with ranked as (
  select id,
         row_number() over (
           partition by community_id, user_id
           order by
             case status
               when 'accepted' then 3
               when 'pending'  then 2
               else 1
             end desc,
             joined_at desc
         ) as rn
  from public.community_members
)
delete from public.community_members cm
using ranked r
where cm.id = r.id
  and r.rn > 1;

-- The hard unique is backed by a table CONSTRAINT (which owns the index), so
-- the constraint has to go first -- Postgres refuses to drop an index that a
-- constraint depends on. The bare drop index is kept for databases where it
-- was created as a standalone index.
alter table public.community_members
  drop constraint if exists community_members_community_id_user_id_key;
drop index if exists public.community_members_community_id_user_id_key;
drop index if exists public.community_members_community_id_user_id;

-- One pending request and one accepted membership per (community, user).
-- A 'rejected' row may coexist with a new request, which is what makes
-- "Request Again" possible at all.
create unique index if not exists community_members_one_pending_per_pair
  on public.community_members (community_id, user_id)
  where status = 'pending';

create unique index if not exists community_members_one_accepted_per_pair
  on public.community_members (community_id, user_id)
  where status = 'accepted';

create or replace function public.community_members_clear_stale_rejection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A pair keeps ONE membership row. Re-requesting after a rejection must
  -- reuse that slot instead of colliding with the stale 'rejected' row.
  --
  -- The stale row is DELETED rather than flipped to 'pending' on purpose:
  -- Postgres evaluates a row's RLS INSERT WITH CHECK *after* BEFORE INSERT
  -- triggers have run, and that policy rejects an insert when another
  -- 'pending' row already exists for the pair. Flipping first would make the
  -- request fail its own WITH CHECK. Deleting leaves the pair with no
  -- pending row, so the new request passes cleanly.
  delete from public.community_members cm
  where cm.community_id = new.community_id
    and cm.user_id = new.user_id
    and cm.status = 'rejected';

  return new;
end;
$$;

comment on function public.community_members_clear_stale_rejection()
  is 'BEFORE INSERT trigger: removes a stale ''rejected'' membership row for the same (community, user) so the pair can hold a fresh ''pending'' request.';

revoke all on function public.community_members_clear_stale_rejection() from public;
grant execute on function public.community_members_clear_stale_rejection() to authenticated;

drop trigger if exists community_members_clear_stale_rejection on public.community_members;
create trigger community_members_clear_stale_rejection
  before insert on public.community_members
  for each row execute function public.community_members_clear_stale_rejection();

-- ------------------------------------------------------------------
-- 2) Public accepted-member counts
-- ------------------------------------------------------------------

create or replace function public.community_member_counts()
returns table (community_id uuid, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select cm.community_id, count(*)::bigint
  from public.community_members cm
  where cm.status = 'accepted'
  group by cm.community_id;
$$;

comment on function public.community_member_counts()
  is 'Accepted-member count per community. SECURITY DEFINER because community_members rows are private to members/leads; exposes counts only, never identities.';

revoke all on function public.community_member_counts() from public;
grant execute on function public.community_member_counts() to anon, authenticated;

-- ------------------------------------------------------------------
-- 3) connections.status: drop the legacy 'declined' value
-- ------------------------------------------------------------------

update public.connections set status = 'rejected' where status = 'declined';

alter table public.connections drop constraint if exists connections_status_check;
alter table public.connections
  add constraint connections_status_check
  check (status in ('pending', 'accepted', 'rejected'));
