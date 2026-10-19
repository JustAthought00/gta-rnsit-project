-- Fix: accepted collaborations were invisible to everyone except the directly
-- involved users (inviter, invitee, project owner) because the SELECT policy on
-- project_collaborators was participant-only. The V2 design intent is that an
-- accepted collaboration shows up on the collaborator's public profile and on
-- the project's page for any visitor — but pending invites must stay private.
--
-- New rule:
--   * participants (invitee / inviter / project owner) can see every row
--   * anyone else can only see rows with status = 'accepted'

drop policy if exists "Participants can read collaborator invites" on public.project_collaborators;

create policy "Accepted collaborations are public, invites visible to participants"
  on public.project_collaborators
  for select using (
    status = 'accepted'
    or auth.uid() = user_id
    or auth.uid() = inviter_id
    or auth.uid() = (select user_id from public.projects where id = project_id)
  );
