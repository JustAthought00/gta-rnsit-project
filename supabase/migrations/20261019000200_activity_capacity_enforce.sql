-- max_participants was only enforced in UI state, so two students joining at
-- the same moment could overbook an event. Enforce capacity in the database.

create or replace function public.enforce_activity_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_count integer;
begin
  -- Lock the activity row so concurrent joins serialize on it instead of
  -- both reading the same pre-insert count.
  select max_participants into v_max
  from public.activities
  where id = new.activity_id
  for update;

  if v_max is not null then
    select count(*) into v_count
    from public.activity_participants
    where activity_id = new.activity_id;

    if v_count >= v_max then
      raise exception 'Activity is full';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_activity_capacity on public.activity_participants;

create trigger enforce_activity_capacity
  before insert on public.activity_participants
  for each row execute function public.enforce_activity_capacity();
