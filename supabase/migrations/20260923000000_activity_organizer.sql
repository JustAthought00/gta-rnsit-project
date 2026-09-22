-- Activities/events are hosted by clubs & groups; add organizer info.
alter table public.activities
  add column organizer_type text not null default 'individual',
  add column group_name text;

comment on column public.activities.organizer_type is 'Who is hosting: "individual" or "group" (club/team)';
comment on column public.activities.group_name is 'Club/group name when organizer_type = group';