-- Activities displayed a "max participants" count with no way to actually join one.
-- This table backs a real Join/Leave (RSVP) flow.

CREATE TABLE public.activity_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view participants" ON public.activity_participants FOR SELECT USING (true);
CREATE POLICY "Users can join activities" ON public.activity_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave activities" ON public.activity_participants FOR DELETE USING (auth.uid() = user_id);
