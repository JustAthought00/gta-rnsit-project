-- One review per user per target. The UI already tries to guard duplicates
-- ("already reviewed" error handling in ActivityDetail), but without a DB
-- constraint double-submits/races insert multiple reviews and skew ratings.

-- 1) Remove existing duplicates, keeping the earliest review.
delete from public.reviews a
using public.reviews b
where a.user_id = b.user_id
  and a.target_type = b.target_type
  and a.target_id = b.target_id
  and (a.created_at > b.created_at
       or (a.created_at = b.created_at and a.ctid > b.ctid));

-- 2) Enforce uniqueness in the database.
create unique index if not exists reviews_one_per_user_target
  on public.reviews (user_id, target_type, target_id);
