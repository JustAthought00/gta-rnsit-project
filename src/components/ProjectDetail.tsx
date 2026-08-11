import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Github, Users, Calendar, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NebulaBackground from './NebulaBackground';
import AddProjectModal from './AddProjectModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
    fetchProjectData();
  }, [projectId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUser(session.user);
    }
  };

  const fetchProjectData = async () => {
    if (!projectId) return;
    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (projectData) {
      // Get owner profile
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', projectData.user_id)
        .maybeSingle();
      
      setProject({ ...projectData, owner: ownerProfile });

      // Parse team members and try to match with existing profiles
      if (projectData.team_members) {
        const memberNames = projectData.team_members
          .split(',')
          .map((n: string) => n.trim())
          .filter(Boolean);
        
        if (memberNames.length > 0) {
          const { data: matchingProfiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .in('full_name', memberNames);
          
          if (matchingProfiles) {
            // Map the typed names to either matched profiles or just text
            const mappedMembers = memberNames.map((name: string) => {
              const matched = matchingProfiles.find(p => p.full_name.toLowerCase() === name.toLowerCase());
              return matched ? { name, profile: matched } : { name, profile: null };
            });
            setCollaboratorProfiles(mappedMembers);
          } else {
            setCollaboratorProfiles(memberNames.map((name: string) => ({ name, profile: null })));
          }
        }
      } else {
        setCollaboratorProfiles([]);
      }
    }
    setLoading(false);
  };

  const deleteProject = async () => {
    if (!projectId) return;
    setDeleting(true);
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    setDeleting(false);
    if (error) {
      toast.error('Failed to delete project: ' + error.message);
      return;
    }
    toast.success('Project deleted');
    navigate(-1); // Go back
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NebulaBackground />
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NebulaBackground />
        <div className="text-center relative z-10">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Project not found</h1>
          <Button onClick={() => navigate('/')} className="plasma-button text-primary-foreground">Go back home</Button>
        </div>
      </div>
    );
  }

  const isOwner = currentUser?.id === project.user_id;

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />

      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-foreground/70 hover:text-foreground hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">{project.title}</h1>
              </div>
            </div>
            {isOwner && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative z-10 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <Card className="crystal-card">
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold text-foreground mb-4">About the Project</h2>
                <div className="prose prose-invert max-w-none text-muted-foreground">
                  <p className="whitespace-pre-wrap">{project.description}</p>
                </div>

                {project.github_link && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <a 
                      href={project.github_link.startsWith('http') ? project.github_link : `https://${project.github_link}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Button className="w-full sm:w-auto bg-muted/50 hover:bg-muted text-foreground border border-border">
                        <Github className="h-4 w-4 mr-2" />
                        View Source Code
                      </Button>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project Creator */}
            {project.owner && (
              <Card className="crystal-card">
                <CardContent className="pt-6">
                  <p className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Created By</p>
                  <div 
                    className="flex items-center gap-4 p-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/user/${project.user_id}`)}
                  >
                    <Avatar className="h-12 w-12 border-2 border-primary/30">
                      <AvatarImage src={project.owner.avatar_url} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {project.owner.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{project.owner.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{project.owner.department}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Team Members */}
            {collaboratorProfiles.length > 0 && (
              <Card className="crystal-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-accent" />
                    <p className="text-sm font-semibold text-foreground">Team Members</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {collaboratorProfiles.map((member, index) => (
                      <div key={index} className="flex items-center gap-3">
                        {member.profile ? (
                          <div 
                            className="flex items-center gap-3 w-full p-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => navigate(`/user/${member.profile.user_id}`)}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profile.avatar_url} />
                              <AvatarFallback className="bg-accent/20 text-accent text-xs">
                                {member.profile.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground hover:text-accent transition-colors">
                              {member.name}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 w-full p-2 -mx-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {member.name}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Meta info */}
            <Card className="crystal-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Added on {new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{project.title}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProject} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectDetail;
