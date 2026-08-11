-- Create messages table for direct messaging
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create communities table
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  skill_id UUID,
  activity_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create community_members junction table
CREATE TABLE IF NOT EXISTS public.community_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- Create community_messages table
CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- RLS for messages - users can see messages they sent or received
CREATE POLICY "Users can view their own messages" ON public.messages
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark messages as read" ON public.messages
FOR UPDATE USING (auth.uid() = receiver_id);

-- RLS for communities - anyone can view
CREATE POLICY "Anyone can view communities" ON public.communities
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create communities" ON public.communities
FOR INSERT WITH CHECK (auth.uid() = created_by);

-- RLS for community_members
CREATE POLICY "Anyone can view community members" ON public.community_members
FOR SELECT USING (true);

CREATE POLICY "Users can join communities" ON public.community_members
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave communities" ON public.community_members
FOR DELETE USING (auth.uid() = user_id);

-- RLS for community_messages
CREATE POLICY "Community members can view messages" ON public.community_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.community_members 
    WHERE community_id = community_messages.community_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Community members can send messages" ON public.community_messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.community_members 
    WHERE community_id = community_messages.community_id 
    AND user_id = auth.uid()
  )
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;