import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Search,
  Plus,
  GraduationCap,
  Shield,
  UserCheck,
  UserX,
  Check,
  X,
  Crown,
  Send,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NebulaBackground from './NebulaBackground';
import AddCommunityModal from './AddCommunityModal';
import type { User } from '@supabase/supabase-js';

interface CommunityWithMeta {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  leader_id: string | null;
  president_id: string | null;
  vice_president_id: string | null;
  created_at: string;
  leader?: { user_id: string; full_name: string } | null;
  president?: { user_id: string; full_name: string } | null;
  vice_president?: { user_id: string; full_name: string } | null;
  member_count?: number;
  myStatus?: 'pending' | 'accepted' | 'none';
  isLead?: boolean;
  members?: { id: string; user_id: string; status: string; full_name: string }[];
  pendingRequests?: { id: string; user_id: string; full_name: string; joined_at: string }[];
}

const Communities = () => {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<CommunityWithMeta[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileRole, setProfileRole] = useState('student');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUser(session.user);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      setProfileRole(profileData?.role || 'student');
    }

    const { data: communitiesData, error } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !communitiesData) {
      setCommunities([]);
      setLoading(false);
      return;
    }

    // Profile lookups for leaders & role holders
    const leadUserIds = [
      ...new Set(
        communitiesData.flatMap((c) =>
          [c.leader_id, c.president_id, c.vice_president_id, c.created_by].filter(Boolean)
        )
      )
    ];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', leadUserIds);
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]));

    const enriched: CommunityWithMeta[] = communitiesData.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      created_by: c.created_by,
      leader_id: c.leader_id,
      president_id: c.president_id,
      vice_president_id: c.vice_president_id,
      created_at: c.created_at,
      leader: c.leader_id ? { user_id: c.leader_id, full_name: profileMap.get(c.leader_id) || 'Faculty Lead' } : null,
      president: c.president_id ? { user_id: c.president_id, full_name: profileMap.get(c.president_id) || 'President' } : null,
      vice_president: c.vice_president_id ? { user_id: c.vice_president_id, full_name: profileMap.get(c.vice_president_id) || 'Vice President' } : null,
      isLead: session?.user ? (
        c.leader_id === session.user.id ||
        c.president_id === session.user.id ||
        c.vice_president_id === session.user.id ||
        c.created_by === session.user.id
      ) : false,
    }));

    // Member counts + my membership + member lists
    if (session?.user) {
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id, status')
        .eq('user_id', session.user.id);
      const myStatusMap = new Map((memberships || []).map((m) => [m.community_id, m.status]));

      enriched.forEach(community => {
        community.myStatus = (myStatusMap.get(community.id) || 'none') as 'none' | 'accepted' | 'pending';
      });
    }

    // For expanded/led communities fetch members + pending requests
    const allMembers = await supabase
      .from('community_members')
      .select('*')
      .in('community_id', enriched.map(c => c.id));

    const memberProfiles = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', [...new Set((allMembers.data || []).map((m) => m.user_id))]);
    const memberProfileMap = new Map(memberProfiles.data?.map((p) => [p.user_id, p.full_name]));

    const membersByCommunity = new Map<string, { community_id: string; id: string; user_id: string; status: string; joined_at: string; full_name: string }[]>();
    (allMembers.data || []).forEach((m) => {
      const list = membersByCommunity.get(m.community_id) || [];
      list.push({ ...m, full_name: memberProfileMap.get(m.user_id) || 'Unknown' });
      membersByCommunity.set(m.community_id, list);
    });

    enriched.forEach(community => {
      const members = membersByCommunity.get(community.id) || [];
      community.member_count = members.filter((m) => m.status === 'accepted').length;
      community.members = members;
      community.pendingRequests = members.filter((m) => m.status === 'pending');
    });

    setCommunities(enriched);
    setLoading(false);
  };

  const requestJoin = async (community: CommunityWithMeta) => {
    if (!currentUser) {
      toast.error('Please sign in to join a community');
      navigate('/auth');
      return;
    }
    const { error } = await supabase
      .from('community_members')
      .insert({ community_id: community.id, user_id: currentUser.id, status: 'pending' });
    if (error) {
      toast.error('Failed to request join: ' + error.message);
      return;
    }
    toast.success('Join request sent! A lead will approve you.');
    loadCommunities();
  };

  const leaveCommunity = async (community: CommunityWithMeta) => {
    if (!currentUser || !community.id) return;
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', community.id)
      .eq('user_id', currentUser.id);
    if (error) {
      toast.error('Failed to leave: ' + error.message);
      return;
    }
    toast.success('You left the community');
    loadCommunities();
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
    loadCommunities();
  };

  const setLeaderRole = async (community: CommunityWithMeta, memberUserId: string, role: 'president_id' | 'vice_president_id') => {
    if (!community.id) return;
    const { error } = await supabase
      .from('communities')
      .update({ [role]: memberUserId })
      .eq('id', community.id);
    if (error) {
      toast.error('Failed to assign role: ' + error.message);
      return;
    }
    toast.success(role === 'president_id' ? 'President assigned!' : 'Vice President assigned!');
    loadCommunities();
  };

  const filteredCommunities = communities.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.leader?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NebulaBackground />
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading communities...</p>
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
                  Communities
                </h1>
                <p className="text-sm text-muted-foreground">Clubs & groups led by faculty and student leaders</p>
              </div>
            </div>
            {currentUser && (
              <Button className="plasma-button text-primary-foreground" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" /> New Community
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10 max-w-5xl">
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search communities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted/50 border-border"
          />
        </div>

        {filteredCommunities.length === 0 ? (
          <Card className="crystal-card">
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No communities match your search.' : 'No communities yet. Create the first one!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCommunities.map((community) => (
              <Card key={community.id} className="crystal-card flex flex-col">
                <CardContent className="pt-6 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{community.name}</h3>
                        <p className="text-xs text-muted-foreground">{community.member_count || 0} members</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {community.isLead && (
                        <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                          <Shield className="h-3 w-3 mr-1" />Lead
                        </Badge>
                      )}
                    </div>
                  </div>

                  {community.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{community.description}</p>
                  )}

                  <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                    {community.leader && (
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-3.5 w-3.5 text-primary" />
                        <span>Lead: <button className="text-foreground hover:text-accent" onClick={() => navigate(`/user/${community.leader!.user_id}`)}>{community.leader.full_name}</button></span>
                      </div>
                    )}
                    {community.president && (
                      <div className="flex items-center gap-2">
                        <Crown className="h-3.5 w-3.5 text-accent" />
                        <span>President: <button className="text-foreground hover:text-accent" onClick={() => navigate(`/user/${community.president!.user_id}`)}>{community.president.full_name}</button></span>
                      </div>
                    )}
                    {community.vice_president && (
                      <div className="flex items-center gap-2">
                        <Crown className="h-3.5 w-3.5 text-accent" />
                        <span>Vice President: <button className="text-foreground hover:text-accent" onClick={() => navigate(`/user/${community.vice_president!.user_id}`)}>{community.vice_president.full_name}</button></span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/50">
                    {!currentUser ? (
                      <Button size="sm" className="flex-1 plasma-button text-primary-foreground" onClick={() => { toast.error('Please sign in'); navigate('/auth'); }}>
                        <UserCheck className="h-4 w-4 mr-2" />Sign In to Join
                      </Button>
                    ) : community.myStatus === 'accepted' ? (
                      <>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setExpandedId(expandedId === community.id ? null : community.id)}>
                          <Users className="h-4 w-4 mr-2" />Members
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => leaveCommunity(community)}>
                          <UserX className="h-4 w-4 mr-2" />Leave
                        </Button>
                      </>
                    ) : community.myStatus === 'pending' ? (
                      <Button size="sm" variant="outline" disabled className="flex-1">
                        <Clock className="h-4 w-4 mr-2" />Request Pending
                      </Button>
                    ) : (
                      <Button size="sm" className="flex-1 plasma-button text-primary-foreground" onClick={() => requestJoin(community)}>
                        <Send className="h-4 w-4 mr-2" />Request to Join
                      </Button>
                    )}
                    {community.members && community.members.length > 0 && community.myStatus === 'accepted' && (
                      <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === community.id ? null : community.id)}>
                        {expandedId === community.id ? <X className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Expanded member/requests detail */}
        {expandedId && (() => {
          const community = communities.find(c => c.id === expandedId);
          if (!community) return null;
          return (
            <div className="mt-8">
              <Card className="crystal-card">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {community.name} — Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {(community.members || []).filter(m => m.status === 'accepted').map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/user/${member.user_id}`)}>
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
                        {community.isLead && member.user_id !== currentUser?.id && member.user_id !== community.leader_id && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setLeaderRole(community, member.user_id, 'president_id'); }}>
                              <Crown className="h-3 w-3 mr-1" />President
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setLeaderRole(community, member.user_id, 'vice_president_id'); }}>
                              VP
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {community.isLead && community.pendingRequests && community.pendingRequests.length > 0 && (
                    <>
                      <h4 className="text-sm font-semibold text-foreground mt-6 mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />Pending Join Requests
                      </h4>
                      <div className="flex flex-col gap-2">
                        {community.pendingRequests.map((request) => (
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
            </div>
          );
        })()}
      </main>

      <AddCommunityModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCommunityAdded={loadCommunities}
        isTeacher={profileRole === 'teacher'}
      />
    </div>
  );
};

export default Communities;