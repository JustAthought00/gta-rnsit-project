-- GTA audit fixes — round 2, part 3 (2026-10-22)
--
-- Schema drift: `profiles.github_url`, `profiles.linkedin_url` and
-- `profiles.portfolio_url` exist in the live database (they were added through
-- the SQL editor) but appear in NO migration file, even though they are
-- declared in src/integrations/supabase/types.ts and rendered by
-- UserProfile.tsx.
--
-- Replaying this repo's migrations onto an empty database -- which is what
-- `supabase db reset` does -- would therefore produce a database WITHOUT these
-- three columns, and every profile query that selects them would fail.
--
-- `add column if not exists` makes this safe in both directions: a no-op
-- against the live project (the columns are already present) and the missing
-- piece on a fresh rebuild.
--
-- The live column types were checked against information_schema before this
-- migration was written:
--   github_url   text
--   linkedin_url text
--   portfolio_url text

alter table public.profiles
  add column if not exists github_url text,
  add column if not exists linkedin_url text,
  add column if not exists portfolio_url text;

comment on column public.profiles.github_url is 'Optional GitHub profile URL shown on the public profile card.';
comment on column public.profiles.linkedin_url is 'Optional LinkedIn profile URL shown on the public profile card.';
comment on column public.profiles.portfolio_url is 'Optional personal portfolio URL shown on the public profile card.';
