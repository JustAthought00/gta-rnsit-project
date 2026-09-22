import { Search, Users, Calendar, Zap, Code, Camera, Music, Palette, PenTool, Video, Mic, Briefcase, Globe, TrendingUp, Moon, Sun, MessageCircle, Plus, User as UserIcon, ChevronLeft, ChevronRight, Menu, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
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
import Footer from './Footer';
import Watermark from './Watermark';
import type { Tables } from '@/integrations/supabase/types';

const useDragScroll = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const movedRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    movedRef.current = false;
    el.setPointerCapture(e.pointerId);
    el.dataset.startX = String(e.clientX);
    el.dataset.scrollLeft = String(el.scrollLeft);
    el.dataset.smoothBefore = el.style.scrollBehavior;
    el.style.scrollBehavior = 'auto';
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || el.dataset.startX === undefined) return;
    const dx = e.clientX - Number(el.dataset.startX);
    if (Math.abs(dx) > 4) movedRef.current = true;
    el.scrollLeft = Number(el.dataset.scrollLeft) - dx;
  };

  const endDrag = () => {
    const el = ref.current;
    if (!el) return;
    el.style.scrollBehavior = el.dataset.smoothBefore || '';
    delete el.dataset.smoothBefore;
    delete el.dataset.startX;
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (movedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
      style: { touchAction: 'pan-y' },
      className: 'cursor-grab active:cursor-grabbing',
    } as const,
  };
};

