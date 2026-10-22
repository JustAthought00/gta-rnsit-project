import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, Search, Trash2, Code, Music, Palette, PenTool, Video, Briefcase, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NebulaBackground from './NebulaBackground';
import type { Tables } from '@/integrations/supabase/types';

const categoryIcons: Record<string, LucideIcon> = {
  'Programming & Tech': Code,
  'Graphics & Design': Palette,
  'Writing & Translation': PenTool,
  'Video & Animation': Video,
  'Music & Audio': Music,
  'Digital Marketing': TrendingUp,
  'Business': Briefcase,
  'Other': Zap,
};

interface SavedSkill {
  id: string;
  bookmarkId: string;
  title: string;
  description: string | null;
  category: string | null;
  owner_name: string;
  user_id: string;
}

const SavedSkills = () => {
  const navigate = useNavigate();
  const [savedSkills, setSavedSkills] = useState<SavedSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSaved = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setSignedIn(false);
      setSavedSkills([]);
      setLoading(false);
      return;
    }
    setSignedIn(true);

    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select('id, target_id, target_type')
      .eq('user_id', session.user.id)
      .eq('target_type', 'skill')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load saved skills: ' + error.message);
      setSavedSkills([]);
      setLoading(false);
      return;
    }

    const skillIds = [...new Set((bookmarks || []).map((b) => b.target_id))];
    if (skillIds.length === 0) {
      setSavedSkills([]);
      setLoading(false);
      return;
    }

    const { data: skills } = await supabase
      .from('skills')
      .select('id, title, description, category, user_id')
      .in('id', skillIds);

    const ownerIds = [...new Set((skills || []).map((s) => s.user_id))];
    const { data: profiles } = ownerIds.length
      ? await supabase.from('profiles').select('user_id, full_name').in('user_id', ownerIds)
      : { data: [] as { user_id: string; full_name: string }[] };
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

    const bookmarkByTarget = new Map((bookmarks || []).map((b) => [b.target_id, b.id]));

    setSavedSkills(
      (skills || [])
        .filter((s) => bookmarkByTarget.has(s.id))
        .map((s) => ({
          id: s.id,
          bookmarkId: bookmarkByTarget.get(s.id)!,
          title: s.title,
          description: s.description,
          category: s.category,
          owner_name: profileMap.get(s.user_id) || 'Unknown',
          user_id: s.user_id,
        }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  // The notification center listens to the `bookmarks` table and dispatches
  // this event, so toggling a bookmark on a skill page updates this list
  // without a manual reload.
  useEffect(() => {
    const handler = () => fetchSaved();
    window.addEventListener('bookmarksChanged', handler);
    return () => window.removeEventListener('bookmarksChanged', handler);
  }, [fetchSaved]);

  const removeBookmark = async (skill: SavedSkill) => {
    const { data, error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', skill.bookmarkId)
      .select('id');

    if (error) {
      toast.error('Failed to remove bookmark: ' + error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error('Failed to remove bookmark.');
      return;
    }
    setSavedSkills(prev => prev.filter(s => s.id !== skill.id));
    toast.success('Removed from saved skills');
  };

  const filtered = savedSkills.filter(skill => {
    const term = searchTerm.toLowerCase();
    return (
      (skill.title || '').toLowerCase().includes(term) ||
      (skill.category || '').toLowerCase().includes(term) ||
      (skill.owner_name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />

      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-foreground/70 hover:text-foreground hover:bg-primary/10 shrink-0"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">
                  Saved Skills
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm">Skills you've bookmarked for later</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="py-8 px-4 relative z-10">
        <div className="container mx-auto">
          {!loading && signedIn && savedSkills.length > 0 && (
            <div className="max-w-md mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search your saved skills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card/50 backdrop-blur-sm border-primary/20 focus:border-primary/50 text-center"
                />
              </div>
            </div>
          )}

          {!loading && signedIn && (
            <div className="text-center mb-8">
              <p className="text-muted-foreground">
                {savedSkills.length} saved skill{savedSkills.length === 1 ? '' : 's'}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="pb-12 px-4 relative z-10">
        <div className="container mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading saved skills...</p>
            </div>
          ) : signedIn === false ? (
            <div className="text-center py-12">
              <Bookmark className="h-10 w-10 text-primary/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">Sign in to see your saved skills</h3>
              <p className="text-muted-foreground mb-4">Bookmarks are tied to your account.</p>
              <Button onClick={() => navigate('/auth')} className="plasma-button text-primary-foreground">
                Sign In
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="h-10 w-10 text-primary/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                {savedSkills.length === 0 ? 'Nothing saved yet' : 'No saved skills match your search'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {savedSkills.length === 0
                  ? 'Tap the bookmark icon on any skill to keep it here for later.'
                  : 'Try a different search term.'}
              </p>
              <Button
                onClick={() => (savedSkills.length === 0 ? navigate('/skills') : setSearchTerm(''))}
                className="plasma-button text-primary-foreground"
              >
                {savedSkills.length === 0 ? 'Browse Skills' : 'Clear Search'}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((skill) => {
                const IconComponent = categoryIcons[skill.category || ''] || Zap;
                return (
                  <Card
                    key={skill.id}
                    className="crystal-card group cursor-pointer transition-all duration-500 hover:scale-[1.02] bg-gradient-to-br from-primary/20 to-accent/20 border-primary/30"
                    onClick={() => navigate(`/skill/${skill.id}`)}
                  >
                    <CardHeader className="pb-3 relative z-10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-glow">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          title="Remove from saved"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBookmark(skill);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <CardTitle className="text-lg text-foreground">{skill.title}</CardTitle>
                      {skill.description && (
                        <CardDescription className="text-muted-foreground line-clamp-2">
                          {skill.description}
                        </CardDescription>
                      )}
                      {skill.category && (
                        <Badge variant="secondary" className="w-fit text-xs bg-primary/20 text-primary border-primary/30">
                          {skill.category}
                        </Badge>
                      )}
                      <CardDescription className="text-muted-foreground">
                        <span
                          className="text-primary/80 hover:text-primary cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/user/${skill.user_id}`);
                          }}
                        >
                          By {skill.owner_name}
                        </span>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SavedSkills;
