-- Reviews/bookmarks reference skills/activities via a polymorphic (target_type, target_id)
-- pair with no foreign key, so deleting a skill/activity previously left orphaned rows
-- behind (and RLS blocks the owner from cleaning up other users' review/bookmark rows
-- directly). This trigger runs as SECURITY DEFINER to bypass RLS and remove them.

CREATE OR REPLACE FUNCTION public.cleanup_target_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.reviews WHERE target_id = OLD.id AND target_type = TG_ARGV[0];
  DELETE FROM public.bookmarks WHERE target_id = OLD.id AND target_type = TG_ARGV[0];
  RETURN OLD;
END;
$$;

CREATE TRIGGER cleanup_skill_references
  BEFORE DELETE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_target_references('skill');

CREATE TRIGGER cleanup_activity_references
  BEFORE DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_target_references('activity');
