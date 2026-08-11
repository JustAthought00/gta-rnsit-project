import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivityAdded?: () => void;
}

const AddActivityModal = ({ isOpen, onClose, onActivityAdded }: AddActivityModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    date: '',
    time: '',
    venue: '',
    maxParticipants: ''
  });

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

      const { error } = await supabase.from('activities').insert({
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        date: formData.date,
        time: formData.time,
        venue: formData.venue,
        max_participants: parseInt(formData.maxParticipants) || null
      });

      if (error) {
        toast.error('Failed to add activity: ' + error.message);
      } else {
        toast.success('Activity added successfully!');
        setFormData({
          title: '',
          description: '',
          category: '',
          date: '',
          time: '',
          venue: '',
          maxParticipants: ''
        });
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
          <h2 className="text-2xl font-bold text-foreground">Add Activity/Event</h2>
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
            <Label htmlFor="maxParticipants">Max Participants *</Label>
            <Input
              id="maxParticipants"
              required
              type="number"
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
              {isLoading ? 'Adding...' : 'Add Activity'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddActivityModal;
