import { useState, useEffect } from 'react';
import { Bell, MessageCircle, Star, Bookmark, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface Notification {
  id: string;
  type: 'message' | 'review' | 'bookmark';
  title: string;
  description: string;
  time: string;
  read: boolean;
}

interface NotificationCenterProps {
  userId: string | null;
}

const NotificationCenter = ({ userId }: NotificationCenterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    loadNotifications();

    // Listen for new messages
    const channel = supabase
      .channel('notification-center')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        async (payload) => {
          const msg = payload.new as any;
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', msg.sender_id)
            .maybeSingle();

          const newNotif: Notification = {
            id: msg.id,
            type: 'message',
            title: `New message from ${sender?.full_name || 'Someone'}`,
            description: msg.content.substring(0, 60) + (msg.content.length > 60 ? '...' : ''),
            time: new Date().toISOString(),
            read: false,
          };
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        async (payload) => {
          const review = payload.new as any;
          // Check if this review is on the user's skill or activity
          const { data: skill } = await supabase
            .from('skills')
            .select('title')
            .eq('id', review.target_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (skill) {
            const newNotif: Notification = {
              id: review.id,
              type: 'review',
              title: `New review on "${skill.title}"`,
              description: `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} ${review.comment || ''}`.substring(0, 60),
              time: new Date().toISOString(),
              read: false,
            };
            setNotifications(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const loadNotifications = async () => {
    if (!userId) return;
    
    // Load unread messages
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    const loadedNotifications: Notification[] = [];

    if (messages && messages.length > 0) {
      // Fetch sender profiles
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds);
        
      const profileMap = new Map();
      profiles?.forEach(p => profileMap.set(p.user_id, p.full_name));

      messages.forEach(msg => {
        loadedNotifications.push({
          id: msg.id,
          type: 'message',
          title: `New message from ${profileMap.get(msg.sender_id) || 'Someone'}`,
          description: msg.content.substring(0, 60) + (msg.content.length > 60 ? '...' : ''),
          time: msg.created_at,
          read: false,
        });
      });
    }

    setNotifications(loadedNotifications);
    setUnreadCount(loadedNotifications.length);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const formatTime = (timestamp: string) => {
    const diff = (Date.now() - new Date(timestamp).getTime()) / 60000;
    if (diff < 1) return 'now';
    if (diff < 60) return `${Math.floor(diff)}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'review': return <Star className="h-4 w-4 text-accent" />;
      case 'bookmark': return <Bookmark className="h-4 w-4 text-primary" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!userId) return null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-muted-foreground hover:text-primary hover:bg-primary/10 relative p-2"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center bg-accent text-accent-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-primary h-auto py-1 px-2">
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="p-1 h-auto">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-80">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 20).map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getIcon(notif.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{notif.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatTime(notif.time)}</p>
                      </div>
                      {!notif.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
