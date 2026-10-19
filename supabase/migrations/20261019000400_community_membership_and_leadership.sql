-- Community membership fixes:
--   1) A declined request permanently blocked re-joining: the INSERT policy
--      rejected any insert when a row of ANY status existed, and the decline
--      row was never removed. Only a duplicate *pending* request should block.
--   2) Two UIs wrote different decline values ('declined' vs the documented
--      'rejected'); normalize.
--   3) Pending join requests were world-readable (SELECT USING (true)) — anyone,
--      even signed out, could enumerate who requested to join which community.
--      Restrict to the requester, accepted members, and community leadership.
--   4) The communities UPDATE policy had no WITH CHECK, so a president whose
--      ONLY qualifying role was president could never hand the presidency to
--      someone else (the new row no longer matched USING and Postgres rejects
--      it). Leadership handover must be allowed.

-- 1) Normalize the divergent decline value.
update public.community_members set status = 'rejected' where status = 'declined';

-- 2) Re-requestable after a decline.
drop policy if exists "Users can request community membership" on public.community_members;
create policy "Users can request community membership" on public.community_members
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and not exists (
      select 1 from public.community_members existing
      where existing.community_id = community_members.community_id
        and existing.user_id = auth.uid()
        and existing.status = 'pending'
    )
  );

-- 3) Membership rows are moderation data: visible to the requester, accepted
--    members of the same community, and its leadership.
drop policy if exists "Anyone can view community members" on public.community_members;
create policy "Members and leads can view community memberships" on public.community_members
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.community_members m
      where m.community_id = community_members.community_id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
    or exists (
      select 1 from public.communities c
      where c.id = community_members.community_id
        and (c.created_by = auth.uid()
             or c.leader_id = auth.uid()
             or c.president_id = auth.uid()
             or c.vice_president_id = auth.uid())
    )
  );

-- 4) Leadership handover: USING gates *who* may update (current leadership);
--    WITH CHECK must not re-apply that gate to the NEW row, or handing over
--    the very role you qualify through would fail.
drop policy if exists "Leadership can update communities" on public.communities;
create policy "Leadership can update communities" on public.communities
  for update
  using (
    auth.uid() = created_by
    or auth.uid() = leader_id
    or auth.uid() = president_id
    or auth.uid() = vice_president_id
  )
  with check (true);
