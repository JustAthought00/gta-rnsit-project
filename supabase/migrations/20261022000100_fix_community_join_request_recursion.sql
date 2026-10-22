-- GTA audit fixes — round 2, part 2 (2026-10-22)
--
-- CRITICAL: the "Users can request community membership" policy read its own
-- table:
--
--   ... and not exists (
--     select 1 from public.community_members existing
--     where existing.community_id = community_members.community_id ...
--   )
--
-- Postgres refuses to evaluate a policy that references the table it guards:
-- every INSERT raised
--
--   42P17  infinite recursion detected in policy for relation "community_members"
--
-- so NO user could ever request to join a community. The seeded membership
-- rows were written with the service-role key, which bypasses RLS, so the demo
-- data looked perfectly healthy while the real join flow was completely dead.
--
-- The same self-referencing subquery was introduced twice:
--   20260926000000_gta_v2_upgrades.sql          (original definition)
--   20261019000400_community_membership_and_leadership.sql  (re-created)
--
-- Fix: express the check through a SECURITY DEFINER helper. The function owner
-- bypasses RLS, so reading community_members inside it does not re-enter the
-- policy -- the same trick the "Members and leads can view community
-- memberships" SELECT policy already uses via is_accepted_member().

create or replace function public.has_membership_request(
  p_community_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_members m
    where m.community_id = p_community_id
      and m.user_id = p_user_id
      and m.status in ('pending', 'accepted')
  );
$$;

comment on function public.has_membership_request(uuid, uuid)
  is 'True when the user already has a pending request or an accepted membership in the community. SECURITY DEFINER so the RLS policy that calls it does not recurse into community_members.';

revoke all on function public.has_membership_request(uuid, uuid) from public;
grant execute on function public.has_membership_request(uuid, uuid) to anon, authenticated;

drop policy if exists "Users can request community membership" on public.community_members;

create policy "Users can request community membership" on public.community_members
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and not public.has_membership_request(community_id, auth.uid())
  );

-- The BEFORE INSERT trigger (20261022000000_gta_audit_fixes.sql) removes a
-- stale 'rejected' row before this policy is evaluated, so a rejected user can
-- request again: the pair ends up with no pending row and the check passes.
--
-- Verified with a full audit of pg_policies: this was the only self-referencing
-- policy left in the database. Every other policy reads at most one OTHER
-- table, which Postgres allows.
