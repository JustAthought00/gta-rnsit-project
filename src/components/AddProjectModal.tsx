import { useState, useEffect } from 'react';
import { X, Search, UserPlus, UserCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProjectToEdit {
  id: string;
  title: string;
  description: string | null;
  github_link: string | null;
  team_members: string | null;
}

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: () => void;
  projectToEdit?: ProjectToEdit | null;
}

interface Collaborator {
  user_id: string;
  full_name: string;
  department: string | null;
  skill: string;
}

interface ProfileResult {
  user_id: string;
  full_name: string;
  department: string | null;
}

const AddProjectModal = ({ isOpen, onClose, onProjectAdded, projectToEdit }: AddProjectModalProps) => {
  const isEditing = !!projectToEdit;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubLink, setGithubLink] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [loading, setLoading] = useState(false);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(projectToEdit?.title || '');
    setDescription(projectToEdit?.description || '');
    setGithubLink(projectToEdit?.github_link || '');
    setTeamMembers(projectToEdit?.team_members || '');
    setCollaborators([]);
    setSearchTerm('');
    setSearchResults([]);
  }, [isOpen, projectToEdit]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, department')
        .not('user_id', 'in', collaborators.map(c => c.user_id))
        .ilike('full_name', `%${searchTerm}%`)
        .limit(8);

      if (!error && data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, collaborators]);

  const addCollaborator = (profile: ProfileResult) => {
    setCollaborators(prev => {
      if (prev.some(c => c.user_id === profile.user_id)) return prev;
      return [...prev, { ...profile, skill: '' }];
    });
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeCollaborator = (userId: string) => {
    setCollaborators(prev => prev.filter(c => c.user_id !== userId));
  };

  const setCollaboratorSkill = (userId: string, skill: string) => {
    setCollaborators(prev =>
      prev.map(c => (c.user_id === userId ? { ...c, skill } : c))
    );
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in the required fields');
      return;
    }

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in');
      setLoading(false);
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      github_link: githubLink.trim() || null,
      team_members: teamMembers.trim() || null,
    };

    const { data: project, error } = isEditing && projectToEdit
      ? await supabase.from('projects').update(payload).eq('id', projectToEdit.id).eq('user_id', session.user.id).select().single()
      : await supabase.from('projects').insert({ user_id: session.user.id, ...payload }).select().single();

    if (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'add'} project: ` + error.message);
      setLoading(false);
      return;
    }

    // Invite each selected collaborator (pending request they must accept)
    const projectId = project!.id;
    if (!isEditing && collaborators.length > 0) {
      const invites = collaborators.map(c => ({
        project_id: projectId,
        user_id: c.user_id,
        inviter_id: session.user.id,
        skill: c.skill.trim() || null,
        status: 'pending',
      }));
      const { error: inviteError } = await supabase.from('project_collaborators').insert(invites);
      if (inviteError) {
        toast.warning('Project saved but some invites failed to send');
      } else {
        toast.success(`${collaborators.length} invite${collaborators.length > 1 ? 's' : ''} sent!`);
      }
    } else {
      toast.success(isEditing ? 'Project updated successfully!' : 'Project added successfully!');
    }

    setTitle('');
    setDescription('');
    setGithubLink('');
    setTeamMembers('');
    setCollaborators([]);
    onProjectAdded();
    onClose();
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">{isEditing ? 'Edit Project' : 'Add Project'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Project Name *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. My Awesome App" className="bg-muted/50 border-border" />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Short Description *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the project..." className="bg-muted/50 border-border min-h-[80px]" maxLength={300} />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">GitHub Link</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">🔗</span>
              <Input value={githubLink} onChange={(e) => setGithubLink(e.target.value)} placeholder="https://github.com/user/repo" className="bg-muted/50 border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Team Members</Label>
            <Input value={teamMembers} onChange={(e) => setTeamMembers(e.target.value)} placeholder="e.g. Alice, Bob, Charlie" className="bg-muted/50 border-border" />
          </div>

          {!isEditing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Invite Collaborators
                </Label>
                {collaborators.length > 0 && (
                  <span className="text-xs text-muted-foreground">{collaborators.length} selected</span>
                )}
              </div>

              <div className="space-y-2">
                {collaborators.map((c) => (
                  <div key={c.user_id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/40">
                    <Avatar className="h-8 w-8">
                      {c.full_name && <AvatarImage src={undefined} />}
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {getInitials(c.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                      <Input
                        value={c.skill}
                        onChange={(e) => setCollaboratorSkill(c.user_id, e.target.value)}
                        placeholder="Add the skill/area they'll work on (optional)"
                        className="h-7 text-xs mt-1 bg-background border-border"
                      />
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCollaborator(c.user_id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search students to invite..."
                  className="pl-10 bg-muted/50 border-border"
                />
              </div>

              {searchTerm.length >= 2 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  {isSearching ? (
                    <p className="text-sm text-muted-foreground p-3">Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3">No students found</p>
                  ) : (
                    searchResults.map((result) => (
                      <button
                        key={result.user_id}
                        type="button"
                        onClick={() => addCollaborator(result)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/60 transition-colors text-left"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-accent/20 text-accent text-xs">
                            {getInitials(result.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{result.full_name}</p>
                          {result.department && <p className="text-xs text-muted-foreground truncate">{result.department}</p>}
                        </div>
                        <UserCheck className="h-4 w-4 text-primary" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 plasma-button text-primary-foreground">
              {loading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Project')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProjectModal;