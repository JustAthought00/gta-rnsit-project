import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Users, Star, Bookmark, BookmarkCheck, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NebulaBackground from './NebulaBackground';
import MessagesModal from './MessagesModal';
import AddSkillModal from './AddSkillModal';
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

const SkillDetail = () => {
  const { skillId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [dbSkill, setDbSkill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchSkillData();
  }, [skillId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      setCurrentUser({ id: session.user.id, fullName: profile?.full_name || 'User' });
    }
  };

  const fetchSkillData = async () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (skillId && uuidRegex.test(skillId)) {
      const { data } = await supabase
        .from('skills')
        .select('*')
        .eq('id', skillId)
        .maybeSingle();

      if (data) {
        // Get owner profile
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user_id)
          .maybeSingle();
        setDbSkill({ ...data, owner: ownerProfile });

        // Load reviews
        loadReviews(skillId);
        // Check bookmark
        checkBookmark(skillId);
      }
    }
    setLoading(false);
  };

  const loadReviews = async (targetId: string) => {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('target_id', targetId)
      .eq('target_type', 'skill')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setReviews(data.map(r => ({ ...r, profile: profileMap.get(r.user_id) })));
    } else {
      setReviews([]);
    }
  };

  const checkBookmark = async (targetId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('target_id', targetId)
      .eq('target_type', 'skill')
      .maybeSingle();
    setIsBookmarked(!!data);
  };

  const toggleBookmark = async () => {
    if (!currentUser || !skillId) {
      toast.error('Please sign in to bookmark');
      return;
    }
    if (isBookmarked) {
      await supabase.from('bookmarks').delete()
        .eq('user_id', currentUser.id)
        .eq('target_id', skillId)
        .eq('target_type', 'skill');
      setIsBookmarked(false);
      toast.success('Bookmark removed');
    } else {
      await supabase.from('bookmarks').insert({
        user_id: currentUser.id,
        target_id: skillId,
        target_type: 'skill',
      });
      setIsBookmarked(true);
      toast.success('Bookmarked!');
    }
  };

  const submitReview = async () => {
    if (!currentUser || !skillId) {
      toast.error('Please sign in to leave a review');
      return;
    }
    setSubmittingReview(true);
    const { error } = await supabase.from('reviews').insert({
      user_id: currentUser.id,
      target_id: skillId,
      target_type: 'skill',
      rating: newRating,
      comment: newComment.trim() || null,
    });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'You already reviewed this skill' : 'Failed to submit review');
    } else {
      toast.success('Review submitted!');
      setNewComment('');
      setNewRating(5);
      loadReviews(skillId);
    }
    setSubmittingReview(false);
  };

  const deleteSkill = async () => {
    if (!skillId) return;
    setDeleting(true);
    const { error } = await supabase.from('skills').delete().eq('id', skillId);
    setDeleting(false);
    if (error) {
      toast.error('Failed to delete skill: ' + error.message);
      return;
    }
    toast.success('Skill deleted');
    navigate('/');
  };

  const skill = dbSkill ? {
    name: dbSkill.title,
    description: dbSkill.description || 'No description provided',
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NebulaBackground />
        <div className="relative z-10">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading skill...</p>
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NebulaBackground />
        <div className="text-center relative z-10">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Skill not found</h1>
          <Button onClick={() => navigate('/')} className="plasma-button text-primary-foreground">Go back home</Button>
        </div>
      </div>
    );
  }



  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />

      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-foreground/70 hover:text-foreground hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{skill.name}</h1>
                <p className="text-muted-foreground text-sm">{skill.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dbSkill && currentUser?.id === dbSkill.user_id && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setShowEditModal(true)} className="text-muted-foreground hover:text-primary">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
              {dbSkill && (
                <Button variant="ghost" size="sm" onClick={toggleBookmark} className="text-muted-foreground hover:text-primary">
                  {isBookmarked ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* DB Skill Owner Card */}
        {dbSkill?.owner && (
          <Card className="crystal-card mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-primary/30">
                  <AvatarImage src={dbSkill.owner.avatar_url} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {dbSkill.owner.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p
                    className="font-semibold text-foreground hover:text-primary cursor-pointer"
                    onClick={() => navigate(`/user/${dbSkill.user_id}`)}
                  >
                    {dbSkill.owner.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{dbSkill.owner.department} • {dbSkill.owner.academic_year}</p>
                  {dbSkill.experience && <Badge variant="outline" className="mt-1 text-xs border-border">{dbSkill.experience}</Badge>}
                </div>
                <div className="flex gap-2">
                  {dbSkill.hourly_rate && <Badge className="bg-accent/20 text-accent border-accent/30">₹{dbSkill.hourly_rate}/hr</Badge>}
                  {dbSkill.availability && <Badge variant="outline" className="border-border">{dbSkill.availability}</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reviews Section for DB skills */}
        {dbSkill && (
          <Card className="crystal-card mb-6">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Star className="h-5 w-5 text-accent" />
                Reviews {reviews.length > 0 && `(${avgRating.toFixed(1)} avg)`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Write review */}
              {currentUser && currentUser.id !== dbSkill.user_id && (
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-foreground">Leave a review</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setNewRating(star)}>
                        <Star className={`h-5 w-5 ${star <= newRating ? 'fill-accent text-accent' : 'text-muted-foreground'}`} />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write your review..."
                    className="bg-background border-border"
                  />
                  <Button onClick={submitReview} disabled={submittingReview} size="sm" className="plasma-button text-primary-foreground">
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              )}

              {/* Review list */}
              {reviews.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No reviews yet. Be the first!</p>
              ) : (
                reviews.map(review => (
                  <div key={review.id} className="flex gap-3 p-3 rounded-lg bg-muted/20">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={review.profile?.avatar_url} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {review.profile?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{review.profile?.full_name || 'Anonymous'}</span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`h-3 w-3 ${s <= review.rating ? 'fill-accent text-accent' : 'text-muted-foreground'}`} />
                          ))}
                        </div>
                      </div>
                      {review.comment && <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}


      </div>

      <MessagesModal isOpen={showMessagesModal} onClose={() => setShowMessagesModal(false)} currentUser={currentUser} />

      {dbSkill && (
        <AddSkillModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSkillAdded={() => fetchSkillData()}
          skillToEdit={{
            id: dbSkill.id,
            title: dbSkill.title,
            description: dbSkill.description,
            category: dbSkill.category,
            experience: dbSkill.experience,
            hourly_rate: dbSkill.hourly_rate,
            availability: dbSkill.availability,
          }}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this skill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{skill.name}" and its reviews. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSkill} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SkillDetail;
