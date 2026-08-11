import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SkillToEdit {
  id: string;
  title: string;
  description: string;
  category: string;
  experience: string;
  hourly_rate: string;
  availability: string;
}

interface AddSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkillAdded?: () => void;
  skillToEdit?: SkillToEdit | null;
}

const emptyForm = {
  title: '',
  description: '',
  category: '',
  experience: '',
  hourlyRate: '',
  availability: ''
};

const AddSkillModal = ({ isOpen, onClose, onSkillAdded, skillToEdit }: AddSkillModalProps) => {
  const isEditing = !!skillToEdit;
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (!isOpen) return;
    if (skillToEdit) {
      setFormData({
        title: skillToEdit.title || '',
        description: skillToEdit.description || '',
        category: skillToEdit.category || '',
        experience: skillToEdit.experience || '',
        hourlyRate: skillToEdit.hourly_rate || '',
        availability: skillToEdit.availability || ''
      });
    } else {
      setFormData(emptyForm);
    }
  }, [isOpen, skillToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Please sign in to add a skill');
        setIsLoading(false);
        return;
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        experience: formData.experience,
        hourly_rate: formData.hourlyRate,
        availability: formData.availability
      };

      const { error } = isEditing
        ? await supabase.from('skills').update(payload).eq('id', skillToEdit!.id).eq('user_id', user.id)
        : await supabase.from('skills').insert({ user_id: user.id, ...payload });

      if (error) {
        toast.error(`Failed to ${isEditing ? 'update' : 'add'} skill: ` + error.message);
      } else {
        toast.success(`Skill ${isEditing ? 'updated' : 'added'} successfully!`);
        setFormData(emptyForm);
        onSkillAdded?.();
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
          <h2 className="text-2xl font-bold text-foreground">{isEditing ? 'Edit Your Skill' : 'Add Your Skill'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label htmlFor="title">Skill Title *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Web Development, Graphic Design"
            />
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your skill and what you can offer"
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
              <option value="Programming & Tech">Programming & Tech</option>
              <option value="Graphics & Design">Graphics & Design</option>
              <option value="Writing & Translation">Writing & Translation</option>
              <option value="Video & Animation">Video & Animation</option>
              <option value="Music & Audio">Music & Audio</option>
              <option value="Digital Marketing">Digital Marketing</option>
              <option value="Business">Business</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <Label htmlFor="experience">Experience Level *</Label>
            <select
              id="experience"
              required
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
            >
              <option value="">Select experience level</option>
              <option value="Beginner">Beginner (Less than 1 year)</option>
              <option value="Intermediate">Intermediate (1-3 years)</option>
              <option value="Expert">Expert (3+ years)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="hourlyRate">Hourly Rate (₹) *</Label>
            <Input
              id="hourlyRate"
              required
              type="number"
              min="0"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
              placeholder="e.g., 500"
            />
          </div>

          <div>
            <Label htmlFor="availability">Availability *</Label>
            <select
              id="availability"
              required
              value={formData.availability}
              onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
            >
              <option value="">Select availability</option>
              <option value="Weekdays">Weekdays</option>
              <option value="Weekends">Weekends</option>
              <option value="Evenings">Evenings (After 5 PM)</option>
              <option value="Flexible">Flexible</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Skill')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSkillModal;
