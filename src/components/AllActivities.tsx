import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Globe, Code, BookOpen, Palette, Dumbbell, Coffee, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import NebulaBackground from './NebulaBackground';

// Must match the category options in AddActivityModal
const categoryIcons: Record<string, any> = {
  'Academic': BookOpen,
  'Sports': Dumbbell,
  'Technology': Code,
  'Arts & Culture': Palette,
  'Social': Coffee,
  'Career': Briefcase,
  'Other': Calendar,
};

const categories = ['All', ...Object.keys(categoryIcons)];

const AllActivities = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dbActivities, setDbActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load activities from database — all events on this page are real
  useEffect(() => {
    const fetchActivities = async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching activities:', error);
        setLoading(false);
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
      setLoading(false);
    };
    fetchActivities();
  }, []);

  // Filter activities based on search term and category
  const filteredActivities = dbActivities.filter(activity => {
    const matchesSearch = (activity.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (activity.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (activity.venue || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || activity.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleActivityClick = (activityId: string) => {
    navigate(`/activity/${activityId}`);
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
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Campus Activities & Events
                </h1>
                <p className="text-muted-foreground text-sm">Everything happening at RNSIT, organized by students</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filter Section */}
      <section className="py-8 px-4 relative z-10">
        <div className="container mx-auto">
          <div className="max-w-md mx-auto mb-6">
            <Input
              placeholder="Search events, venues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-center bg-card/50 backdrop-blur-sm border-primary/20 focus:border-primary/50"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {categories.map((category) => (
              <Badge
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`cursor-pointer transition-colors ${selectedCategory === category
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'}`}
              >
                {category}
              </Badge>
            ))}
          </div>

          {!loading && (
            <div className="text-center mb-8">
              <p className="text-muted-foreground">
                {selectedCategory === 'All'
                  ? `${filteredActivities.length} event${filteredActivities.length === 1 ? '' : 's'} organized by RNSIT students`
                  : `${filteredActivities.length} event${filteredActivities.length === 1 ? '' : 's'} in ${selectedCategory}`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Activities Grid */}
      <section className="pb-12 px-4 relative z-10">
        <div className="container mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading events...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredActivities.map((activity) => {
                const IconComponent = categoryIcons[activity.category] || Calendar;
                return (
                  <Card
                    key={activity.id}
                    className="crystal-card group hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden"
                    onClick={() => handleActivityClick(activity.id)}
                  >
                    <div className="h-24 relative bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 flex items-center justify-center">
                      <IconComponent className="h-10 w-10 text-primary/70 group-hover:scale-110 transition-all duration-300" />
                      <Badge className="absolute top-3 right-3 text-xs bg-accent/20 text-accent border-accent/30">
                        {activity.category}
                      </Badge>
                    </div>
                    <CardHeader className="relative z-10">
                      <CardTitle className="text-lg text-foreground">{activity.title}</CardTitle>
                      <CardDescription className="line-clamp-2 text-muted-foreground">
                        {activity.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 relative z-10">
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-primary" /> {activity.date} at {activity.time}
                        </p>
                        {activity.venue && (
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Globe className="h-3 w-3 text-accent" /> {activity.venue}
                          </p>
                        )}
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
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredActivities.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-10 w-10 text-primary/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                {dbActivities.length === 0 ? 'No campus events yet' : 'No events found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {dbActivities.length === 0
                  ? 'Be the first RNSITian to organize something — add an event from the home page.'
                  : 'Try adjusting your search term or browse different categories'}
              </p>
              <Button
                onClick={() => {
                  if (dbActivities.length === 0) {
                    navigate('/');
                  } else {
                    setSearchTerm('');
                    setSelectedCategory('All');
                  }
                }}
                className="plasma-button text-primary-foreground"
              >
                {dbActivities.length === 0 ? 'Back to Home' : 'Clear Filters'}
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AllActivities;
