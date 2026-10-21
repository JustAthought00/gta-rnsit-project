-- Fix: "infinite recursion detected in policy for relation community_members"
--
-- The policy added in 20261019000400 lets an accepted member of a community read
-- that community's membership rows. It does that with a subquery against
-- public.community_members -- the very table the policy is attached to. Postgres
-- evaluates the policy for every row the subquery touches, which re-enters the
-- policy, which evaluates the subquery again -> infinite recursion (42P17).
--
-- Symptom: every read of public.community_members and public.community_messages
-- fails with 42P17, so the Communities tab, group chat, join requests and the
-- teacher dashboard's member list are all dead.
--
-- Fix: move the "is this user an accepted member of this community?" lookup into
-- a SECURITY DEFINER function. Functions owned by a role that bypasses RLS are
-- not subject to the calling user's policies, so the recursion disappears.

create or replace function public.is_accepted_member(
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
      and m.status = 'accepted'
  );
$$;

comment on function public.is_accepted_member(uuid, uuid)
  is 'True when the user is an accepted member of the community. SECURITY DEFINER so the membership check does not re-enter the community_members RLS policy.';

revoke all on function public.is_accepted_member(uuid, uuid) from public;
grant execute on function public.is_accepted_member(uuid, uuid) to anon, authenticated;

drop policy if exists "Members and leads can view community memberships" on public.community_members;

create policy "Members and leads can view community memberships" on public.community_members
  for select using (
    auth.uid() = user_id
    or public.is_accepted_member(community_members.community_id, auth.uid())
    or exists (
      select 1 from public.communities c
      where c.id = community_members.community_id
        and (c.created_by = auth.uid()
             or c.leader_id = auth.uid()
             or c.president_id = auth.uid()
             or c.vice_president_id = auth.uid())
    )
  );

-- The community_messages policies also read community_members. They are safe
-- today (different table, no self-reference) but they re-check membership on
-- every message row; routing them through the same helper keeps the logic in
-- one place and removes a repeated per-row policy evaluation.
drop policy if exists "Accepted members can read community messages" on public.community_messages;
create policy "Accepted members can read community messages" on public.community_messages
  for select using (
    public.is_accepted_member(community_messages.community_id, auth.uid())
  );

drop policy if exists "Accepted members can post community messages" on public.community_messages;
create policy "Accepted members can post community messages" on public.community_messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_accepted_member(community_messages.community_id, auth.uid())
  );
