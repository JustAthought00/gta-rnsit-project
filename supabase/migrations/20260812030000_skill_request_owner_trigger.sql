-- The INSERT policy only checks auth.uid() = requester_id, so a client could send
-- any owner_id, not necessarily the skill's real owner. Derive it server-side instead
-- of trusting the payload — this also makes the requester<>owner CHECK constraint
-- authoritative rather than trivially bypassable.

CREATE OR REPLACE FUNCTION public.set_skill_request_owner()
RETURNS TRIGGER AS $$
BEGIN
  SELECT user_id INTO NEW.owner_id FROM public.skills WHERE id = NEW.skill_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_skill_request_owner_trigger
  BEFORE INSERT ON public.skill_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_skill_request_owner();
