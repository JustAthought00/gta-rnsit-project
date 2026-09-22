import { useState, useEffect, useRef } from 'react';
import { X, Users, User as UserIcon, ImagePlus, Trash2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ActivityToEdit {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  date: string | null;
  time: string | null;
  venue: string | null;
  max_participants: number | null;
  requirements?: string | null;
  organizer_type?: string | null;
  group_name?: string | null;
  photo_url?: string | null;
  deadline?: string | null;
}

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivityAdded?: () => void;
  activityToEdit?: ActivityToEdit | null;
}

const emptyForm = {
  title: '',
  description: '',
  category: '',
  date: '',
  time: '',
  venue: '',
  maxParticipants: '',
  requirements: '',
  organizerType: 'individual',
  groupName: '',
  photoUrl: '',
  deadline: ''
};

const AddActivityModal = ({ isOpen, onClose, onActivityAdded, activityToEdit }: AddActivityModalProps) => {
  const isEditing = !!activityToEdit;
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (activityToEdit) {
      setFormData({
        title: activityToEdit.title || '',
        description: activityToEdit.description || '',
        category: activityToEdit.category || '',
        date: activityToEdit.date || '',
        time: activityToEdit.time || '',
        venue: activityToEdit.venue || '',
        maxParticipants: activityToEdit.max_participants?.toString() || '',
        requirements: activityToEdit.requirements || '',
        organizerType: activityToEdit.organizer_type === 'group' ? 'group' : 'individual',
        groupName: activityToEdit.group_name || '',
        photoUrl: activityToEdit.photo_url || '',
        deadline: activityToEdit.deadline ? activityToEdit.deadline.slice(0, 16) : ''
      });
    } else {
      setFormData(emptyForm);
    }
  }, [isOpen, activityToEdit]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be less than 5MB');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to add a photo');
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/activity-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('activity-photos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload photo');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('activity-photos')
      .getPublicUrl(filePath);

    setFormData(prev => ({ ...prev, photoUrl: publicUrl }));
    setUploading(false);
    toast.success('Photo uploaded!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Please sign in to add an activity');
        setIsLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      const isTeacher = profileData?.role === 'teacher';

      const payload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        date: formData.date,
        time: formData.time,
        venue: formData.venue,
        max_participants: parseInt(formData.maxParticipants) || null,
        requirements: formData.requirements || null,
        organizer_type: formData.organizerType,
        group_name: formData.organizerType === 'group' && formData.groupName.trim() ? formData.groupName.trim() : null,
        photo_url: formData.photoUrl || null,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null
      };

      const { error } = isEditing
        ? await supabase.from('activities').update(payload).eq('id', activityToEdit!.id).eq('user_id', user.id)
        : await supabase.from('activities').insert({ user_id: user.id, approval_status: isTeacher ? 'approved' : 'pending', ...payload });

      if (error) {
        toast.error(`Failed to ${isEditing ? 'update' : 'add'} activity: ` + error.message);
      } else {
        toast.success(`Activity ${isEditing ? 'updated' : 'added'} successfully!`);
        setFormData(emptyForm);
        onActivityAdded?.();
        onClose();
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">{isEditing ? 'Edit Activity/Event' : 'Add Activity/Event'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label htmlFor="title">Activity Title *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Weekend Coding Workshop, Study Group"
            />
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the activity and what participants can expect"
              rows={4}
            />
          </div>

          <div>
            <Label>Cover Photo (Optional)</Label>
            <div className="mt-1.5 relative h-36 rounded-md overflow-hidden border border-border bg-muted/40 flex items-center justify-center">
              {formData.photoUrl ? (
                <>
                  <img src={formData.photoUrl} alt="Activity cover" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, photoUrl: '' })}
                    className="absolute top-2 right-2 bg-destructive/90 text-white rounded-full p-1.5 hover:bg-destructive transition-colors"
                    title="Remove photo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ImagePlus className="h-5 w-5" />
                  {uploading ? 'Uploading...' : 'Upload a cover photo'}
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <select
              id="category"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
            >
              <option value="">Select a category</option>
              <option value="Academic">Academic</option>
              <option value="Sports">Sports</option>
              <option value="Technology">Technology</option>
              <option value="Arts & Culture">Arts & Culture</option>
              <option value="Social">Social</option>
              <option value="Career">Career</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <Label>Hosted by *</Label>
            <div className="grid grid-cols-2 gap-4 mt-1.5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, organizerType: 'individual' })}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                  formData.organizerType === 'individual'
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/30'
                }`}
              >
                <UserIcon className="h-4 w-4" />
                Individual
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, organizerType: 'group' })}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                  formData.organizerType === 'group'
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-border bg-background text-muted-foreground hover:border-accent/30'
                }`}
              >
                <Users className="h-4 w-4" />
                Club / Group
              </button>
            </div>
          </div>

          {formData.organizerType === 'group' && (
            <div>
              <Label htmlFor="groupName">Club / Group Name *</Label>
              <Input
                id="groupName"
                required
                value={formData.groupName}
                onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                placeholder="e.g., Cyber Security Club, Music Collective"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                required
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="time">Time *</Label>
              <Input
                id="time"
                required
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="venue">Venue *</Label>
            <Input
              id="venue"
              required
              value={formData.venue}
              onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              placeholder="e.g., Main Campus, Lab 301, Online"
            />
          </div>

          <div>
            <Label htmlFor="deadline">Registration Deadline (Optional)</Label>
            <div className="relative">
              <Input
                id="deadline"
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="pl-10"
              />
              <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">If set, registration closes at this time and the activity won't appear publicly afterwards.</p>
          </div>

          <div>
            <Label htmlFor="maxParticipants">Max Participants *</Label>
            <Input
              id="maxParticipants"
              required
              type="number"
              min="1"
              value={formData.maxParticipants}
              onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
              placeholder="e.g., 50"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Activity')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddActivityModal;
