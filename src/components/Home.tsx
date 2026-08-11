import { Search, Users, Calendar, Zap, Code, Camera, Music, Palette, PenTool, Video, Mic, Briefcase, Globe, TrendingUp, Moon, Sun, MessageCircle, Plus, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import MessagesModal from './MessagesModal';
import AddSkillModal from './AddSkillModal';
import AddActivityModal from './AddActivityModal';
import NebulaBackground from './NebulaBackground';
import { toast } from 'sonner';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';
import NotificationCenter from './NotificationCenter';
import CampusPulse from './CampusPulse';

const Home = () => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'skills' | 'activities' | 'people'>('skills');
  const [dbSkills, setDbSkills] = useState<any[]>([]);
  const [dbActivities, setDbActivities] = useState<any[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // The 8 skill categories students can post under (must match AddSkillModal options).
  // Counts come from the database — never hardcoded.
  const skillCategories = [
    { name: 'Programming & Tech', icon: Code },
    { name: 'Graphics & Design', icon: Palette },
    { name: 'Writing & Translation', icon: PenTool },
    { name: 'Video & Animation', icon: Video },
    { name: 'Music & Audio', icon: Music },
    { name: 'Digital Marketing', icon: TrendingUp },
    { name: 'Business', icon: Briefcase },
    { name: 'Other', icon: Zap },
  ];

  // Auth state management
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
      }
      
      // Handle token refresh errors by signing out
      if (event === 'TOKEN_REFRESHED' && !session) {
        supabase.auth.signOut();
      }
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error);
        // Clear any stale session data
        supabase.auth.signOut();
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data);
  };

  // Fetch skills and activities from database
  useEffect(() => {
    fetchDbSkills();
    fetchDbActivities();
    fetchCategoryCounts();
  }, []);

  const fetchCategoryCounts = async () => {
    const { data, error } = await supabase.from('skills').select('category');

    if (error) {
      console.error('Error fetching category counts:', error);
      return;
    }

    const counts: Record<string, number> = {};
    (data || []).forEach(({ category }) => {
      if (category) counts[category] = (counts[category] || 0) + 1;
    });
    setCategoryCounts(counts);
  };

  const fetchDbSkills = async () => {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8);
    
    if (error) {
      console.error('Error fetching skills:', error);
      return;
    }
    
    // Fetch profile names for each skill
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      const skillsWithNames = data.map(skill => ({
        ...skill,
        owner_name: profileMap.get(skill.user_id) || 'Unknown'
      }));
      setDbSkills(skillsWithNames);
    } else {
      setDbSkills([]);
    }
  };

  const fetchDbActivities = async () => {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);
    
    if (error) {
      console.error('Error fetching activities:', error);
      return;
    }
    
    // Fetch profile names for each activity
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      const activitiesWithNames = data.map(activity => ({
        ...activity,
        owner_name: profileMap.get(activity.user_id) || 'Unknown'
      }));
      setDbActivities(activitiesWithNames);
    } else {
      setDbActivities([]);
    }
  };

  const scrollToSkills = () => {
    const skillsSection = document.getElementById('skills-section');
    skillsSection?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToActivities = () => {
    const activitiesSection = document.getElementById('activities-section');
    activitiesSection?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSignIn = () => {
    navigate('/auth');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    toast.success('Signed out successfully');
  };

  const handleGetStarted = () => {
    navigate('/auth');
  };

  const handleFindTalent = () => {
    scrollToSkills();
  };

  const handleBrowseActivities = () => {
    scrollToActivities();
  };

  const handleSkillClick = (skillId: string) => {
    navigate(`/skill/${skillId}`);
  };

  const handleCategoryClick = (categoryName: string) => {
    navigate(`/skills?category=${encodeURIComponent(categoryName)}`);
  };

  const handleActivityClick = (activityId: string) => {
    navigate(`/activity/${activityId}`);
  };

  const handleViewAllSkills = () => {
    navigate('/skills');
  };

  const handleExploreAll = () => {
    navigate('/activities');
  };

  const handleStartConnecting = () => {
    if (!user) {
      navigate('/auth');
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      navigate(`/${searchScope}?q=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm('');
    }
  };

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const userName = profile?.full_name || user?.user_metadata?.full_name || 'User';

  // Enable message notifications when user is logged in
  useMessageNotifications({ 
    userId: user?.id || null, 
    enabled: !!user && !showMessagesModal 
  });

  // Fetch and subscribe to unread message count
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnread = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false);
      if (!error && count !== null) setUnreadCount(count);
    };

    fetchUnread();

    // Subscribe to new incoming messages to bump the count in real time
    const channel = supabase
      .channel('home-unread-count')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => {
          if (!showMessagesModal) setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          if ((payload.new as any).read) setUnreadCount(prev => Math.max(0, prev - 1));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, showMessagesModal]);

  // Listen for openMessages event to open the modal
  useEffect(() => {
    const handleOpenMessages = () => {
      setShowMessagesModal(true);
    };

    window.addEventListener('openMessages', handleOpenMessages);
    return () => {
      window.removeEventListener('openMessages', handleOpenMessages);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />
      
      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="h-6 w-6 md:h-8 md:w-8 text-primary electric-pulse" />
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <span className="text-foreground">GTA</span>
                <Badge className="hidden sm:inline-flex bg-primary/15 text-primary border-primary/30 text-[10px] md:text-xs tracking-wider">RNSIT</Badge>
              </h1>
            </div>
            
            <div className="hidden md:flex items-center flex-1 max-w-md mx-8 gap-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={`Search ${searchScope}...`}
                  className="pl-10 bg-card border focus:border-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearch}
                />
              </div>
              <select
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value as typeof searchScope)}
                aria-label="Search in"
                className="text-xs bg-card border rounded-md px-2 py-2 text-muted-foreground focus:border-primary focus:outline-none"
              >
                <option value="skills">Skills</option>
                <option value="activities">Activities</option>
                <option value="people">People</option>
              </select>
            </div>

            <div className="flex items-center space-x-1 md:space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="text-muted-foreground hover:text-primary hover:bg-primary/10 p-2"
                aria-label="Toggle theme"
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              
              {user ? (
                <div className="flex items-center space-x-1 md:space-x-3">
                  <NotificationCenter userId={user?.id || null} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMessagesModal(true)}
                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 relative p-2"
                    aria-label="Messages"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <Badge 
                        className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center bg-accent text-accent-foreground"
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/user/${user?.id}`)}
                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 p-2"
                    aria-label="Profile"
                  >
                    <UserIcon className="h-4 w-4" />
                  </Button>
                  <div className="hidden md:block text-sm">
                    <span className="text-muted-foreground">Welcome, </span>
                    <span className="font-medium text-foreground">{userName.split(' ')[0]}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={handleSignOut}
                  >
                    <span className="hidden md:inline">Sign Out</span>
                    <span className="md:hidden">Out</span>
                  </Button>
                </div>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={handleSignIn}
                  >
                    <span className="hidden md:inline">Sign In</span>
                    <span className="md:hidden">In</span>
                  </Button>
                  <Button 
                    size="sm"
                    className="plasma-button text-primary-foreground"
                    onClick={handleGetStarted}
                  >
                    <span className="hidden md:inline">Get Started</span>
                    <span className="md:hidden">Start</span>
                  </Button>
                </>
              )}
            </div>
          </div>
          
          <div className="md:hidden mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={`Search ${searchScope}...`}
                className="pl-10 bg-card border focus:border-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
            <select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value as typeof searchScope)}
              aria-label="Search in"
              className="text-xs bg-card border rounded-md px-2 py-2 text-muted-foreground focus:border-primary focus:outline-none"
            >
              <option value="skills">Skills</option>
              <option value="activities">Activities</option>
              <option value="people">People</option>
            </select>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-8 md:py-16 px-4 relative z-10">
        <div className="container mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6 text-foreground">
            RNSIT Runs on Skills
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto px-4">
            The student-run skill exchange for RNS Institute of Technology — find talented
            RNSITians, offer what you're good at, and team up through campus activities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4 px-4">
            <Button 
              size="lg" 
              className="plasma-button text-primary-foreground w-full sm:w-auto"
              onClick={handleFindTalent}
            >
              <Users className="mr-2 h-5 w-5" />
              Find Talent
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-primary/30 text-foreground hover:bg-primary/10 w-full sm:w-auto"
              onClick={handleBrowseActivities}
            >
              <Calendar className="mr-2 h-5 w-5" />
              Browse Activities
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary/30 text-foreground hover:bg-primary/10 w-full sm:w-auto"
              onClick={() => navigate('/people')}
            >
              <UserIcon className="mr-2 h-5 w-5" />
              Meet People
            </Button>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills-section" className="py-8 md:py-12 px-4 relative z-10">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 space-y-2 sm:space-y-0">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground">Skills and Service</h3>
            <div className="flex items-center gap-2">
              {user && (
                <Button 
                  size="sm"
                  className="plasma-button text-primary-foreground"
                  onClick={() => setShowAddSkillModal(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Your Skill
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                className="text-primary hover:bg-primary/10"
                onClick={handleViewAllSkills}
              >
                View All →
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[140px] gap-4 md:gap-6">
            {skillCategories.map((category, index) => {
              const IconComponent = category.icon;
              const count = categoryCounts[category.name] || 0;
              const isHero = index === 0;
              return (
                <Card
                  key={category.name}
                  className={`crystal-card group transition-all duration-300 cursor-pointer flex flex-col justify-center ${isHero ? 'lg:col-span-2 lg:row-span-2' : ''}`}
                  onClick={() => handleCategoryClick(category.name)}
                >
                  <CardHeader className="pb-2 md:pb-3 relative z-10">
                    <div className={`rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-2 md:mb-3 transition-all duration-300 ${isHero ? 'w-14 h-14' : 'w-10 h-10 md:w-12 md:h-12'}`}>
                      <IconComponent className={isHero ? 'h-7 w-7 text-primary' : 'h-5 w-5 md:h-6 md:w-6 text-primary'} />
                    </div>
                    <CardTitle className={isHero ? 'text-xl md:text-2xl text-foreground' : 'text-base md:text-lg text-foreground'}>{category.name}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {count > 0
                        ? `${count} skill${count === 1 ? '' : 's'} offered`
                        : 'Be the first to offer'}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          {/* User-added skills from database */}
          {dbSkills.length > 0 && (
            <div className="mt-8">
              <h4 className="text-xl font-semibold mb-4 text-foreground">Recently Added by Students</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dbSkills.slice(0, 4).map((skill) => (
                  <Card
                    key={skill.id}
                    className="crystal-card group hover:scale-[1.02] transition-all duration-300 cursor-pointer"
                    onClick={() => handleSkillClick(skill.id)}
                  >
                    <CardHeader className="pb-2 md:pb-3 relative z-10">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-2 md:mb-3 shadow-glow">
                        <Code className="h-5 w-5 md:h-6 md:w-6 text-accent" />
                      </div>
                      <CardTitle className="text-base md:text-lg text-foreground">{skill.title}</CardTitle>
                      <CardDescription className="text-sm line-clamp-2 text-muted-foreground">
                        {skill.description}
                      </CardDescription>
                      <Badge className="w-fit mt-2 bg-primary/20 text-primary border-primary/30">
                        {skill.category}
                      </Badge>
                      <p 
                        className="text-xs text-muted-foreground mt-1 hover:text-primary cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (skill.user_id) navigate(`/user/${skill.user_id}`);
                        }}
                      >
                        by {skill.owner_name || 'Anonymous'}
                      </p>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Campus Pulse — live stats + top contributors */}
      <CampusPulse />

      {/* Activities Section */}
      <section id="activities-section" className="py-8 md:py-12 px-4 relative z-10">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 space-y-2 sm:space-y-0">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground">Activity and Events</h3>
            <div className="flex items-center gap-2">
              {user && (
                <Button 
                  size="sm"
                  className="plasma-button text-primary-foreground"
                  onClick={() => setShowAddActivityModal(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Activity
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                className="text-primary hover:bg-primary/10"
                onClick={handleExploreAll}
              >
                Explore All →
              </Button>
            </div>
          </div>
          
          {dbActivities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {dbActivities.slice(0, 6).map((activity) => (
                <Card
                  key={activity.id}
                  className="crystal-card group hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden"
                  onClick={() => handleActivityClick(activity.id)}
                >
                  <div className="h-24 relative bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 flex items-center justify-center">
                    <Calendar className="h-10 w-10 text-primary/70 group-hover:scale-110 transition-all duration-300" />
                    <Badge className="absolute top-3 right-3 text-xs bg-accent/20 text-accent border-accent/30">
                      {activity.category}
                    </Badge>
                  </div>
                  <CardHeader className="relative z-10">
                    <CardTitle className="text-lg md:text-xl text-foreground">{activity.title}</CardTitle>
                    <CardDescription className="text-sm line-clamp-2 text-muted-foreground">{activity.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 relative z-10">
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-primary" /> {activity.date} at {activity.time}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Globe className="h-3 w-3 text-accent" /> {activity.venue}
                      </p>
                      <p
                        className="text-xs text-muted-foreground hover:text-primary cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activity.user_id) navigate(`/user/${activity.user_id}`);
                        }}
                      >
                        Organized by {activity.owner_name || 'Anonymous'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="crystal-card">
              <CardContent className="py-12 text-center">
                <Calendar className="h-10 w-10 text-primary/50 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-foreground mb-2">No campus events yet</h4>
                <p className="text-muted-foreground mb-4">Be the first RNSITian to organize something.</p>
                {user ? (
                  <Button className="plasma-button text-primary-foreground" onClick={() => setShowAddActivityModal(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add the First Activity
                  </Button>
                ) : (
                  <Button className="plasma-button text-primary-foreground" onClick={handleSignIn}>
                    Sign In to Add One
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="py-12 md:py-16 px-4 relative z-10">
          <div className="container mx-auto text-center">
            <div className="crystal-card p-8 md:p-12 max-w-2xl mx-auto">
              <h3 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                Ready to Connect?
              </h3>
              <p className="text-muted-foreground mb-6 md:mb-8 max-w-xl mx-auto">
                Every RNSITian is good at something. Put your skill on the board, find the
                people you need, and build things together — all inside campus.
              </p>
              <Button 
                size="lg" 
                className="plasma-button text-primary-foreground"
                onClick={handleStartConnecting}
              >
                Start Connecting Today
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Modals */}
      <MessagesModal 
        isOpen={showMessagesModal} 
        onClose={() => setShowMessagesModal(false)}
        currentUser={user ? { id: user.id, fullName: userName } : null}
      />
      
      <AddSkillModal 
        isOpen={showAddSkillModal} 
        onClose={() => setShowAddSkillModal(false)}
        onSkillAdded={fetchDbSkills}
      />
      
      <AddActivityModal 
        isOpen={showAddActivityModal} 
        onClose={() => setShowAddActivityModal(false)}
        onActivityAdded={fetchDbActivities}
      />
    </div>
  );
};

export default Home;
