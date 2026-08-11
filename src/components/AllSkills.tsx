import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Code, Music, Palette, PenTool, Video, Briefcase, TrendingUp, Zap, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import NebulaBackground from './NebulaBackground';

const categoryIcons: Record<string, any> = {
  'Programming & Tech': Code,
  'Graphics & Design': Palette,
  'Writing & Translation': PenTool,
  'Video & Animation': Video,
  'Music & Audio': Music,
  'Digital Marketing': TrendingUp,
  'Business': Briefcase,
  'Other': Zap,
};

const categoryNames = Object.keys(categoryIcons);

const AllSkills = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [dbSkills, setDbSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedCategory = searchParams.get('category') || '';

  const handleCategoryFilter = (category: string) => {
    const next = new URLSearchParams(searchParams);
    if (category && category !== selectedCategory) {
      next.set('category', category);
    } else {
      next.delete('category');
    }
    setSearchParams(next, { replace: true });
  };

  // Fetch skills from database
  useEffect(() => {
    fetchDbSkills();
  }, []);

  const fetchDbSkills = async () => {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching skills:', error);
      setLoading(false);
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
    setLoading(false);
  };

  // All skills come from the database — nothing hardcoded
  const allSkills = dbSkills.map((skill) => {
    const IconComponent = categoryIcons[skill.category] || Zap;
    return {
      id: skill.id,
      name: skill.title,
      description: skill.description,
      icon: IconComponent,
      color: 'from-primary/20 to-accent/20 border-primary/30',
      category: skill.category || 'Other',
      ownerName: skill.owner_name || 'Unknown',
      userId: skill.user_id,
    };
  });

  // Filter by category (from URL) and search term
  const filteredSkills = allSkills.filter(skill => {
    const matchesCategory = !selectedCategory || skill.category === selectedCategory;
    const matchesSearch =
      (skill.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (skill.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (skill.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group skills by category
  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    if (!acc[skill.category]) {
      acc[skill.category] = [];
    }
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, typeof allSkills>);

  const handleSkillClick = (skillId: string) => {
    navigate(`/skill/${skillId}`);
  };

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />
      
      {/* Header */}
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
                Back to Home
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  All Skills & Services
                </h1>
                <p className="text-muted-foreground text-sm">Browse all available skills and find the perfect talent</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <section className="py-8 px-4 relative z-10">
        <div className="container mx-auto">
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search skills or categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border focus:border-primary text-center"
              />
            </div>
          </div>
          
          {/* Category filter chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <Badge
              onClick={() => handleCategoryFilter('')}
              className={`cursor-pointer transition-colors ${!selectedCategory
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'}`}
            >
              All
            </Badge>
            {categoryNames.map((name) => (
              <Badge
                key={name}
                onClick={() => handleCategoryFilter(name)}
                className={`cursor-pointer transition-colors ${selectedCategory === name
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'}`}
              >
                {name}
              </Badge>
            ))}
          </div>

          <div className="text-center mb-8">
            <p className="text-muted-foreground">
              {selectedCategory
                ? `${filteredSkills.length} skill${filteredSkills.length === 1 ? '' : 's'} in ${selectedCategory}`
                : `${filteredSkills.length} skill${filteredSkills.length === 1 ? '' : 's'} offered by RNSIT students`}
            </p>
          </div>
        </div>
      </section>

      {/* Skills by Category */}
      <section className="pb-12 px-4 relative z-10">
        <div className="container mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading skills...</p>
            </div>
          ) : (
            Object.entries(skillsByCategory).map(([category, skills]) => (
              <div key={category} className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-foreground">{category}</h2>
                  <Badge variant="secondary" className="text-sm bg-primary/20 text-primary border-primary/30">
                    {skills.length} skills
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {skills.map((skill) => {
                    const IconComponent = skill.icon;
                    return (
                      <Card 
                        key={skill.id} 
                        className={`crystal-card group cursor-pointer transition-all duration-500 hover:scale-[1.02] bg-gradient-to-br ${skill.color}`}
                        onClick={() => handleSkillClick(skill.id)}
                      >
                        <CardHeader className="pb-3 relative z-10">
                          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-all duration-300 shadow-glow">
                            <IconComponent className="h-6 w-6 text-primary-foreground" />
                          </div>
                          <CardTitle className="text-lg text-foreground">{skill.name}</CardTitle>
                          {skill.description && (
                            <CardDescription className="text-muted-foreground line-clamp-2">
                              {skill.description}
                            </CardDescription>
                          )}
                          <CardDescription className="text-muted-foreground">
                            <span
                              className="text-primary/80 hover:text-primary cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (skill.userId) navigate(`/user/${skill.userId}`);
                              }}
                            >
                              By {skill.ownerName}
                            </span>
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Empty State */}
      {!loading && filteredSkills.length === 0 && (
        <div className="text-center py-12 relative z-10">
          <h3 className="text-xl font-semibold mb-2 text-foreground">
            {allSkills.length === 0 ? 'No skills posted yet' : 'No skills found'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {allSkills.length === 0
              ? 'Be the first RNSITian to put a skill on the board.'
              : selectedCategory
                ? `Nothing in ${selectedCategory} yet — be the first to offer.`
                : 'Try adjusting your search term or browse all categories'}
          </p>
          <Button
            onClick={() => {
              if (allSkills.length === 0) {
                navigate('/');
              } else {
                setSearchTerm('');
                handleCategoryFilter('');
              }
            }}
            className="plasma-button text-primary-foreground"
          >
            {allSkills.length === 0 ? 'Back to Home' : 'Clear Filters'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AllSkills;