import { useState, useEffect } from 'react';
import { X, Users, GraduationCap, UserCheck, UserX, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommunityAdded: () => void;
  isTeacher: boolean;
}

const AddCommunityModal = ({ isOpen, onClose, onCommunityAdded, isTeacher }: AddCommunityModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leadAsTeacher, setLeadAsTeacher] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setDescription('');
    setLeadAsTeacher(isTeacher);
  }, [isOpen, isTeacher]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a community name');
      return;
    }

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in');
      setLoading(false);
      return;
    }

    const insertPayload = {
      name: name.trim(),
      description: description.trim() || null,
      created_by: session.user.id,
      leader_id: isTeacher && leadAsTeacher ? session.user.id : null,
    };

    const { data: community, error } = await supabase
      .from('communities')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      toast.error('Failed to create community: ' + error.message);
      setLoading(false);
      return;
    }

    // The creator auto-joins as an accepted member
    const { error: memberError } = await supabase
      .from('community_members')
      .insert({ community_id: community.id, user_id: session.user.id, status: 'accepted' });

    if (memberError) {
      toast.warning('Community created but could not auto-join');
    } else {
      toast.success('Community created!');
    }

    setLoading(false);
    onCommunityAdded();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card border border-border w-full rounded-t-2xl sm:rounded-xl max-w-lg sm:max-h-[90vh] max-h-[92dvh] overflow-y-auto sm:mx-auto overscroll-contain">
        <div className="sticky top-0 z-10 bg-card flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Create Community
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Community Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Robotics Club" className="bg-muted/50 border-border" />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this community about?" className="bg-muted/50 border-border min-h-[100px]" maxLength={300} />
          </div>

          {isTeacher && (
            <label className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={leadAsTeacher}
                onChange={(e) => setLeadAsTeacher(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" /> Lead this community as faculty
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">You'll appear as the faculty lead and approve join requests.</p>
              </div>
            </label>
          )}

          {!isTeacher && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <BookOpen className="h-4 w-4 text-accent mt-0.5" />
              <p className="text-xs text-muted-foreground">
                New communities must have a teacher lead. Ask a faculty member to create the community, or talk to an existing lead.
              </p>
            </div>
          )}

          <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-0 bg-card sm:bg-transparent border-t border-border/40 sm:border-0 flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 plasma-button text-primary-foreground">
              {loading ? 'Creating...' : 'Create Community'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCommunityModal;