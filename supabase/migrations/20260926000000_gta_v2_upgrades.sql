-- ============================================================
-- GTA V2: project collaborators, teachers, community leadership
-- + join approvals, activity deadlines & event approval.
-- All statements are idempotent so this file can be re-run safely.
-- ============================================================

-- ------------------------------------------------------------
-- 1) profiles.role: "student" or "teacher"
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'student';

comment on column public.profiles.role is 'Account kind: "student" or "teacher". Teachers get moderation privileges.';

-- ------------------------------------------------------------
-- 2) activities: registration deadline + approval status
--    - existing rows default to "approved" so nothing disappears
--    - once deadline passes the event is hidden from listings
-- ------------------------------------------------------------
alter table public.activities
  add column if not exists deadline timestamp with time zone,
  add column if not exists approval_status text not null default 'approved';

comment on column public.activities.deadline is 'Registration deadline. Events are hidden once it passes.';
comment on column public.activities.approval_status is 'Moderation state: "pending", "approved" or "rejected". Teachers review pending events.';

-- Teachers may approve (moderate) or delete ANY event.
drop policy if exists "Users can update own activities" on public.activities;
drop policy if exists "Users can delete own activities" on public.activities;
-- Students may only submit events as "pending" so the approval flow can't be
-- bypassed by inserting with approval_status = 'approved'.
drop policy if exists "Users can insert own activities" on public.activities;
create policy "Users can insert own activities" on public.activities
  for insert with check (
    auth.uid() = user_id
    and (
      approval_status = 'pending'
      or exists (
        select 1 from public.profiles
        where user_id = auth.uid() and role = 'teacher'
      )
    )
  );

create policy "Users can update own activities (or teachers moderate)" on public.activities
  for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'teacher'
    )
  );

create policy "Users can delete own activities (or teachers moderate)" on public.activities
  for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'teacher'
    )
  );

-- ------------------------------------------------------------
-- 3) project_collaborators: invite teammates from the DB,
--    they accept/decline, and the project then shows on their profile.
-- ------------------------------------------------------------
create table if not exists public.project_collaborators (
  id uuid not null default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  skill text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone not null default now(),
  responded_at timestamp with time zone,
  constraint project_collaborators_unique_pair unique (project_id, user_id)
);

comment on table public.project_collaborators is 'People invited to collaborate on a project.';
comment on column public.project_collaborators.skill is 'Optional contribution/area the collaborator will work on.';
comment on column public.project_collaborators.status is 'Invite lifecycle: pending -> accepted | declined.';

alter table public.project_collaborators enable row level security;

drop policy if exists "Participants can read collaborator invites" on public.project_collaborators;
drop policy if exists "Inviter sends collaborator invites" on public.project_collaborators;
drop policy if exists "Invitee responds to collaborator invites" on public.project_collaborators;
drop policy if exists "Project owner removes collaborators" on public.project_collaborators;

create policy "Participants can read collaborator invites" on public.project_collaborators
  for select using (
    auth.uid() = user_id
    or auth.uid() = inviter_id
    or auth.uid() = (select user_id from public.projects where id = project_id)
  );

create policy "Inviter sends collaborator invites" on public.project_collaborators
  for insert with check (
    auth.uid() = inviter_id
    and exists (
      select 1 from public.projects
      where id = project_id and user_id = auth.uid()
    )
    and auth.uid() <> user_id
  );

create policy "Invitee responds to collaborator invites" on public.project_collaborators
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Project owner removes collaborators" on public.project_collaborators
  for delete using (
    auth.uid() = (select user_id from public.projects where id = project_id)
    or auth.uid() = user_id
  );

create index if not exists project_collaborators_project_idx on public.project_collaborators (project_id);
create index if not exists project_collaborators_user_idx on public.project_collaborators (user_id);

-- ------------------------------------------------------------
-- 4) teachers: faculty directory entries (experience based on
--    resume, expertise, cabin location, official email).
-- ------------------------------------------------------------
create table if not exists public.teachers (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  department text,
  designation text,
  experience text,
  expertise text,
  cabin_location text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

comment on table public.teachers is 'Faculty directory. Only profiles with role = teacher may create an entry.';

alter table public.teachers enable row level security;

drop policy if exists "Anyone can view teachers" on public.teachers;
drop policy if exists "Teachers create own directory entry" on public.teachers;
drop policy if exists "Teachers update own directory entry" on public.teachers;
drop policy if exists "Teachers delete own directory entry" on public.teachers;

create policy "Anyone can view teachers" on public.teachers
  for select using (true);

create policy "Teachers create own directory entry" on public.teachers
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'teacher'
    )
  );

