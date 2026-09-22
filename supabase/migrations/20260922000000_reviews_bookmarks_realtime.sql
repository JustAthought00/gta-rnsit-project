-- Reviews/bookmarks notifications were wired up in the frontend (NotificationCenter
-- subscribes to postgres_changes on these tables) but the tables were never added to
-- the supabase_realtime publication, so no INSERT events were ever delivered.
-- Add them idempotently.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bookmarks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;
  END IF;
END $$;