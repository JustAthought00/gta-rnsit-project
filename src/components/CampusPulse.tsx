import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Zap, Calendar, Users, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Contributor {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  skillCount: number;
  activityCount: number;
  total: number;
}

interface PulseStats {
  students: number;
  skills: number;
  events: number;
  reviews: number;
}

// Live campus stats + top contributors, computed entirely from real database rows
const CampusPulse = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PulseStats | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);

  useEffect(() => {
    const fetchPulse = async () => {
      const [skillsRes, activitiesRes, reviewsRes] = await Promise.all([
        supabase.from('skills').select('user_id'),
        supabase.from('activities').select('user_id, approval_status, deadline'),
        supabase.from('reviews').select('id'),
      ]);

      // banner_url only exists once the profile_banners migration is applied; if the
      // query fails (column missing on the live DB) retry without it.
      let profiles: { user_id: string; full_name: string; avatar_url: string | null; banner_url?: string | null }[] = [];
      const { data: profilesWithBanner, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, banner_url');
      if (!error) {
        profiles = profilesWithBanner || [];
      } else {
        const { data: fallback } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url');
        profiles = fallback || [];
      }
      const skills = skillsRes.data || [];
      const allActivities = activitiesRes.data || [];
      const reviews = reviewsRes.data || [];

      // Only count approved activities that haven't passed their deadline
      const now = Date.now();
      const activities = allActivities.filter(a =>
        (a.approval_status === null || a.approval_status === 'approved') &&
        (!a.deadline || new Date(a.deadline).getTime() > now)
      );

      setStats({
        students: profiles.length,
        skills: skills.length,
        events: activities.length,
        reviews: reviews.length,
      });

      // Rank students by contributions (skills + activities posted)
      const counts = new Map<string, { skillCount: number; activityCount: number }>();
      skills.forEach(({ user_id }) => {
        const entry = counts.get(user_id) || { skillCount: 0, activityCount: 0 };
        entry.skillCount += 1;
        counts.set(user_id, entry);
      });
      activities.forEach(({ user_id }) => {
        const entry = counts.get(user_id) || { skillCount: 0, activityCount: 0 };
        entry.activityCount += 1;
        counts.set(user_id, entry);
      });

      const profileMap = new Map(profiles.map(p => [p.user_id, p]));
      const ranked: Contributor[] = [...counts.entries()]
        .map(([userId, c]) => ({
          userId,
          fullName: profileMap.get(userId)?.full_name || 'Anonymous',
          avatarUrl: profileMap.get(userId)?.avatar_url || null,
          bannerUrl: profileMap.get(userId)?.banner_url || null,
          skillCount: c.skillCount,
          activityCount: c.activityCount,
          total: c.skillCount + c.activityCount,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setContributors(ranked);
    };

    fetchPulse();
  }, []);

  // Nothing to show until there is real campus data
  if (!stats) return null;

  const statTiles = [
    { label: 'Students', value: stats.students, icon: Users },
    { label: 'Skills Offered', value: stats.skills, icon: Zap },
    { label: 'Campus Events', value: stats.events, icon: Calendar },
    { label: 'Reviews Given', value: stats.reviews, icon: Star },
  ];

  const rankStyles = [
    'bg-yellow-500/20 text-yellow-500 border-yellow-500/40',
    'bg-slate-400/20 text-slate-300 border-slate-400/40',
    'bg-amber-700/20 text-amber-600 border-amber-700/40',
  ];

  return (
    <section className="py-1 md:py-2 px-4 relative z-10">
      <div className="container mx-auto">
        <div className="flex items-center gap-1.5 mb-1.5 md:mb-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-base md:text-lg font-bold text-foreground">Campus Pulse</h3>
          <Badge className="bg-primary/15 text-primary border-primary/30 text-xs hover:bg-primary/15 hover:text-primary">Live</Badge>
        </div>

        {/* Real-time stats — straight from the database */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-3">
          {statTiles.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="crystal-card">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center shadow-glow shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Top contributors leaderboard */}
        {contributors.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Top Contributors</h4>
            </div>
            <div className="max-h-[340px] overflow-y-auto pr-2 space-y-2 [scrollbar-width:thin]">
              {contributors.map((c, i) => (
                <Card
                  key={c.userId}
                  className="crystal-card cursor-pointer relative overflow-hidden w-full shrink-0"
                  onClick={() => navigate(`/user/${c.userId}`)}
                >
                  {c.bannerUrl && (
                    <div className="absolute inset-y-0 right-0 w-2/3 overflow-hidden" aria-hidden>
                      <img
                        src={c.bannerUrl}
                        alt=""
                        className="w-full h-full object-cover object-center pointer-events-none"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-l from-background/10 via-background/40 to-background" />
                    </div>
                  )}
                  <CardContent className="relative z-10 p-3 flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                        rankStyles[i] || 'bg-primary/10 text-primary border-primary/30'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <Avatar className="h-10 w-10 border border-primary/30 shrink-0">
                      {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt={c.fullName} />}
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {c.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate text-sm">{c.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.skillCount > 0 && `${c.skillCount} skill${c.skillCount === 1 ? '' : 's'}`}
                        {c.skillCount > 0 && c.activityCount > 0 && ' · '}
                        {c.activityCount > 0 && `${c.activityCount} event${c.activityCount === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <Badge className="bg-primary/15 text-primary border-primary/30 shrink-0 hover:bg-primary/15 hover:text-primary">
                      {c.total} contribution{c.total === 1 ? '' : 's'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default CampusPulse;
