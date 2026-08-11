import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, Save, User, Briefcase, Code, Calendar as CalendarIcon, Trash2, Plus, Github, Linkedin, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NebulaBackground from './NebulaBackground';
import AddSkillModal from './AddSkillModal';
import AddProjectModal from './AddProjectModal';
import AddActivityModal from './AddActivityModal';

const EditProfile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Profile state
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Lists state
  const [skills, setSkills] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Modals state
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate('/auth');
      return;
    }
    setUserId(session.user.id);

    // Load Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (profileData) {
      setFullName(profileData.full_name || '');
      setDepartment(profileData.department || '');
      setAcademicYear(profileData.academic_year || '');
      setBio((profileData as any).bio || '');
      setAvatarUrl((profileData as any).avatar_url || null);
      setGithubUrl((profileData as any).github_url || '');
      setLinkedinUrl((profileData as any).linkedin_url || '');
      setPortfolioUrl((profileData as any).portfolio_url || '');
    }

    // Load Skills
    const { data: skillsData } = await supabase.from('skills').select('*').eq('user_id', session.user.id);
    if (skillsData) setSkills(skillsData);

    // Load Projects
    const { data: projectsData } = await supabase.from('projects').select('*').eq('user_id', session.user.id);
    if (projectsData) setProjects(projectsData);

    // Load Activities
    const { data: activitiesData } = await supabase.from('activities').select('*').eq('user_id', session.user.id);
    if (activitiesData) setActivities(activitiesData);

    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload avatar');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    setAvatarUrl(publicUrl);
    setUploading(false);
    toast.success('Avatar uploaded!');
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        department,
        academic_year: academicYear,
        bio,
        avatar_url: avatarUrl,
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        portfolio_url: portfolioUrl,
      } as any)
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile updated!');
    }
    setSaving(false);
  };

  const handleDeleteItem = async (table: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete from ${table}`);
    } else {
      toast.success('Item deleted successfully');
      loadData();
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />

      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(-1)} className="text-foreground hover:bg-muted">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Profile
            </Button>
            <h1 className="text-xl font-bold text-foreground">Manage Profile</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10 max-w-3xl">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-muted/50">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="crystal-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Edit Profile
                </CardTitle>
                <Button onClick={handleSaveProfile} disabled={saving} className="plasma-button text-primary-foreground">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-2xl">
                        {getInitials(fullName || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 hover:bg-primary/90 transition-colors"
                      disabled={uploading}
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-muted/50 border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="text-foreground">Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Computer Science">Computer Science</SelectItem>
                      <SelectItem value="Information Science">Information Science</SelectItem>
                      <SelectItem value="Electronics & Communication">Electronics & Communication</SelectItem>
                      <SelectItem value="Electrical Engineering">Electrical Engineering</SelectItem>
                      <SelectItem value="Mechanical Engineering">Mechanical Engineering</SelectItem>
                      <SelectItem value="Civil Engineering">Civil Engineering</SelectItem>
                      <SelectItem value="Artificial Intelligence & ML">Artificial Intelligence & ML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year" className="text-foreground">Academic Year</Label>
                  <Select value={academicYear} onValueChange={setAcademicYear}>
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st Year">1st Year</SelectItem>
                      <SelectItem value="2nd Year">2nd Year</SelectItem>
                      <SelectItem value="3rd Year">3rd Year</SelectItem>
                      <SelectItem value="4th Year">4th Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-foreground">Bio</Label>
                  <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell others about yourself..." className="bg-muted/50 border-border min-h-[100px]" maxLength={300} />
                  <p className="text-xs text-muted-foreground text-right">{bio.length}/300</p>
                </div>

                {/* Social Links */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-foreground">Social Links (Optional)</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Github className="h-5 w-5 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="GitHub URL (e.g. https://github.com/username)"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-5 w-5 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="LinkedIn URL (e.g. https://linkedin.com/in/username)"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        className="bg-muted/50 border-border"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="Portfolio URL (e.g. https://mywebsite.com)"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        className="bg-muted/50 border-border"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skills">
            <Card className="crystal-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Manage Skills
                </CardTitle>
                <Button onClick={() => setIsSkillModalOpen(true)} className="plasma-button text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" /> Add Skill
                </Button>
              </CardHeader>
              <CardContent>
                {skills.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No skills added yet.</p>
                ) : (
                  <div className="space-y-4">
                    {skills.map((skill) => (
                      <div key={skill.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                        <div>
                          <h3 className="font-semibold text-foreground">{skill.title}</h3>
                          <p className="text-sm text-muted-foreground">{skill.category}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem('skills', skill.id)} className="text-destructive hover:bg-destructive/20">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card className="crystal-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Code className="h-5 w-5 text-accent" />
                  Manage Projects
                </CardTitle>
                <Button onClick={() => setIsProjectModalOpen(true)} className="plasma-button text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" /> Add Project
                </Button>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No projects added yet.</p>
                ) : (
                  <div className="space-y-4">
                    {projects.map((project) => (
                      <div key={project.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                        <div>
                          <h3 className="font-semibold text-foreground">{project.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">{project.description}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem('projects', project.id)} className="text-destructive hover:bg-destructive/20">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activities">
            <Card className="crystal-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-green-400" />
                  Manage Activities
                </CardTitle>
                <Button onClick={() => setIsActivityModalOpen(true)} className="plasma-button text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" /> Add Activity
                </Button>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No activities added yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                        <div>
                          <h3 className="font-semibold text-foreground">{activity.title}</h3>
                          <p className="text-sm text-muted-foreground">{activity.date} - {activity.venue}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem('activities', activity.id)} className="text-destructive hover:bg-destructive/20">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <AddSkillModal isOpen={isSkillModalOpen} onClose={() => setIsSkillModalOpen(false)} onSkillAdded={loadData} />
      <AddProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} onProjectAdded={loadData} />
      <AddActivityModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} onActivityAdded={loadData} />
    </div>
  );
};

export default EditProfile;
