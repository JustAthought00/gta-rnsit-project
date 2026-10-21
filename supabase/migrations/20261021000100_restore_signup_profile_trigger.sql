-- Fix: the `on_auth_user_created` trigger was missing on the live database.
--
-- `public.handle_new_user()` exists, but the trigger that wires it to
-- `auth.users` was never created on the provisioned instance. Consequence:
-- a brand-new signup creates an `auth.users` row but NO `public.profiles`
-- row, and the frontend has no insert fallback — `EditProfile.handleSaveProfile`
-- only issues an UPDATE, which matches 0 rows and silently does nothing.
-- The result is a brand-new user whose profile is permanently blank and who
-- cannot be shown on /people, /skills or /activities.
--
-- This matters at an open house: any judge or visitor who signs up on the spot
-- lands in a broken account.
--
-- Recreate the function defensively and attach the trigger if it is missing.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, department, academic_year)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    coalesce(NEW.raw_user_meta_data ->> 'department', ''),
    coalesce(NEW.raw_user_meta_data ->> 'academic_year', '')
  )
  on conflict (user_id) do update
    set full_name      = excluded.full_name,
        email          = excluded.email,
        department     = coalesce(nullif(excluded.department, ''), public.profiles.department),
        academic_year  = coalesce(nullif(excluded.academic_year, ''), public.profiles.academic_year),
        updated_at     = now();
  return NEW;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any auth user that never got a profile row (created while the
-- trigger was missing) gets one now.
insert into public.profiles (user_id, full_name, email, department, academic_year)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  u.email,
  coalesce(u.raw_user_meta_data ->> 'department', ''),
  coalesce(u.raw_user_meta_data ->> 'academic_year', '')
from auth.users u
on conflict (user_id) do nothing;
