-- Profile banners: optional wide cover image on each student's public profile.
alter table public.profiles
  add column if not exists banner_url text;

comment on column public.profiles.banner_url is 'Optional cover/banner image URL for the user profile header';

-- Storage: create a public banners bucket for cover images
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

-- Policies mirror the avatars bucket: anyone can view, owners manage their own
create policy "Anyone can view banners"
  on storage.objects for select
  using (bucket_id = 'banners');

create policy "Users can upload own banner"
  on storage.objects for insert
  with check (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own banner"
  on storage.objects for update
  using (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own banner"
  on storage.objects for delete
  using (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);