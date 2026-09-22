import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Mail, MapPin, GraduationCap, Briefcase, Sparkles, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import NebulaBackground from './NebulaBackground';

interface Teacher {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  designation: string | null;
  experience: string | null;
  expertise: string | null;
  cabin_location: string | null;
  profile?: { avatar_url: string | null; bio: string | null } | null;
}

const Teachers = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeachers = async () => {
      const { data: teacherData, error } = await supabase
        .from('teachers')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        setTeachers([]);
        setLoading(false);
        return;
      }

      if (teacherData && teacherData.length > 0) {
        const userIds = [...new Set(teacherData.map((t) => t.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, avatar_url, bio')
          .in('user_id', userIds);
        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
        setTeachers(teacherData.map((t) => ({ ...t, profile: profileMap.get(t.user_id) || null })));
      } else {
        setTeachers([]);
      }
      setLoading(false);
    };
    fetchTeachers();
  }, []);

  const filteredTeachers = teachers.filter(t => {
    const term = searchTerm.toLowerCase();
    return (
      (t.full_name || '').toLowerCase().includes(term) ||
      (t.department || '').toLowerCase().includes(term) ||
      (t.designation || '').toLowerCase().includes(term) ||
      ((t.expertise as string) || '').toLowerCase().includes(term)
    );
  });

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
              Home
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Our Faculty
              </h1>
              <p className="text-sm text-muted-foreground">Meet the teachers leading RNSIT</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, department, designation or expertise..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted/50 border-border"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p>Loading faculty directory...</p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <Card className="crystal-card">
            <CardContent className="py-16 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No teachers match your search.' : 'No teachers in the directory yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeachers.map((teacher) => (
              <Card
                key={teacher.id}
                className="crystal-card hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => navigate(`/user/${teacher.user_id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-14 w-14 border-2 border-primary/30">
                      <AvatarImage src={teacher.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                        {getInitials(teacher.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{teacher.full_name}</h3>
                      {teacher.designation && (
                        <p className="text-sm text-muted-foreground truncate">{teacher.designation}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {teacher.department && (
                          <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                            <GraduationCap className="h-3 w-3 mr-1" />{teacher.department}
                          </Badge>
                        )}
                        {teacher.experience && (
                          <Badge variant="outline" className="border-accent/30 text-accent text-xs">
                            <Briefcase className="h-3 w-3 mr-1" />{teacher.experience}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {teacher.expertise && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                      <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span className="line-clamp-2">{teacher.expertise}</span>
                    </div>
                  )}

                  <div className="space-y-1.5 text-sm text-muted-foreground border-t border-border/50 pt-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-accent shrink-0" />
                      <span className="truncate">{teacher.email}</span>
                    </div>
                    {teacher.cabin_location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-accent shrink-0" />
                        <span>Cabin: {teacher.cabin_location}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Teachers;