create policy "Teachers update own directory entry" on public.teachers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Teachers delete own directory entry" on public.teachers
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5) communities: faculty lead + student president / vice president
-- ------------------------------------------------------------
alter table public.communities
  add column if not exists leader_id uuid references auth.users(id),
  add column if not exists president_id uuid references auth.users(id),
  add column if not exists vice_president_id uuid references auth.users(id);

comment on column public.communities.leader_id is 'Faculty (teacher) who leads this community.';
comment on column public.communities.president_id is 'Student president of the community.';
comment on column public.communities.vice_president_id is 'Student vice president of the community.';

-- Leadership may edit the community (assign roles, update description...)
drop policy if exists "Leadership can update communities" on public.communities;
create policy "Leadership can update communities" on public.communities
  for update using (
    auth.uid() = created_by
    or auth.uid() = leader_id
    or auth.uid() = president_id
    or auth.uid() = vice_president_id
  );

-- ------------------------------------------------------------
-- 6) community_members: join requests must be approved by leadership.
--    Existing rows keep status "accepted" so nothing breaks.
-- ------------------------------------------------------------
alter table public.community_members
  add column if not exists status text not null default 'accepted';

comment on column public.community_members.status is 'Membership lifecycle: "pending" (awaiting approval), "accepted" or "rejected".';

create index if not exists community_members_community_idx on public.community_members (community_id);
create index if not exists community_members_user_idx on public.community_members (user_id);

-- Anyone can request to join (insert a pending membership)...
-- The legacy permissive "Users can join communities" policy is dropped first so
-- users can't self-approve by inserting with status = 'accepted'.
drop policy if exists "Users can join communities" on public.community_members;
drop policy if exists "Users can request community membership" on public.community_members;
create policy "Users can request community membership" on public.community_members
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and not exists (
      select 1 from public.community_members existing
      where existing.community_id = community_members.community_id and existing.user_id = auth.uid()
    )
  );

-- The community creator auto-joins as an accepted member at creation time.
create policy "Community creator joins automatically" on public.community_members
  for insert with check (
    auth.uid() = user_id
    and status = 'accepted'
    and exists (
      select 1 from public.communities c
      where c.id = community_members.community_id and c.created_by = auth.uid()
    )
  );

-- ...members can leave...
drop policy if exists "Users can leave communities" on public.community_members;
drop policy if exists "Members can leave communities" on public.community_members;
create policy "Members can leave communities" on public.community_members
  for delete using (auth.uid() = user_id);

-- ...and leadership (including the creator) approves/rejects those requests.
drop policy if exists "Leadership can moderate community membership" on public.community_members;
create policy "Leadership can moderate community membership" on public.community_members
  for update using (
    auth.uid() = (select created_by from public.communities where id = community_id)
    or auth.uid() = (select leader_id from public.communities where id = community_id)
    or auth.uid() = (select president_id from public.communities where id = community_id)
    or auth.uid() = (select vice_president_id from public.communities where id = community_id)
  );

-- Members who are still pending should not be able to read/reply in the
-- community chats. Drop the original permissive policies too (they were named
-- differently, so they'd otherwise still allow pending members in).
drop policy if exists "Community members can view messages" on public.community_messages;
drop policy if exists "Community members can send messages" on public.community_messages;
drop policy if exists "Members can read community messages" on public.community_messages;
drop policy if exists "Members can post community messages" on public.community_messages;

create policy "Accepted members can read community messages" on public.community_messages
  for select using (exists (
    select 1 from public.community_members cm
    where cm.community_id = community_messages.community_id
      and cm.user_id = auth.uid() and cm.status = 'accepted'
  ));

create policy "Accepted members can post community messages" on public.community_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.community_members cm
      where cm.community_id = community_messages.community_id
        and cm.user_id = auth.uid() and cm.status = 'accepted'
    )
  );

-- ------------------------------------------------------------
-- 7) realtime subscriptions for the notification sources
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'connections') then
    alter publication supabase_realtime add table public.connections;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_collaborators') then
    alter publication supabase_realtime add table public.project_collaborators;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_members') then
    alter publication supabase_realtime add table public.community_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'communities') then
    alter publication supabase_realtime add table public.communities;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teachers') then
    alter publication supabase_realtime add table public.teachers;
  end if;
end $$;