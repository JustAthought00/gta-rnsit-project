import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Zap, Calendar, Users, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Contributor {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
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
      const [profilesRes, skillsRes, activitiesRes, reviewsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, avatar_url'),
        supabase.from('skills').select('user_id'),
        supabase.from('activities').select('user_id'),
        supabase.from('reviews').select('id'),
      ]);

      const profiles = profilesRes.data || [];
      const skills = skillsRes.data || [];
      const activities = activitiesRes.data || [];
      const reviews = reviewsRes.data || [];

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
    <section className="py-8 md:py-12 px-4 relative z-10">
      <div className="container mx-auto">
        <div className="flex items-center gap-2 mb-6 md:mb-8">
          <Trophy className="h-6 w-6 text-primary" />
          <h3 className="text-2xl md:text-3xl font-bold text-foreground">Campus Pulse</h3>
          <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">Live</Badge>
        </div>

        {/* Real-time stats — straight from the database */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statTiles.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="crystal-card">
              <CardContent className="py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-glow shrink-0">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Top contributors leaderboard */}
        {contributors.length > 0 && (
          <Card className="crystal-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Top Contributors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/50">
                {contributors.map((c, i) => (
                  <div
                    key={c.userId}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-primary/5 rounded-lg px-2 transition-colors"
                    onClick={() => navigate(`/user/${c.userId}`)}
                  >
                    <span
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
                        rankStyles[i] || 'bg-primary/10 text-primary border-primary/30'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <Avatar className="h-9 w-9 border border-primary/30">
                      {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt={c.fullName} />}
                      <AvatarFallback className="bg-primary/20 text-primary text-sm">
                        {c.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{c.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.skillCount > 0 && `${c.skillCount} skill${c.skillCount === 1 ? '' : 's'}`}
                        {c.skillCount > 0 && c.activityCount > 0 && ' · '}
                        {c.activityCount > 0 && `${c.activityCount} event${c.activityCount === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    <Badge className="bg-primary/15 text-primary border-primary/30 shrink-0">
                      {c.total} contribution{c.total === 1 ? '' : 's'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
};

export default CampusPulse;
