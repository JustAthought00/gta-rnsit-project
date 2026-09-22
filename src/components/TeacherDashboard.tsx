import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Sparkles,
  CheckCircle2,
  XCircle,
  Trash2,
  Users,
  Shield,
  Crown,
  GraduationCap,
  Check,
  X,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NebulaBackground from './NebulaBackground';
import type { Tables } from '@/integrations/supabase/types';

interface ActivityRow {
  id: string;
  title: string;
  category: string;
  date: string | null;
  time: string | null;
  venue: string | null;
  organizer_type: string;
  group_name: string | null;
  approval_status: string;
  deadline: string | null;
  created_at: string;
  organizer?: { user_id: string; full_name: string } | null;
}

interface CommunityRow {
  id: string;
  name: string;
  leader_id: string | null;
  president_id: string | null;
  vice_president_id: string | null;
  created_by: string;
  members?: { id: string; user_id: string; status: string; full_name: string }[];
}

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingActivities, setPendingActivities] = useState<ActivityRow[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityRow[]>([]);
  const [communities, setCommunities] = useState<CommunityRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }
      setCurrentUserId(session.user.id);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      const userRole = profileData?.role || 'student';
      setRole(userRole);
      if (userRole !== 'teacher') {
        setLoading(false);
        return;
      }

      await Promise.all([
        fetchPendingActivities(session.user.id),
        fetchAllActivities(),
        fetchCommunities(session.user.id),
      ]);
      setLoading(false);
    };
    load();
  }, []);

  const fetchOrganizerNames = async (activities: Tables<'activities'>[]) => {
    const userIds = [...new Set(activities.map(a => a.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]));
    return activities.map(a => ({ ...a, organizer: { user_id: a.user_id, full_name: profileMap.get(a.user_id) || 'Unknown' } }));
  };

  const fetchPendingActivities = async (teacherId: string) => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    if (data) setPendingActivities(await fetchOrganizerNames(data));
  };

  const fetchAllActivities = async () => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setAllActivities(await fetchOrganizerNames(data));
  };

  const fetchCommunities = async (userId: string) => {
    const { data } = await supabase
      .from('communities')
      .select('*')
      .or(`leader_id.eq.${userId},president_id.eq.${userId},vice_president_id.eq.${userId},created_by.eq.${userId}`);

    if (data && data.length > 0) {
      const { data: membersData } = await supabase
        .from('community_members')
        .select('*')
        .in('community_id', data.map(c => c.id));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', [...new Set((membersData || []).map((m) => m.user_id))]);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]));

      setCommunities(data.map((c) => ({
        ...c,
        members: (membersData || [])
          .filter((m) => m.community_id === c.id)
          .map((m) => ({ ...m, full_name: profileMap.get(m.user_id) || 'Unknown' })),
      })));
    } else {
      setCommunities([]);
    }
  };

  const setApproval = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('activities')
      .update({ approval_status: status })
      .eq('id', id);
    if (error) {
      toast.error('Action failed: ' + error.message);
      return;
    }
    toast.success(status === 'approved' ? 'Event approved!' : 'Event rejected');
    fetchAllActivities();
    fetchPendingActivities(currentUserId || '');
  };

  const deleteActivity = async (id: string) => {
    if (!confirm('Delete this event? Teachers can do this for any event.')) return;
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete: ' + error.message);
      return;
    }
    toast.success('Event deleted');
    fetchAllActivities();
    fetchPendingActivities(currentUserId || '');
  };

  const handleJoinRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('community_members')
      .update({ status })
      .eq('id', requestId);
    if (error) {
      toast.error('Action failed: ' + error.message);
      return;
    }
    toast.success(status === 'accepted' ? 'Member approved' : 'Request declined');
    fetchCommunities(currentUserId || '');
  };

  const assignRole = async (communityId: string, memberUserId: string, role: 'president_id' | 'vice_president_id') => {
    const { error } = await supabase
      .from('communities')
      .update({ [role]: memberUserId })
      .eq('id', communityId);
    if (error) {
      toast.error('Failed to assign role: ' + error.message);
      return;
    }
    toast.success(role === 'president_id' ? 'President assigned!' : 'Vice President assigned!');
    fetchCommunities(currentUserId || '');
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NebulaBackground />
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NebulaBackground />
        <div className="relative z-10 text-center max-w-md px-4">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Teachers Only</h1>
          <p className="text-muted-foreground mb-6">This dashboard is available to faculty accounts only. You can switch your role in Edit Profile.</p>
          <Button onClick={() => navigate('/')} className="plasma-button text-primary-foreground">Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />

      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-foreground/70 hover:text-foreground hover:bg-primary/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Teacher Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">Approve events, manage communities and their leaders</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10 max-w-4xl">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50">
            <TabsTrigger value="pending" className="relative">Pending Events {pendingActivities.length > 0 && `(${pendingActivities.length})`}</TabsTrigger>
            <TabsTrigger value="events">All Events</TabsTrigger>
            <TabsTrigger value="communities">Communities</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card className="crystal-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />Awaiting Your Approval
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingActivities.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No events waiting for approval.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingActivities.map(activity => (
                      <div key={activity.id} className="p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">{activity.title}</h3>
                              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                                <Clock className="h-3 w-3 mr-1" />Pending
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              By {activity.organizer?.full_name}{activity.organizer_type === 'group' && activity.group_name ? ` • ${activity.group_name}` : ''}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {[activity.category, activity.date, activity.time, activity.venue].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => deleteActivity(activity.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 border-red-500/40 text-red-400 hover:bg-red-500/10" onClick={() => setApproval(activity.id, 'rejected')}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                            </Button>
                            <Button size="sm" className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setApproval(activity.id, 'approved')}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card className="crystal-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />All Campus Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allActivities.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No events on campus yet.</p>
                ) : (
                  <div className="space-y-3">
                    {allActivities.map(activity => (
                      <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground text-sm truncate">{activity.title}</span>
                            {activity.approval_status === 'pending' && (
                              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs">Pending</Badge>
                            )}
                            {activity.approval_status === 'rejected' && (
                              <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">Rejected</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">By {activity.organizer?.full_name}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => deleteActivity(activity.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communities">
            {communities.length === 0 ? (
              <Card className="crystal-card">
                <CardContent className="py-12 text-center">
                  <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">You don't lead any communities yet. Create one from the Communities page to manage it here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {communities.map(community => {
                  const accepted = (community.members || []).filter(m => m.status === 'accepted');
                  const pending = (community.members || []).filter(m => m.status === 'pending');
                  return (
                    <Card key={community.id} className="crystal-card">
                      <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />{community.name}
                          <Badge variant="outline" className="border-primary/30 text-primary text-xs">{accepted.length} members</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-2">
                          {accepted.map(member => (
                            <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/20 text-primary text-xs">{getInitials(member.full_name)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground truncate">{member.full_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {member.user_id === community.president_id ? 'President' :
                                    member.user_id === community.vice_president_id ? 'Vice President' :
                                    member.user_id === community.leader_id ? 'Faculty Lead' : 'Member'}
                                </p>
                              </div>
                              {member.user_id !== community.leader_id && (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => assignRole(community.id, member.user_id, 'president_id')}>
                                    <Crown className="h-3 w-3 mr-1" />President
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => assignRole(community.id, member.user_id, 'vice_president_id')}>
                                    VP
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {pending.length > 0 && (
                          <>
                            <h4 className="text-sm font-semibold text-foreground mt-6 mb-3 flex items-center gap-2">
                              <Clock className="h-4 w-4 text-primary" />Join Requests ({pending.length})
                            </h4>
                            <div className="flex flex-col gap-2">
                              {pending.map(request => (
                                <div key={request.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-accent/20 text-accent text-xs">{getInitials(request.full_name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground truncate">{request.full_name}</p>
                                  </div>
                                  <Button size="sm" variant="outline" className="h-7 px-2 border-destructive text-destructive hover:bg-destructive/10" onClick={() => handleJoinRequest(request.id, 'rejected')}>
                                    <X className="h-3 w-3 mr-1" />Decline
                                  </Button>
                                  <Button size="sm" className="h-7 px-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => handleJoinRequest(request.id, 'accepted')}>
                                    <Check className="h-3 w-3 mr-1" />Approve
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default TeacherDashboard;