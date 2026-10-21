import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Mail, MapPin, Calendar, Briefcase, GraduationCap, Settings, Github, Linkedin, Globe, Code, Users, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NebulaBackground from './NebulaBackground';
import MessagesModal from './MessagesModal';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  academic_year: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  role?: string | null;
  created_at: string;
}

interface Skill {
  id: string;
  title: string;
  description: string | null;
  category: string;
  experience: string | null;
  hourly_rate: string | null;
  availability: string | null;
}

interface Activity {
  id: string;
  title: string;
  description: string | null;
  category: string;
  date: string | null;
  time: string | null;
  venue: string | null;
  approval_status?: string | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  github_link: string | null;
  team_members: string | null;
}

interface Collaboration {
  id: string;
  project_id: string;
  status: string;
  skill: string | null;
  project: Project | null;
}

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string } | null>(null);
  const [showMessagesModal, setShowMessagesModal] = useState(false);

  useEffect(() => {
    fetchUserData();
    checkCurrentUser();
  }, [userId]);

  const checkCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      setCurrentUser({ id: session.user.id, fullName: profile?.full_name || 'User' });
    }
  };

  const fetchUserData = async () => {
    if (!userId) return;
    setLoading(true);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profileData) {
      // Clear everything — otherwise navigating from profile A to a bad id
      // kept rendering A's data under B's URL.
      setProfile(null);
      setSkills([]);
      setActivities([]);
      setProjects([]);
      setCollaborations([]);
      setPendingInvites([]);
      setLoading(false);
      return;
    }

    setProfile(profileData as Profile);

    const [{ data: skillsData }, { data: activitiesData }, { data: projectsData }] = await Promise.all([
      supabase.from('skills').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);

    setSkills(skillsData || []);
    setActivities(activitiesData || []);
    setProjects(projectsData || []);

    // Collaborations: projects this user joined via accepted invite
    const { data: collabRows } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['accepted', 'pending']);

    const acceptedRows = (collabRows || []).filter((c) => c.status === 'accepted');
    const pendingRows = (collabRows || []).filter((c) => c.status === 'pending');

    if (acceptedRows.length > 0) {
      const projectIds = acceptedRows.map((c) => c.project_id);
      const { data: joinedProjects } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);
      const projectMap = new Map(joinedProjects?.map((p) => [p.id, p]));
      setCollaborations(acceptedRows.map((c) => ({ ...c, project: projectMap.get(c.project_id) || null })));
    } else {
      setCollaborations([]);
    }

    if (pendingRows.length > 0) {
      const projectIds = pendingRows.map((c) => c.project_id);
      const { data: pendingProjects } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);
      const projectMap = new Map(pendingProjects?.map((p) => [p.id, p]));
      setPendingInvites(pendingRows.map((c) => ({ ...c, project: projectMap.get(c.project_id) || null })));
    } else {
      setPendingInvites([]);
    }

    setLoading(false);
  };

  const respondToInvite = async (inviteId: string, status: 'accepted' | 'declined') => {
    const { data, error } = await supabase
      .from('project_collaborators')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('user_id', currentUser?.id)
      .select('id');

    if (error) {
      toast.error('Failed to respond: ' + error.message);
      return;
    }
    if (!data || data.length === 0) {
      // RLS-blocked updates match 0 rows without raising an error in PostgREST,
      // so success must be proven by an affected row — otherwise the toast lied.
      toast.error('Failed to respond: only the invitee can accept or decline.');
      return;
    }
    toast.success(status === 'accepted' ? 'You joined the project!' : 'Invite declined');
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  const handleMessage = async () => {
    if (!currentUser) {
      toast.error('Please sign in to send messages');
      navigate('/auth');
      return;
    }
    if (currentUser.id === userId) {
      toast.error("You can't message yourself");
      return;
    }

    // Ensure connection exists (the pair is guaranteed unique by a DB index,
    // so limit(1) is always exactly one row or none).
    const { data: existingConn, error: connLookupError } = await supabase
      .from('connections')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
      .limit(1);

    if (connLookupError) {
      toast.error('Failed to check connection status');
      return;
    }

    const conn = existingConn && existingConn.length > 0 ? existingConn[0] : null;
    let status = conn?.status || 'none';

    if (!conn) {
      const { error: insertError } = await supabase.from('connections').insert({
        sender_id: currentUser.id,
        receiver_id: userId,
        status: 'pending'
      });
      if (insertError) {
        toast.error('Failed to send connection request: ' + insertError.message);
        return;
      }
      status = 'pending';
    } else if (conn.status === 'rejected' || conn.status === 'declined') {
      // They declined earlier. The pair keeps ONE row (unique index), so
      // re-requesting resets it instead of dead-ending forever.
      const { error: resetError } = await supabase
        .from('connections')
        .update({ status: 'pending', sender_id: currentUser.id, receiver_id: userId })
        .eq('id', conn.id);
      if (resetError) {
        toast.error('Failed to resend connection request: ' + resetError.message);
        return;
      }
      status = 'pending';
    }

    if (status === 'pending') {
      // If I'm the receiver of their request, I can reply right away.
      const isTheirRequest = conn?.sender_id === userId;
      if (!isTheirRequest) {
        // Send the greeting ALONGSIDE the request: a bare connection row gave
        // the receiver a nameless request, and after they accepted there was
        // still no conversation until the sender clicked Message a 2nd time.
        const { error: greetError } = await supabase.from('messages').insert({
          sender_id: currentUser.id,
          receiver_id: userId,
          content: `👋 Hi ${profile?.full_name?.split(' ')[0]}! I'd like to connect with you.`
        });
        if (greetError) {
          toast.error('Failed to start conversation');
          return;
        }
        toast.success('Connection request sent. You can chat once they accept.');
        window.dispatchEvent(new CustomEvent('openMessages', { detail: { conversationUserId: userId } }));
        setShowMessagesModal(true);
        return;
      }
    }

    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: userId,
      content: `👋 Hi ${profile?.full_name?.split(' ')[0]}! I'd like to connect with you.`
    });
    
    if (error) { toast.error('Failed to start conversation'); return; }
    
    // Dispatch custom event to tell MessagesModal to open this specific conversation
    const event = new CustomEvent('openMessages', { detail: { conversationUserId: userId } });
    window.dispatchEvent(event);
    
    toast.success('Conversation started!');
    setShowMessagesModal(true);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Graphics & Design': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Programming & Tech': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Digital Marketing': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      'Writing & Translation': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Video & Animation': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Music & Audio': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      'Sports': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    };
    return colors[category] || 'bg-muted text-muted-foreground border-border';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-foreground">User not found</h1>
          <Button onClick={() => navigate('/')} className="plasma-button text-primary-foreground">Go back home</Button>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === userId;

  // Section navigation — these used to live in the topbar, which made it
  // crowded, so they now live here on the profile.
  const quickLinks = [
    { label: 'Skills', path: '/skills', icon: Code },
    { label: 'Activities', path: '/activities', icon: Calendar },
    { label: 'People', path: '/people', icon: Users },
    { label: 'Communities', path: '/communities', icon: Globe },
    { label: 'Faculty', path: '/teachers', icon: GraduationCap },
    ...(isOwnProfile && profile.role === 'teacher'
      ? [{ label: 'Manage', path: '/manage', icon: Settings }]
      : []),
  ];

  // Pending/rejected events are moderation-invisible to the public: only the
  // owner sees their own unapproved submissions (badged), matching Home/AllActivities.
  const visibleActivities = activities.filter((activity) =>
    isOwnProfile ||
    !activity.approval_status ||
    activity.approval_status === 'approved'
  );

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />

      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <Button variant="ghost" onClick={() => navigate('/')} className="text-foreground hover:bg-muted shrink-0">
              <ArrowLeft className="h-5 w-5 mr-2" />Home
            </Button>
            <div className="flex gap-2 shrink-0">
              {isOwnProfile && (
                <Button variant="outline" onClick={() => navigate('/edit-profile')} className="border-primary/30 text-primary px-3 md:px-4">
                  <Settings className="h-4 w-4 mr-2" /><span className="hidden sm:inline">Edit Profile</span>
                </Button>
              )}
              {currentUser && !isOwnProfile && (
                <Button onClick={handleMessage} className="plasma-button text-primary-foreground px-3 md:px-4">
                  <MessageCircle className="h-4 w-4 mr-2" /><span className="hidden sm:inline">Message</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        <Card className="crystal-card mb-8 overflow-hidden">
          {profile.banner_url && (
            <div className="relative h-40 md:h-52">
              <img src={profile.banner_url} alt="Profile banner" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
            </div>
          )}
          <CardContent className={`${profile.banner_url ? 'pt-4' : 'pt-8'} pb-6`}>
            <div className={`flex flex-col md:flex-row items-center md:items-start gap-6 ${profile.banner_url ? '-mt-16 md:-mt-20' : ''}`}>
              <div className="relative">
                <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-glow">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-3xl md:text-4xl">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{profile.full_name}</h1>
                {profile.bio && <p className="text-muted-foreground text-sm mb-3">{profile.bio}</p>}
                <div className="flex flex-wrap justify-center md:justify-start gap-3 text-muted-foreground mb-4">
                  {profile.department && (
                    <div className="flex items-center gap-1"><GraduationCap className="h-4 w-4" /><span className="text-sm">{profile.department}</span></div>
                  )}
                  {profile.academic_year && (
                    <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /><span className="text-sm">{profile.academic_year}</span></div>
                  )}
                  {isOwnProfile && (
                    <div className="flex items-center gap-1 min-w-0"><Mail className="h-4 w-4 shrink-0" /><span className="text-sm break-all">{profile.email}</span></div>
                  )}
                </div>
                
                {(profile.github_url || profile.linkedin_url || profile.portfolio_url) && (
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-4">
                    {profile.github_url && (
                      <a href={profile.github_url.startsWith('http') ? profile.github_url : `https://${profile.github_url}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="GitHub">
                        <Github className="h-5 w-5" />
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url.startsWith('http') ? profile.linkedin_url : `https://${profile.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="LinkedIn">
                        <Linkedin className="h-5 w-5" />
                      </a>
                    )}
                    {profile.portfolio_url && (
                      <a href={profile.portfolio_url.startsWith('http') ? profile.portfolio_url : `https://${profile.portfolio_url}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="Portfolio">
                        <Globe className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary">{skills.length} Skills</Badge>
                  <Badge variant="outline" className="border-accent/30 text-accent">{activities.length} Activities</Badge>
                  <Badge variant="outline" className="border-green-500/30 text-green-400">{projects.length} Projects</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick navigation - moved out of the topbar to keep the bar compact */}
        <Card className="crystal-card mb-8">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />Explore GTA
            </h2>
            <div className="flex flex-wrap gap-2">
              {quickLinks.map(({ label, path, icon: Icon }) => (
                <Button
                  key={path}
                  variant="outline"
                  onClick={() => navigate(path)}
                  className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="h-4 w-4 mr-2" />{label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {isOwnProfile && pendingInvites.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />Project Invites
            </h2>
            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <Card key={invite.id} className="crystal-card">
                  <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{invite.project?.title || 'Project'}</p>
                      {invite.project?.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{invite.project.description}</p>
                      )}
                      {invite.skill && (
                        <p className="text-sm text-muted-foreground mt-1">They'd like you to work on <span className="text-foreground font-medium">{invite.skill}</span></p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => respondToInvite(invite.id, 'declined')}
                      >
                        Decline
                      </Button>
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => respondToInvite(invite.id, 'accepted')}>
                        Accept
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {collaborations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />Collaborations
              <span className="text-sm font-normal text-muted-foreground">Projects {profile.full_name} joined</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collaborations.map((collab) => collab.project && (
                <Card
                  key={collab.id}
                  className="crystal-card hover:border-accent/30 transition-all cursor-pointer"
                  onClick={() => navigate(`/project/${collab.project.id}`)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-foreground">{collab.project.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{collab.project.description || 'No description'}</p>
                    {collab.skill && (
                      <Badge variant="outline" className="border-accent/30 text-accent">{collab.skill}</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />Skills & Services
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((skill) => (
                <Card key={skill.id} className="crystal-card hover:border-primary/30 transition-all cursor-pointer" onClick={() => navigate(`/skill/${skill.id}`)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg text-foreground">{skill.title}</CardTitle>
                      <Badge className={getCategoryColor(skill.category)}>{skill.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{skill.description || 'No description'}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {skill.experience && <Badge variant="outline" className="border-border">{skill.experience}</Badge>}
                      {skill.hourly_rate && <Badge variant="outline" className="border-border">₹{skill.hourly_rate}/hr</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Code className="h-5 w-5 text-accent" />Projects
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className="crystal-card hover:border-accent/30 transition-all cursor-pointer"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-foreground">{project.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{project.description || 'No description'}</p>
                    <div className="flex flex-col gap-2 mt-4 text-sm text-muted-foreground">
                      {project.team_members && (
                        <div className="flex items-start gap-2">
                          <Users className="h-4 w-4 mt-0.5 text-primary" />
                          <span className="line-clamp-2">{project.team_members}</span>
                        </div>
                      )}
                      {project.github_link && (
                        <a 
                          href={project.github_link.startsWith('http') ? project.github_link : `https://${project.github_link}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-2 hover:text-primary transition-colors mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Github className="h-4 w-4" /> View on GitHub
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {visibleActivities.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" />Activities & Events
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleActivities.map((activity) => (
                <Card key={activity.id} className="crystal-card hover:border-accent/30 transition-all cursor-pointer" onClick={() => navigate(`/activity/${activity.id}`)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-foreground flex items-center gap-2">
                      {activity.title}
                      {activity.approval_status === 'pending' && (
                        <Badge className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 shrink-0">
                          Pending approval
                        </Badge>
                      )}
                      {activity.approval_status === 'rejected' && (
                        <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/40 shrink-0">
                          Not approved
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{activity.description || 'No description'}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {activity.date && <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{activity.date}</div>}
                      {activity.venue && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{activity.venue}</div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {skills.length === 0 && visibleActivities.length === 0 && projects.length === 0 && collaborations.length === 0 && (
          <Card className="crystal-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">This user hasn't added any skills or activities yet.</p>
            </CardContent>
          </Card>
        )}
      </main>

      <MessagesModal isOpen={showMessagesModal} onClose={() => setShowMessagesModal(false)} currentUser={currentUser} />
    </div>
  );
};

export default UserProfile;
