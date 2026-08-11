import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: () => void;
}

const AddProjectModal = ({ isOpen, onClose, onProjectAdded }: AddProjectModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubLink, setGithubLink] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

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

    const { error } = await supabase.from('projects').insert({
      user_id: session.user.id,
      title: title.trim(),
      description: description.trim(),
      github_link: githubLink.trim() || null,
      team_members: teamMembers.trim() || null,
    });

    if (error) {
      toast.error('Failed to add project: ' + error.message);
    } else {
      toast.success('Project added successfully!');
      setTitle('');
      setDescription('');
      setGithubLink('');
      setTeamMembers('');
      onProjectAdded();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Add Project</h2>
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

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 plasma-button text-primary-foreground">
              {loading ? 'Adding...' : 'Add Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProjectModal;
