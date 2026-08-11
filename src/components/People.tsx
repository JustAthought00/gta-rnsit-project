import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import NebulaBackground from './NebulaBackground';

interface Person {
  user_id: string;
  full_name: string;
  department: string | null;
  academic_year: string | null;
  bio: string | null;
  avatar_url: string | null;
}

const People = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPeople = async () => {
      // Only the fields a directory listing needs — never select email here,
      // it doesn't belong on a page anyone signed in can browse and scrape.
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, department, academic_year, bio, avatar_url')
        .order('full_name', { ascending: true });

      if (!error && data) setPeople(data);
      setLoading(false);
    };
    fetchPeople();
  }, []);

  const filteredPeople = people.filter(person => {
    const term = searchTerm.toLowerCase();
    return (
      (person.full_name || '').toLowerCase().includes(term) ||
      (person.department || '').toLowerCase().includes(term) ||
      (person.bio || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />

      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
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
                RNSITians
              </h1>
              <p className="text-muted-foreground text-sm">Browse students by name or department</p>
            </div>
          </div>
        </div>
      </header>

      <section className="py-8 px-4 relative z-10">
        <div className="container mx-auto">
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border-2 border-foreground focus:border-primary text-center"
              />
            </div>
          </div>

          {!loading && (
            <div className="text-center mb-8">
              <p className="text-muted-foreground">
                {filteredPeople.length} RNSITian{filteredPeople.length === 1 ? '' : 's'} on GTA
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
              <p className="text-muted-foreground">Loading people...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPeople.map((person) => (
                <Card
                  key={person.user_id}
                  className="crystal-card group cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                  onClick={() => navigate(`/user/${person.user_id}`)}
                >
                  <CardContent className="pt-6 text-center">
                    <Avatar className="h-16 w-16 mx-auto mb-3 border-2 border-primary/30">
                      <AvatarImage src={person.avatar_url || undefined} alt={person.full_name} />
                      <AvatarFallback className="bg-primary/20 text-primary text-lg">
                        {person.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {person.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[person.department, person.academic_year].filter(Boolean).join(' • ')}
                    </p>
                    {person.bio && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{person.bio}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && filteredPeople.length === 0 && (
            <div className="text-center py-12">
              <UserIcon className="h-10 w-10 text-primary/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                {people.length === 0 ? 'No profiles yet' : 'No one found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {people.length === 0 ? 'Be the first RNSITian to sign up.' : 'Try a different search term'}
              </p>
              {people.length > 0 && (
                <Button onClick={() => setSearchTerm('')} className="plasma-button text-primary-foreground">
                  Clear Search
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default People;
