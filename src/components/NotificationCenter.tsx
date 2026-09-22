import { useState, useEffect } from 'react';
import { Bell, MessageCircle, Star, Bookmark, UserPlus, UserCheck, UsersIcon, X, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

interface Notification {
  id: string;
  type: 'message' | 'review' | 'connection' | 'invite' | 'community_request';
  title: string;
  description: string;
  time: string;
  read: boolean;
  actionType?: 'connection' | 'invite' | 'community_request';
  relationId?: string;
  actorId?: string;
  path?: string;
}

interface NotificationCenterProps {
  userId: string | null;
}

const NotificationCenter = ({ userId }: NotificationCenterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ledCommunities, setLedCommunities] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    loadNotifications();

    const channel = supabase
      .channel('notification-center')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        async (payload) => {
          const msg = payload.new as Tables<'messages'>;
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', msg.sender_id)
            .maybeSingle();

          addNotification({
            id: msg.id,
            type: 'message',
            title: `New message from ${sender?.full_name || 'Someone'}`,
            description: msg.content.substring(0, 60) + (msg.content.length > 60 ? '...' : ''),
            time: new Date().toISOString(),
            read: false,
            actorId: msg.sender_id,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        async (payload) => {
          const review = payload.new as Tables<'reviews'>;
          const targetTable = review.target_type === 'activity' ? 'activities' : 'skills';
          const { data: target } = await supabase
            .from(targetTable as 'skills' | 'activities')
            .select('title')
            .eq('id', review.target_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (target) {
            addNotification({
              id: review.id,
              type: 'review',
              title: `New review on "${target.title}"`,
              description: `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} ${review.comment || ''}`.substring(0, 60),
              time: new Date().toISOString(),
              read: false,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connections',
          filter: `receiver_id=eq.${userId}`,
        },
        async (payload) => {
          const conn = payload.new as Tables<'connections'>;
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', conn.sender_id)
            .maybeSingle();

          addNotification({
            id: conn.id,
            type: 'connection',
            title: `Message request from ${sender?.full_name || 'Someone'}`,
            description: 'Accept the request to start chatting',
            time: new Date().toISOString(),
            read: false,
            actionType: 'connection',
            relationId: conn.id,
            actorId: conn.sender_id,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_collaborators',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const collab = payload.new as Tables<'project_collaborators'>;
          const [{ data: inviter }, { data: project }] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('user_id', collab.inviter_id).maybeSingle(),
            supabase.from('projects').select('title').eq('id', collab.project_id).maybeSingle(),
          ]);

          addNotification({
            id: collab.id,
            type: 'invite',
            title: `${inviter?.full_name || 'Someone'} invited you to a project`,
            description: `"${project?.title || 'Project'}"` + (collab.skill ? ` — ${collab.skill}` : ''),
            time: new Date().toISOString(),
            read: false,
            actionType: 'invite',
            relationId: collab.id,
            actorId: collab.inviter_id,
            path: `/project/${collab.project_id}`,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_members' },
        async (payload) => {
          const member = payload.new as Tables<'community_members'>;
          if (member.status !== 'pending') return;
          if (!ledCommunities.includes(member.community_id)) return;

          const [{ data: requester }, { data: community }] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('user_id', member.user_id).maybeSingle(),
            supabase.from('communities').select('name').eq('id', member.community_id).maybeSingle(),
          ]);

          addNotification({
            id: member.id,
            type: 'community_request',
            title: `Join request for "${community?.name || 'community'}"`,
            description: `${requester?.full_name || 'Someone'} wants to join`,
            time: new Date().toISOString(),
            read: false,
            actionType: 'community_request',
            relationId: member.id,
            actorId: member.user_id,
            path: '/communities',
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        async (payload) => {
          const msg = payload.new as Tables<'messages'>;
          if (msg.read) {
            setNotifications(prev => {
              const updated = prev.map(n => n.id === msg.id ? { ...n, read: true } : n);
              setUnreadCount(updated.filter(n => !n.read).length);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ledCommunities]);

  const addNotification = (notif: Notification) => {
    setNotifications(prev => {
      if (prev.some(n => n.id === notif.id)) return prev;
      const next = [notif, ...prev];
      setUnreadCount(next.filter(n => !n.read).length);
      return next;
    });
  };

  const loadNotifications = async () => {
    if (!userId) return;

    const loaded: Notification[] = [];

    const [
      { data: messages },
      { data: connectionRequests },
      { data: collaboratorInvites },
    ] = await Promise.all([
      supabase.from('messages').select('*').eq('receiver_id', userId).eq('read', false).order('created_at', { ascending: false }).limit(20),
      supabase.from('connections').select('*').eq('receiver_id', userId).eq('status', 'pending').limit(20),
      supabase.from('project_collaborators').select('*').eq('user_id', userId).eq('status', 'pending').limit(20),
    ]);

    // Messages
    if (messages && messages.length > 0) {
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]));
      messages.forEach(msg => {
        loaded.push({
          id: msg.id,
          type: 'message',
          title: `New message from ${profileMap.get(msg.sender_id) || 'Someone'}`,
          description: msg.content.substring(0, 60) + (msg.content.length > 60 ? '...' : ''),
          time: msg.created_at,
          read: false,
          actorId: msg.sender_id,
        });
      });
    }

    // Connection requests
    if (connectionRequests && connectionRequests.length > 0) {
      const senderIds = [...new Set(connectionRequests.map((c) => c.sender_id))];
      const { data: requesterProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds);
      const reqMap = new Map(requesterProfiles?.map((p) => [p.user_id, p.full_name]));
      connectionRequests.forEach((conn) => {
        loaded.push({
          id: conn.id,
          type: 'connection',
          title: `Message request from ${reqMap.get(conn.sender_id) || 'Someone'}`,
          description: 'Accept the request to start chatting',
          time: conn.created_at,
          read: false,
          actionType: 'connection',
          relationId: conn.id,
          actorId: conn.sender_id,
        });
      });
    }

    // Collaborator invites
    if (collaboratorInvites && collaboratorInvites.length > 0) {
      const { data: projectData } = await supabase
        .from('projects')
        .select('id, title')
        .in('id', [...new Set(collaboratorInvites.map((c) => c.project_id))]);
      const projectMap = new Map(projectData?.map((p) => [p.id, p.title]));

      for (const invite of collaboratorInvites) {
        const { data: inviter } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', invite.inviter_id)
          .maybeSingle();
        loaded.push({
          id: invite.id,
          type: 'invite',
          title: `${inviter?.full_name || 'Someone'} invited you to a project`,
          description: `"${projectMap.get(invite.project_id) || 'Project'}"` + (invite.skill ? ` — ${invite.skill}` : ''),
          time: invite.created_at,
          read: false,
          actionType: 'invite',
          relationId: invite.id,
          actorId: invite.inviter_id,
          path: `/project/${invite.project_id}`,
        });
      }
    }

    // Community join requests (communities this user leads)
    const { data: ledCommunityData } = await supabase
      .from('communities')
      .select('id')
      .or(`leader_id.eq.${userId},president_id.eq.${userId},vice_president_id.eq.${userId},created_by.eq.${userId}`);

    const ledIds = ledCommunityData?.map((c) => c.id) || [];

    if (ledIds.length > 0 && !ledCommunities.length) {
      setLedCommunities(ledIds);
    }

    if (ledIds.length > 0) {
      const { data: pendingMembers } = await supabase
        .from('community_members')
        .select('*')
        .in('community_id', ledIds)
        .eq('status', 'pending')
        .limit(20);

      if (pendingMembers && pendingMembers.length > 0) {
        const { data: requesterProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', [...new Set(pendingMembers.map((m) => m.user_id))]);
        const reqMap = new Map(requesterProfiles?.map((p) => [p.user_id, p.full_name]));
        const { data: communityData } = await supabase
          .from('communities')
          .select('id, name')
          .in('id', ledIds);
        const communityMap = new Map(communityData?.map((c) => [c.id, c.name]));

        pendingMembers.forEach((member) => {
          loaded.push({
            id: member.id,
            type: 'community_request',
            title: `Join request for "${communityMap.get(member.community_id) || 'community'}"`,
            description: `${reqMap.get(member.user_id) || 'Someone'} wants to join`,
            time: member.joined_at,
            read: false,
            actionType: 'community_request',
            relationId: member.id,
            actorId: member.user_id,
            path: '/communities',
          });
        });
      }
    }

    // Reviews that target MY content
    const { data: mySkills } = await supabase.from('skills').select('id').eq('user_id', userId);
    const { data: myActivities } = await supabase.from('activities').select('id').eq('user_id', userId);
    const myContentIds: string[] = [...(mySkills?.map((s) => s.id) || []), ...(myActivities?.map((a) => a.id) || [])];

    if (myContentIds.length > 0) {
      const { data: myReviews } = await supabase
        .from('reviews')
        .select('*')
        .in('target_id', myContentIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (myReviews && myReviews.length > 0) {
        const { data: reviewerProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', [...new Set(myReviews.map((r) => r.user_id))]);
        const reviewerMap = new Map(reviewerProfiles?.map((p) => [p.user_id, p.full_name]));

        for (const review of myReviews) {
          const isActivity = myActivities?.some((a) => a.id === review.target_id);
          const targetTitle = isActivity
            ? (await supabase.from('activities').select('title').eq('id', review.target_id).maybeSingle()).data?.title
            : (await supabase.from('skills').select('title').eq('id', review.target_id).maybeSingle()).data?.title;
          if (!targetTitle) continue;
          loaded.push({
            id: review.id,
            type: 'review',
            title: `New review on "${targetTitle}"`,
            description: `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} ${review.comment || ''}`.substring(0, 60),
            time: review.created_at,
            read: false,
          });
        }
      }
    }

    loaded.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setNotifications(loaded);
    setUnreadCount(loaded.length);
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    if (!userId) return;
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', userId)
      .eq('read', false);
  };

  const handleAction = async (notif: Notification, outcome: 'accepted' | 'declined') => {
    if (!notif.actionType || !notif.relationId) return;

    if (notif.actionType === 'connection') {
      const { error } = await supabase
        .from('connections')
        .update({ status: outcome })
        .eq('id', notif.relationId);
      if (error) return toast.error('Action failed: ' + error.message);
      toast.success(outcome === 'accepted' ? 'Request accepted' : 'Request declined');
    } else if (notif.actionType === 'invite') {
      const { error } = await supabase
        .from('project_collaborators')
        .update({ status: outcome, responded_at: new Date().toISOString() })
        .eq('id', notif.relationId)
        .eq('user_id', userId);
      if (error) return toast.error('Action failed: ' + error.message);
      toast.success(outcome === 'accepted' ? 'You joined the project!' : 'Invite declined');
    } else if (notif.actionType === 'community_request') {
      const { error } = await supabase
        .from('community_members')
        .update({ status: outcome })
        .eq('id', notif.relationId);
      if (error) return toast.error('Action failed: ' + error.message);
      toast.success(outcome === 'accepted' ? 'Member approved' : 'Request declined');
    }

    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleNotificationClick = (notif: Notification) => {
    if (notif.actionType) return; // buttons handle it
    if (notif.type === 'message' && notif.actorId) {
      const event = new CustomEvent('openMessages', { detail: { conversationUserId: notif.actorId } });
      window.dispatchEvent(event);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - (notif.read ? 0 : 1)));
      setIsOpen(false);
    }
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
      case 'connection': return <UserPlus className="h-4 w-4 text-primary" />;
      case 'invite': return <UsersIcon className="h-4 w-4 text-accent" />;
      case 'community_request': return <UserCheck className="h-4 w-4 text-primary" />;
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
        className="header-glow-btn relative p-2"
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
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3 border-b border-border/50 transition-colors ${notif.actionType ? '' : 'hover:bg-muted/50 cursor-pointer'} ${!notif.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getIcon(notif.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{notif.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatTime(notif.time)}</p>
                        {notif.actionType && (
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              size="sm"
                              className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                              onClick={() => handleAction(notif, 'accepted')}
                            >
                              <Check className="h-3 w-3 mr-1" />Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 border-destructive text-destructive hover:bg-destructive/10"
                              onClick={() => handleAction(notif, 'declined')}
                            >
                              <X className="h-3 w-3 mr-1" />Decline
                            </Button>
                            {notif.path && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => { setIsOpen(false); window.location.href = notif.path!; }}
                              >
                                <Send className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {!notif.read && !notif.actionType && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
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