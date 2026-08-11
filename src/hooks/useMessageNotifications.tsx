import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseMessageNotificationsProps {
  userId: string | null;
  enabled?: boolean;
}

export const useMessageNotifications = ({ userId, enabled = true }: UseMessageNotificationsProps) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId || !enabled) return;

    // Set up realtime subscription for new messages
    const channel = supabase
      .channel('global-message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        async (payload) => {
          const newMessage = payload.new as {
            id: string;
            sender_id: string;
            receiver_id: string;
            content: string;
            created_at: string;
          };

          // Fetch sender's name
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', newMessage.sender_id)
            .maybeSingle();

          const senderName = senderProfile?.full_name || 'Someone';
          const previewContent = newMessage.content.length > 50 
            ? newMessage.content.substring(0, 50) + '...' 
            : newMessage.content;

          toast.info(`New message from ${senderName}`, {
            description: previewContent,
            action: {
              label: 'View',
              onClick: () => {
                // Dispatch a custom event that the MessagesModal can listen for
                window.dispatchEvent(new CustomEvent('openMessages', { 
                  detail: { conversationUserId: newMessage.sender_id }
                }));
              },
            },
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, enabled]);

  return null;
};

export default useMessageNotifications;
