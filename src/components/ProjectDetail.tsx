import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Github, Users, Calendar, Trash2, Pencil, Check, X, Clock, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NebulaBackground from './NebulaBackground';
import AddProjectModal from './AddProjectModal';
import type { Tables } from '@/integrations/supabase/types';
import type { User } from '@supabase/supabase-js';
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

interface CollaboratorInvite {
  id: string;
  project_id: string;
  user_id: string;
  inviter_id: string;
  skill: string | null;
  status: string;
  responded_at: string | null;
  profile?: { user_id: string; full_name: string; avatar_url: string | null; department: string | null } | null;
}

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [project, setProject] = useState<Tables<'projects'> & { owner: Tables<'profiles'> | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [invites, setInvites] = useState<CollaboratorInvite[]>([]);
  const [parsedMembers, setParsedMembers] = useState<{ name: string; profile: { user_id: string; full_name: string | null; avatar_url: string | null } | null }[]>([]);

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
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', projectData.user_id)
        .maybeSingle();

      setProject({ ...projectData, owner: ownerProfile });

      // Parse free-text team members
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
            const mappedMembers = memberNames.map((name: string) => {
              const matched = matchingProfiles.find((p) => p.full_name?.toLowerCase() === name.toLowerCase());
              return matched ? { name, profile: matched } : { name, profile: null };
            });
            setParsedMembers(mappedMembers);
          } else {
            setParsedMembers(memberNames.map((name: string) => ({ name, profile: null })));
          }
        }
      } else {
        setParsedMembers([]);
      }

      // Fetch collaborator invites for this project
      const { data: invitesData } = await supabase
        .from('project_collaborators')
        .select('*')
        .eq('project_id', projectData.id);

      if (invitesData && invitesData.length > 0) {
        const userIds = invitesData.map((i) => i.user_id);
        const { data: inviteProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url, department')
          .in('user_id', userIds);

        const profileMap = new Map(inviteProfiles?.map((p) => [p.user_id, p]));
        setInvites(invitesData.map((i) => ({ ...i, profile: profileMap.get(i.user_id) || null })));
      } else {
        setInvites([]);
      }
    }
    setLoading(false);
  };

  const myInvite = invites.find((i) => i.user_id === currentUser?.id);

  const respondToInvite = async (status: 'accepted' | 'declined') => {
    if (!myInvite) return;
    const { error } = await supabase
      .from('project_collaborators')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', myInvite.id)
      .eq('user_id', currentUser.id);

    if (error) {
      toast.error('Failed to respond: ' + error.message);
      return;
    }
    toast.success(status === 'accepted' ? 'You joined the project!' : 'Invite declined');
    fetchProjectData();
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from('project_collaborators').delete().eq('id', inviteId);
    if (error) {
      toast.error('Failed to remove collaborator: ' + error.message);
      return;
    }
    toast.success('Collaborator removed');
    fetchProjectData();
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
    navigate('/');
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
  const acceptedCollaborators = invites.filter((i) => i.status === 'accepted');
  const pendingInvites = invites.filter((i) => i.status === 'pending');

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />

      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-foreground/70 hover:text-foreground hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{project.title}</h1>
              </div>
            </div>
            {isOwner && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowEditModal(true)} className="text-muted-foreground hover:text-primary">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
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

            {/* Invite banner for pending collaborator */}
            {myInvite && myInvite.status === 'pending' && (
              <Card className="crystal-card border-primary/40">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">You're invited!</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {project.owner?.full_name} invited you to collaborate on this project.
                    {myInvite.skill && <> They'd like you to work on <span className="text-foreground font-medium">{myInvite.skill}</span>.</>}
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 border-destructive text-destructive hover:bg-destructive/10" onClick={() => respondToInvite('declined')}>
                      <X className="h-4 w-4 mr-2" />Decline
                    </Button>
                    <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => respondToInvite('accepted')}>
                      <Check className="h-4 w-4 mr-2" />Accept
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Team Members */}
            {(acceptedCollaborators.length > 0 || parsedMembers.length > 0) && (
              <Card className="crystal-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-accent" />
                    <p className="text-sm font-semibold text-foreground">Team Members</p>
                    {acceptedCollaborators.length > 0 && (
                      <Badge variant="outline" className="border-primary/30 text-primary text-xs">{acceptedCollaborators.length} confirmed</Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    {acceptedCollaborators.map((invite) => (
                      <div key={invite.id} className="flex items-center gap-3">
                        {invite.profile ? (
                          <Link to={`/user/${invite.profile.user_id}`} className="flex items-center gap-3 w-full p-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={invite.profile.avatar_url || undefined} />
                              <AvatarFallback className="bg-accent/20 text-accent text-xs">
                                {invite.profile.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-foreground hover:text-accent transition-colors block truncate">
                                {invite.profile.full_name}
                              </span>
                              {invite.skill && (
                                <span className="text-xs text-muted-foreground block truncate"><LinkIcon className="h-3 w-3 inline mr-1" />{invite.skill}</span>
                              )}
                            </div>
                            {isOwner && (
                              <Button variant="ghost" size="sm" className="p-1 text-muted-foreground hover:text-destructive" onClick={() => revokeInvite(invite.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 w-full p-2 -mx-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="text-sm text-muted-foreground">Collaborator</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {parsedMembers.map((member, index) => (
                      <div key={`parsed-${index}`} className="flex items-center gap-3">
                        {member.profile ? (
                          <Link to={`/user/${member.profile.user_id}`} className="flex items-center gap-3 w-full p-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profile.avatar_url} />
                              <AvatarFallback className="bg-accent/20 text-accent text-xs">
                                {member.profile.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground hover:text-accent transition-colors">
                              {member.name}
                            </span>
                          </Link>
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

            {/* Pending invites (owner view) */}
            {isOwner && pendingInvites.length > 0 && (
              <Card className="crystal-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Pending Invites</p>
                    <Badge variant="outline" className="border-primary/30 text-primary text-xs">{pendingInvites.length}</Badge>
                  </div>
                  <div className="flex flex-col gap-3">
                    {pendingInvites.map((invite) => (
                      <div key={invite.id} className="flex items-center gap-3 p-2 -mx-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground block truncate">
                            {invite.profile?.full_name || 'Unknown user'}
                          </span>
                          {invite.skill && <span className="text-xs text-muted-foreground block truncate">Skill: {invite.skill}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />Waiting
                        </span>
                        <Button variant="ghost" size="sm" className="p-1 text-muted-foreground hover:text-destructive" onClick={() => revokeInvite(invite.id)}>
                          <X className="h-4 w-4" />
                        </Button>
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

      <AddProjectModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onProjectAdded={fetchProjectData}
        projectToEdit={project}
      />

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