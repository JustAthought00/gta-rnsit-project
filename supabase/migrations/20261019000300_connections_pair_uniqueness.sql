-- A DM pair must map to exactly ONE connections row. Duplicate rows (double
-- clicks, two users requesting each other) made every `.maybeSingle()` lookup
-- error, which the client read as "no connection" — permanently bricking
-- messaging between that pair while each retry inserted yet another row.
--
-- Also: 'declined' and 'rejected' mean the same thing but two UI paths wrote
-- different values, and downstream code only understood one of them. Normalize
-- to 'rejected' (the documented value). A rejected request can be re-sent: the
-- sender's start-conversation flow resets the row back to 'pending', which the
-- existing UPDATE policy already permits.

-- 1) Normalize the divergent decline value.
update public.connections set status = 'rejected' where status = 'declined';

-- 2) Dedupe user pairs, preferring an accepted row, then the earliest.
delete from public.connections a
using public.connections b
where least(a.sender_id, a.receiver_id) = least(b.sender_id, b.receiver_id)
  and greatest(a.sender_id, a.receiver_id) = greatest(b.sender_id, b.receiver_id)
  and a.id <> b.id
  and (
    (case when a.status = 'accepted' then 0 else 1 end, a.created_at, a.id)
    > (case when b.status = 'accepted' then 0 else 1 end, b.created_at, b.id)
  );

-- 3) Constraints: one row per unordered pair, no self-connections.
alter table public.connections
  add constraint connections_no_self_pair check (sender_id <> receiver_id);

create unique index if not exists connections_one_per_pair
  on public.connections (least(sender_id, receiver_id), greatest(sender_id, receiver_id));
