-- skill_requests was the only request-type table missing from the realtime
-- publication: owners never found out about incoming skill requests without
-- revisiting the skill page, and requesters stayed on "Request pending" until a
-- manual reload. Add it so the UI can subscribe to live request events.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'skill_requests') then
    alter publication supabase_realtime add table public.skill_requests;
  end if;
end $$;
