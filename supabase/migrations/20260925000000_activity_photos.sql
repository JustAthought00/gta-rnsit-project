-- Activity/event photos: organizers can attach a cover photo shown on event cards.
alter table public.activities
  add column if not exists photo_url text;

comment on column public.activities.photo_url is 'Optional cover photo uploaded by the organizer';

-- Storage: create a public bucket for activity photos
insert into storage.buckets (id, name, public)
values ('activity-photos', 'activity-photos', true)
on conflict (id) do nothing;

-- Policies mirror the avatars/banners buckets: anyone can view, organizers manage their own
create policy "Anyone can view activity photos"
  on storage.objects for select
  using (bucket_id = 'activity-photos');

create policy "Users can upload own activity photos"
  on storage.objects for insert
  with check (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own activity photos"
  on storage.objects for update
  using (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own activity photos"
  on storage.objects for delete
  using (bucket_id = 'activity-photos' AND auth.uid()::text = (storage.foldername(name))[1]);