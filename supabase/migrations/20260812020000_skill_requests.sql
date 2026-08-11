-- Skill requests were just freeform DMs with no record of whether a request
-- was ever confirmed. This gives both sides a structured pending/accepted/declined status.

CREATE TABLE public.skill_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (requester_id <> owner_id)
);

-- Only one open (pending) request per requester per skill at a time
CREATE UNIQUE INDEX skill_requests_one_pending_per_requester
  ON public.skill_requests (skill_id, requester_id)
  WHERE (status = 'pending');

ALTER TABLE public.skill_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester or owner can view their requests" ON public.skill_requests
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "Users can create requests for skills they don't own" ON public.skill_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Owner can update request status" ON public.skill_requests
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Requester can cancel own pending request" ON public.skill_requests
  FOR DELETE USING (auth.uid() = requester_id);

-- Recreated defensively: this function was referenced by the original schema
-- migration's triggers but doesn't actually exist on the live database (it was
-- provisioned outside the CLI), which would otherwise break this trigger too.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_skill_requests_updated_at BEFORE UPDATE ON public.skill_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
