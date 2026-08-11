import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Mail, MapPin, Calendar, Briefcase, GraduationCap, Settings, Github, Linkedin, Globe } from 'lucide-react';
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
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
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
}

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
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
      setLoading(false);
      return;
    }

    setProfile(profileData as Profile);

    const [{ data: skillsData }, { data: activitiesData }] = await Promise.all([
      supabase.from('skills').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);

    setSkills(skillsData || []);
    setActivities(activitiesData || []);
    setLoading(false);
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

    // Ensure connection exists
    const { data: existingConn } = await supabase
      .from('connections')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
      .maybeSingle();
      
    if (!existingConn) {
      await supabase.from('connections').insert({
        sender_id: currentUser.id,
        receiver_id: userId,
        status: 'pending'
      });
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

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />

      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(-1)} className="text-foreground hover:bg-muted">
              <ArrowLeft className="h-5 w-5 mr-2" />Back
            </Button>
            <div className="flex gap-2">
              {isOwnProfile && (
                <Button variant="outline" onClick={() => navigate('/edit-profile')} className="border-primary/30 text-primary">
                  <Settings className="h-4 w-4 mr-2" />Edit Profile
                </Button>
              )}
              {currentUser && !isOwnProfile && (
                <Button onClick={handleMessage} className="plasma-button text-primary-foreground">
                  <MessageCircle className="h-4 w-4 mr-2" />Message
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        <Card className="crystal-card mb-8">
          <CardContent className="pt-8 pb-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <Avatar className="h-24 w-24 md:h-32 md:w-32">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-3xl md:text-4xl">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>

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
                  <div className="flex items-center gap-1"><Mail className="h-4 w-4" /><span className="text-sm">{profile.email}</span></div>
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
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {activities.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" />Activities & Events
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.map((activity) => (
                <Card key={activity.id} className="crystal-card hover:border-accent/30 transition-all cursor-pointer" onClick={() => navigate(`/activity/${activity.id}`)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-foreground">{activity.title}</CardTitle>
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

        {skills.length === 0 && activities.length === 0 && (
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
