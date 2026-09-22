-- Connection requests between users power the direct messaging feature:
-- sender requests a chat, receiver accepts/declines. This table was referenced
-- by the frontend but had no migration, so it never existed in the database.

create table if not exists public.connections (
  id uuid not null default gen_random_uuid() primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'rejected')),
  created_at timestamp with time zone not null default now()
);

comment on table public.connections is 'Chat connections: a request from sender to receiver, accepted/declined by the receiver.';
comment on column public.connections.status is 'Request lifecycle: pending -> accepted | declined | rejected.';

alter table public.connections enable row level security;

drop policy if exists "Users can view own connections" on public.connections;
create policy "Users can view own connections" on public.connections
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send connection requests" on public.connections;
create policy "Users can send connection requests" on public.connections
  for insert with check (auth.uid() = sender_id);

drop policy if exists "Users can respond to connection requests" on public.connections;
create policy "Users can respond to connection requests" on public.connections
  for update using (auth.uid() = sender_id or auth.uid() = receiver_id);

create index if not exists connections_sender_idx on public.connections (sender_id);
create index if not exists connections_receiver_idx on public.connections (receiver_id);