const Home = () => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const skillsDrag = useDragScroll();
  const activitiesDrag = useDragScroll();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'skills' | 'activities' | 'people'>('skills');
  const [dbActivities, setDbActivities] = useState<(Tables<'activities'> & { host_name: string; host_avatar: string | null })[]>([]);
  const [dbFeatured, setDbFeatured] = useState<(Tables<'skills'> & { kind: string; owner_name: string; owner_avatar: string | null; owner_banner: string | null; demand_count: number })[]>([]);
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
    let profileTimeout: number | undefined;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Cancel any pending fetch from a previous sign-in before fetching again
        if (profileTimeout) clearTimeout(profileTimeout);
        profileTimeout = window.setTimeout(() => {
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
        if (profileTimeout) clearTimeout(profileTimeout);
        profileTimeout = window.setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (profileTimeout) clearTimeout(profileTimeout);
    };
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
    fetchFeatured();
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

  const fetchFeatured = async () => {
    const [skillsRes, reviewsRes] = await Promise.all([
      supabase.from('skills').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('reviews').select('target_id').eq('target_type', 'skill'),
    ]);

    if (skillsRes.error) console.error('Error fetching skills:', skillsRes.error);

    // Real demand signal for skills: review count (public to everyone via RLS).
    const reviewCounts: Record<string, number> = {};
    (reviewsRes.data || []).forEach(({ target_id }) => {
      if (target_id) reviewCounts[target_id] = (reviewCounts[target_id] || 0) + 1;
    });

    const profileMap = new Map<string, { name: string; avatar: string | null; banner: string | null }>();
    const uniqueIds = [...new Set((skillsRes.data || []).map(s => s.user_id))];
    if (uniqueIds.length > 0) {
      // banner_url only exists once the profile_banners migration is applied; if the
      // query fails (column missing on the live DB) retry without it so owner names
      // still resolve instead of falling back to "Unknown".
      let profiles: { user_id: string; full_name: string; avatar_url: string | null; email?: string; banner_url?: string | null }[] | null = null;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email, banner_url')
        .in('user_id', uniqueIds);
      if (!error) {
        profiles = data;
      } else {
        const { data: fallback } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', uniqueIds);
        profiles = fallback;
      }
      (profiles || []).forEach(p =>
        profileMap.set(p.user_id, {
          name: p.full_name || p.email?.split('@')[0] || 'RNSITian',
          avatar: p.avatar_url,
          banner: p.banner_url || null,
        })
      );
    }

    const rankedSkills = (skillsRes.data || [])
      .map(skill => ({
        ...skill,
        kind: 'skill',
        owner_name: profileMap.get(skill.user_id)?.name || 'RNSITian',
        owner_avatar: profileMap.get(skill.user_id)?.avatar || null,
        owner_banner: profileMap.get(skill.user_id)?.banner || null,
        demand_count: reviewCounts[skill.id] || 0,
      }))
      .sort((a, b) =>
        (b.demand_count - a.demand_count) ||
        (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );

    setDbFeatured(rankedSkills.slice(0, 6));
  };

  const fetchDbActivities = async () => {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (error) {
      console.error('Error fetching activities:', error);
      return;
    }

    // Hide events pending approval and events past their registration deadline
    const visible = (data || []).filter((a) => {
      const approved = !a.approval_status || a.approval_status === 'approved';
      const notExpired = !a.deadline || new Date(a.deadline).getTime() > Date.now();
      return approved && notExpired;
    }).slice(0, 6);

    // Fetch profile names for each activity
    if (visible.length > 0) {
      const userIds = [...new Set(visible.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, { name: p.full_name, avatar: p.avatar_url }]) || []);
      const activitiesWithNames = visible.map(activity => ({
        ...activity,
        host_name: activity.organizer_type === 'group'
          ? (activity.group_name || 'Unknown')
          : (profileMap.get(activity.user_id)?.name || 'Unknown'),
        host_avatar: activity.organizer_type === 'group'
          ? null
          : (profileMap.get(activity.user_id)?.avatar || null)
      }));
      setDbActivities(activitiesWithNames);
    } else {
      setDbActivities([]);
    }
  };

  const skillsRowRef = useRef<HTMLDivElement | null>(null);
  const activitiesRowRef = useRef<HTMLDivElement | null>(null);

  const scrollSkillsRow = (direction: 'left' | 'right') => {
    skillsRowRef.current?.scrollBy({
      left: direction === 'right' ? 320 : -320,
      behavior: 'smooth',
    });
  };

  const scrollActivitiesRow = (direction: 'left' | 'right') => {
    activitiesRowRef.current?.scrollBy({
      left: direction === 'right' ? 380 : -380,
      behavior: 'smooth',
    });
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
          if ((payload.new as { read: boolean | null }).read) setUnreadCount(prev => Math.max(0, prev - 1));
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
    <div className="min-h-screen bg-transparent relative">
      <NebulaBackground />
      
      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="h-7 w-7 md:h-9 md:w-9 text-primary electric-pulse" />
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">GTA</span>
                <span className="hidden sm:inline-flex items-center text-[10px] md:text-xs tracking-wider text-muted-foreground">RNSIT</span>
              </h1>
            </div>
            
            <div className="hidden md:flex items-center flex-1 max-w-md mx-8 gap-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={`Search ${searchScope}...`}
                  className="header-glow-field pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearch}
                />
              </div>
              <select
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value as typeof searchScope)}
                aria-label="Search in"
                className="header-glow-field text-sm font-medium border rounded-md px-3 py-2.5 cursor-pointer focus:outline-none"
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
                className="header-glow-btn p-2"
                aria-label="Toggle theme"
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {user ? (
                <>
                <NotificationCenter userId={user?.id || null} />
                <div className="hidden xl:flex items-center gap-1 mx-2">
                  <Button variant="ghost" size="sm" className="header-glow-btn" onClick={() => navigate('/skills')}>Skills</Button>
                  <Button variant="ghost" size="sm" className="header-glow-btn" onClick={() => navigate('/activities')}>Activities</Button>
                  <Button variant="ghost" size="sm" className="header-glow-btn" onClick={() => navigate('/people')}>People</Button>
                  <Button variant="ghost" size="sm" className="header-glow-btn" onClick={() => navigate('/communities')}>Communities</Button>
                  <Button variant="ghost" size="sm" className="header-glow-btn" onClick={() => navigate('/teachers')}>Faculty</Button>
                  {profile?.role === 'teacher' && (
                    <Button variant="ghost" size="sm" className="header-glow-btn text-primary" onClick={() => navigate('/manage')}>Manage</Button>
                  )}
                </div>

                <div className="hidden md:flex items-center space-x-1 md:space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMessagesModal(true)}
                    className="header-glow-btn relative p-2"
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
                    className="header-glow-btn p-2"
                    aria-label="Profile"
                  >
                    <UserIcon className="h-4 w-4" />
                  </Button>
                  <div className="hidden lg:block text-sm">
                    <span className="text-muted-foreground">Welcome, </span>
                    <span className="font-medium text-foreground">{userName.split(' ')[0]}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="header-glow-btn"
                    onClick={handleSignOut}
                  >
                    <span className="hidden lg:inline">Sign Out</span>
                    <LogOut className="lg:hidden h-4 w-4" />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="header-glow-btn md:hidden p-2"
                  aria-label="Menu"
                  onClick={() => setIsMenuOpen((open) => !open)}
                >
                  {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
                </>
              ) : (
                <>
                  <div className="hidden md:flex items-center space-x-1 md:space-x-3">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="header-glow-btn"
                      onClick={handleSignIn}
                    >
                      Sign In
                    </Button>
                    <Button 
                      size="sm"
                      className="plasma-button text-primary-foreground"
                      onClick={handleGetStarted}
                    >
                      Get Started
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="header-glow-btn md:hidden p-2"
                    aria-label="Menu"
                    onClick={() => setIsMenuOpen((open) => !open)}
                  >
                    {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
                className="header-glow-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
            <select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value as typeof searchScope)}
              aria-label="Search in"
              className="header-glow-field text-sm font-medium border rounded-md px-3 py-2.5 cursor-pointer focus:outline-none"
            >
              <option value="skills">Skills</option>
              <option value="activities">Activities</option>
              <option value="people">People</option>
            </select>
          </div>

          {isMenuOpen && (
            <div className="md:hidden mt-3 pt-3 border-t border-border/40 flex flex-col gap-1 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              {[
                { label: 'Home', path: '/' },
                { label: 'Skills', path: '/skills' },
                { label: 'Activities', path: '/activities' },
                { label: 'People', path: '/people' },
                { label: 'Communities', path: '/communities' },
                { label: 'Faculty', path: '/teachers' },
              ].map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  className="justify-start header-glow-btn"
                  onClick={() => { setIsMenuOpen(false); navigate(item.path); }}
                >
                  {item.label}
                </Button>
              ))}
              {profile?.role === 'teacher' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start header-glow-btn text-primary"
                  onClick={() => { setIsMenuOpen(false); navigate('/manage'); }}
                >
                  Manage
                </Button>
              )}

              <div className="h-px bg-border/60 my-1" />

              {user ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start header-glow-btn"
                    onClick={() => { setIsMenuOpen(false); setShowMessagesModal(true); }}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Messages
                    {unreadCount > 0 && (
                      <Badge className="ml-auto h-5 min-w-5 px-1 text-xs bg-accent text-accent-foreground">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start header-glow-btn"
                    onClick={() => { setIsMenuOpen(false); navigate(`/user/${user?.id}`); }}
                  >
                    <UserIcon className="h-4 w-4 mr-2" />
                    My Profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start header-glow-btn text-destructive"
                    onClick={() => { setIsMenuOpen(false); handleSignOut(); }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start header-glow-btn"
                    onClick={() => { setIsMenuOpen(false); handleSignIn(); }}
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    className="justify-start plasma-button text-primary-foreground"
                    onClick={() => { setIsMenuOpen(false); handleGetStarted(); }}
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 md:py-20 lg:py-28 px-4 relative overflow-hidden z-10">
<Watermark icon={Zap} className="left-[8%] top-[7%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-12" />
        <Watermark icon={Calendar} color="violet" className="left-[24%] top-[12%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[18deg]" />
        <Watermark icon={Code} className="left-[47%] top-[6%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rotate-6" />
        <Watermark icon={Music} color="pink" className="left-[70%] top-[10%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg]" />
        <Watermark icon={Briefcase} color="cyan" className="left-[92%] top-[6%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-[35deg]" />
        <Watermark icon={PenTool} color="cyan" className="left-[13%] top-[32%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rotate-45" />
        <Watermark icon={Globe} color="accent" className="left-[34%] top-[26%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-[12deg]" />
        <Watermark icon={Camera} className="left-[58%] top-[34%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-[12deg]" />
        <Watermark icon={Mic} color="secondary" className="left-[64%] top-[20%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[15deg]" />
        <Watermark icon={Globe} className="left-[82%] top-[28%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg]" />
        <Watermark icon={TrendingUp} className="left-[6%] top-[55%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-[8deg]" />
        <Watermark icon={Palette} color="violet" className="left-[26%] top-[48%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rotate-90" />
        <Watermark icon={MessageCircle} color="secondary" strokeWidth={0.75} className="left-[50%] top-[52%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[18deg]" />
        <Watermark icon={TrendingUp} color="pink" className="left-[43%] top-[65%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[30deg]" />
        <Watermark icon={Video} color="cyan" className="left-[74%] top-[46%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-[12deg]" />
        <Watermark icon={Camera} color="violet" className="left-[94%] top-[58%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rotate-45" />
        <Watermark icon={Globe} color="accent" className="left-[10%] top-[78%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-[6deg]" />
        <Watermark icon={Music} color="pink" className="left-[33%] top-[74%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg]" />
        <Watermark icon={Zap} className="left-[56%] top-[80%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-[12deg]" />
        <Watermark icon={PenTool} color="accent" className="left-[88%] top-[76%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-[6deg]" />
        <Watermark icon={Code} className="left-[6%] top-[95%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-45" />
        <Watermark icon={Globe} className="left-[28%] top-[94%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-[6deg]" />
        <Watermark icon={Zap} color="accent" className="left-[51%] top-[94%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-[12deg]" />
        <Watermark icon={Briefcase} color="cyan" className="left-[78%] top-[96%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 -rotate-45" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="hidden md:flex absolute top-20 left-10 w-16 h-16 rounded-full bg-primary/50 backdrop-blur-lg items-center justify-center animate-float-slow border border-primary/40 shadow-[0_0_30px_rgba(59,130,246,0.55)]">
            <Code className="h-8 w-8 text-primary-foreground drop-shadow-[0_0_8px_rgba(59,130,246,0.9)]" />
          </div>
          <div className="absolute top-16 md:top-32 right-4 md:right-20 w-12 md:w-14 h-12 md:h-14 rounded-full bg-accent/50 backdrop-blur-lg flex items-center justify-center animate-float-delayed border border-accent/40 shadow-[0_0_30px_rgba(168,85,247,0.55)]">
            <Camera className="h-6 md:h-7 w-6 md:w-7 text-accent-foreground drop-shadow-[0_0_8px_rgba(168,85,247,0.9)]" />
          </div>
          <div className="hidden md:flex absolute bottom-32 left-10 w-16 h-16 rounded-full bg-secondary/60 backdrop-blur-lg items-center justify-center animate-float-pen border border-secondary-foreground/30 shadow-[0_0_30px_rgba(100,116,139,0.55)]">
            <PenTool className="h-8 w-8 text-secondary-foreground drop-shadow-[0_0_8px_rgba(100,116,139,0.9)]" />
          </div>
          <div className="absolute top-24 md:top-40 right-8 md:right-40 w-10 md:w-12 h-10 md:h-12 rounded-full bg-primary/45 backdrop-blur-lg flex items-center justify-center animate-float-slow border border-primary/40 shadow-[0_0_25px_rgba(59,130,246,0.5)]">
            <Palette className="h-5 md:h-6 w-5 md:w-6 text-primary-foreground drop-shadow-[0_0_6px_rgba(59,130,246,0.9)]" />
          </div>
          <div className="absolute bottom-20 md:bottom-40 right-6 md:right-16 w-12 md:w-14 h-12 md:h-14 rounded-full bg-accent/45 backdrop-blur-lg flex items-center justify-center animate-float-delayed border border-accent/40 shadow-[0_0_25px_rgba(168,85,247,0.5)]">
            <Video className="h-6 md:h-7 w-6 md:w-7 text-accent-foreground drop-shadow-[0_0_6px_rgba(168,85,247,0.9)]" />
          </div>
          <div className="hidden md:flex absolute top-60 left-48 w-12 h-12 rounded-full bg-primary/45 backdrop-blur-lg items-center justify-center animate-float-mic border border-primary/40 shadow-[0_0_25px_rgba(59,130,246,0.5)]">
            <Mic className="h-6 w-6 text-primary-foreground drop-shadow-[0_0_6px_rgba(59,130,246,0.9)]" />
          </div>
        </div>

        <div className="container mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-5 md:mb-7 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            RNSIT Runs on Skills
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 md:mb-9 max-w-3xl mx-auto px-4">
            The student-run skill exchange for RNS Institute of Technology — find talented
            RNSITians, offer what you're good at, and team up through campus activities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 px-4">
            <Button 
              size="lg" 
              className="plasma-button text-primary-foreground w-full sm:w-auto h-14 px-10 text-base"
              onClick={handleFindTalent}
            >
              <Users className="mr-2 h-5 w-5" />
              Find Talent
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-primary/30 text-foreground hover:bg-primary/10 hover:text-foreground w-full sm:w-auto h-14 px-10 text-base"
              onClick={handleBrowseActivities}
            >
              <Calendar className="mr-2 h-5 w-5" />
              Browse Activities
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary/30 text-foreground hover:bg-primary/10 hover:text-foreground w-full sm:w-auto h-14 px-10 text-base"
              onClick={() => navigate('/people')}
            >
              <UserIcon className="mr-2 h-5 w-5" />
              Meet People
            </Button>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills-section" className="section-band overflow-hidden relative py-8 md:py-10 px-4">
        <div className="container mx-auto">
          <div className="glow-blob glow-blob-cyan h-64 w-64 left-[6%] top-[18%]" />
          <div className="glow-blob glow-blob-violet h-72 w-72 left-[30%] top-[10%]" style={{ animationDelay: '-4s' }} />
          <div className="glow-blob glow-blob-pink h-56 w-56 left-[78%] top-[22%]" style={{ animationDelay: '-8s' }} />
          <div className="glow-blob glow-blob-violet h-60 w-60 right-[6%] top-[58%]" style={{ animationDelay: '-12s' }} />
          <div className="glow-blob glow-blob-cyan h-72 w-72 left-[16%] bottom-[8%]" style={{ animationDelay: '-6s' }} />
          <div className="glow-blob glow-blob-pink h-56 w-56 right-[22%] bottom-[14%]" style={{ animationDelay: '-2s' }} />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-5 space-y-2 sm:space-y-0">
            <h3 className="text-xl md:text-2xl font-bold text-foreground">Skills and Service</h3>
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
                className="text-primary hover:bg-primary/10 hover:text-primary"
                onClick={handleViewAllSkills}
              >
                View All →
              </Button>
            </div>
          </div>
          
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {skillCategories.map((category) => {
              const IconComponent = category.icon;
              const count = categoryCounts[category.name] || 0;
              return (
<Card
                    key={category.name}
className="crystal-card cursor-pointer"
                    onClick={() => handleCategoryClick(category.name)}
                  >
                  <CardHeader className="p-4 md:p-6 relative z-10">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center mb-2.5 md:mb-3 shadow-glow">
                      <IconComponent className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                    </div>
                    <CardTitle className="text-base md:text-lg font-semibold text-foreground">{category.name}</CardTitle>
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

{/* Actual skills & services offered by individuals, ranked by demand */}
          {dbFeatured.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Most In Demand</h4>
                  <p className="text-xs text-muted-foreground">Trending skills &amp; services offered by your peers</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 md:h-8 md:w-8 rounded-full border-primary/30 bg-background/40 text-primary hover:bg-primary/10"
                    onClick={() => scrollSkillsRow('left')}
                    aria-label="Scroll featured left"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 md:h-8 md:w-8 rounded-full border-primary/30 bg-background/40 text-primary hover:bg-primary/10"
                    onClick={() => scrollSkillsRow('right')}
                    aria-label="Scroll featured right"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div
                ref={skillsRowRef}
                {...skillsDrag.handlers}
                className={`relative z-10 flex gap-3 md:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 no-scrollbar ${skillsDrag.handlers.className}`}
              >
                {dbFeatured.map((skill, index) => (
                  <Card
                    key={`skill-${skill.id}`}
                    className="crystal-card group transition-colors duration-300 hover:border-primary/30 hover:bg-primary/[0.02] cursor-pointer w-[240px] md:w-[240px] shrink-0 snap-start"
                    onClick={() => handleSkillClick(skill.id)}
                  >
                    {skill.owner_banner ? (
                      <div className="absolute inset-y-0 right-0 w-3/5 md:w-2/3 overflow-hidden" aria-hidden>
                        <img
                          src={skill.owner_banner}
                          alt=""
                          className="w-full h-full object-cover object-center pointer-events-none"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-l from-background/10 via-background/40 to-background" />
                      </div>
                    ) : null}
                    <CardHeader className="pb-2 md:pb-3 relative z-10">
                      <div className="flex items-center justify-between gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-accent/30 to-primary/30 flex items-center justify-center mb-1.5 md:mb-2 shadow-glow">
                          <Code className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                        </div>
                        <Button
                          variant="ghost"
                          className="h-9 px-2 -mx-2 max-w-[120px] text-xs text-muted-foreground justify-end hover:bg-transparent hover:text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (skill.user_id) navigate(`/user/${skill.user_id}`);
                          }}
                        >
                          <span className="truncate">{skill.owner_name || 'Anonymous'}</span>
                          <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
                            <AvatarImage src={skill.owner_avatar || undefined} alt={skill.owner_name} />
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">
                              {(skill.owner_name || 'U').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </Button>
                      </div>
                      <CardTitle className="text-sm md:text-base text-foreground">{skill.title}</CardTitle>
                      <CardDescription className="text-xs line-clamp-2 text-muted-foreground">
                        {skill.description}
                      </CardDescription>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge className="w-fit bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 hover:text-primary">
                            {skill.category}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-2 justify-self-start hover:bg-secondary hover:text-secondary-foreground">
                            #{index + 1} {skill.demand_count > 0
                              ? `· ${skill.demand_count} review${skill.demand_count === 1 ? '' : 's'}`
                              : '· new'}
                          </Badge>
                        </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Campus Pulse — live stats + top contributors */}
      <section id="campus-pulse" className="py-4 md:py-6 px-4 relative overflow-hidden z-10 scroll-mt-20">
        <CampusPulse />
      </section>

      {/* Activities Section */}
      <section id="activities-section" className="section-band overflow-hidden relative py-8 md:py-12 px-4">
        <div className="container mx-auto">
          <Watermark icon={Calendar} className="left-[8%] top-[8%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rotate-[12deg]" />
          <Watermark icon={Globe} className="left-[38%] top-[12%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg]" />
          <Watermark icon={Briefcase} className="left-[66%] top-[7%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-6" />
          <Watermark icon={Camera} className="left-[92%] top-[10%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg]" />
          <Watermark icon={MessageCircle} className="left-[6%] top-[35%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-[8deg]" />
          <Watermark icon={Music} className="left-[32%] top-[30%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-90" />
          <Watermark icon={PenTool} className="left-[60%] top-[34%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg]" />
          <Watermark icon={TrendingUp} className="left-[88%] top-[31%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-[18deg]" />
          <Watermark icon={Zap} className="left-[12%] top-[62%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[30deg]" />
          <Watermark icon={Code} className="left-[42%] top-[66%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-45" />
          <Watermark icon={Briefcase} className="left-[72%] top-[58%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[12deg]" />
          <Watermark icon={Music} className="left-[96%] top-[66%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-[40deg]" />
          <Watermark icon={Camera} className="left-[7%] top-[90%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-45" />
          <Watermark icon={Video} className="left-[40%] top-[88%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-[6deg]" />
          <Watermark icon={Globe} className="left-[66%] top-[93%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[24deg]" />
          <Watermark icon={PenTool} className="left-[92%] top-[89%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rotate-6" />
<div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 space-y-2 sm:space-y-0">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground">Activity and Events</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 md:h-8 md:w-8 rounded-full border-primary/30 bg-background/40 text-primary hover:bg-primary/10"
                    onClick={() => scrollActivitiesRow('left')}
                    aria-label="Scroll activities left"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 md:h-8 md:w-8 rounded-full border-primary/30 bg-background/40 text-primary hover:bg-primary/10"
                    onClick={() => scrollActivitiesRow('right')}
                    aria-label="Scroll activities right"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
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
                className="text-primary hover:bg-primary/10 hover:text-primary"
                onClick={handleExploreAll}
              >
                Explore All →
              </Button>
            </div>
          </div>
          
          {dbActivities.length > 0 ? (
            <div
              ref={activitiesRowRef}
              {...activitiesDrag.handlers}
              className={`relative z-10 flex gap-5 md:gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 no-scrollbar ${activitiesDrag.handlers.className}`}
            >
              {dbActivities.slice(0, 6).map((activity) => (
                <Card
                  key={activity.id}
                  className="crystal-card group transition-all duration-300 cursor-pointer overflow-hidden w-[300px] md:w-[360px] shrink-0 snap-start"
                  onClick={() => handleActivityClick(activity.id)}
                >
                  <div className={`h-32 md:h-40 relative flex items-center justify-center ${activity.photo_url ? '' : 'bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10'}`}>
                    {activity.photo_url ? (
                      <img
                        src={activity.photo_url}
                        alt={activity.title || 'Activity'}
                        className="w-full h-full object-cover pointer-events-none"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <Calendar className="h-12 w-12 md:h-14 md:w-14 text-primary/70 group-hover:scale-110 transition-all duration-300" />
                    )}
                    <Badge className="absolute top-2.5 right-2.5 text-xs bg-accent/20 text-accent border-accent/30 px-2.5 py-0.5 hover:bg-accent/20 hover:text-accent">
                      {activity.category}
                    </Badge>
                  </div>
                  <CardHeader className="relative z-10 pb-2 pt-4">
                    <CardTitle className="text-lg md:text-xl mb-1 text-foreground">{activity.title}</CardTitle>
                    <CardDescription className="text-sm md:text-base line-clamp-2 text-muted-foreground">{activity.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-1 pb-4 relative z-10">
                    <div className="space-y-2 text-sm md:text-base">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-primary shrink-0" /> {activity.date}
                        {activity.time ? ` at ${activity.time}` : ''}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Globe className="h-4 w-4 text-accent shrink-0" /> {activity.venue}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <p
                          className="text-xs md:text-sm text-muted-foreground cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activity.user_id) navigate(`/user/${activity.user_id}`);
                          }}
                        >
                          {activity.organizer_type !== 'group'
                            ? `Organized by ${activity.host_name || 'Anonymous'}`
                            : `Hosted by ${activity.host_name || 'the club'}`}
                        </p>
                        {activity.organizer_type !== 'group' && (
                          <Avatar className="h-5 w-5 border border-primary/30 shrink-0">
                            <AvatarImage src={activity.host_avatar || undefined} alt={activity.host_name || 'Organizer'} />
                            <AvatarFallback className="bg-primary/20 text-primary text-[9px]">
                              {(activity.host_name || 'U').charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
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

        {!user && (
          <div className="container mx-auto text-center relative z-10 py-8 md:py-10">
            <div className="crystal-card p-6 md:p-10 max-w-4xl mx-auto">
              <h3 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Ready to Connect?
              </h3>
              <p className="text-muted-foreground mb-5 max-w-2xl mx-auto text-sm md:text-base">
                Every RNSITian is good at something. Put your skill on the board, find the
                people you need, and build things together — all inside campus.
              </p>
              <Button
                size="sm"
                className="plasma-button text-primary-foreground"
                onClick={handleStartConnecting}
              >
                Start Connecting Today
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Footer — info & contact */}
      <Footer />

      {/* Modals */}
      <MessagesModal 
        isOpen={showMessagesModal} 
        onClose={() => setShowMessagesModal(false)}
        currentUser={user ? { id: user.id, fullName: userName } : null}
      />
      
      <AddSkillModal 
        isOpen={showAddSkillModal} 
        onClose={() => setShowAddSkillModal(false)}
        onSkillAdded={fetchFeatured}
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
