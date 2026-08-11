import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Calendar, MapPin, Clock, Crown, MessageCircle, Pencil, Trash2, UserCheck, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MessagesModal from './MessagesModal';
import NebulaBackground from './NebulaBackground';
import AddActivityModal from './AddActivityModal';
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

const ActivityDetail = () => {
  const { activityId } = useParams();
  const navigate = useNavigate();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [dbActivity, setDbActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [joining, setJoining] = useState(false);

  // Check auth and fetch activity
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setIsSignedIn(true);
      }
    };
    checkAuth();
    fetchActivity();
    fetchParticipants();
  }, [activityId]);

  const fetchParticipants = async () => {
    if (!activityId) return;
    const { data } = await supabase
      .from('activity_participants')
      .select('user_id')
      .eq('activity_id', activityId);
    setParticipantIds(data?.map(p => p.user_id) || []);
  };

  const fetchActivity = async () => {
    // First check if it's a UUID (database activity)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (activityId && uuidRegex.test(activityId)) {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .maybeSingle();

      if (data) {
        // No FK between activities and profiles for PostgREST to auto-embed —
        // both just reference auth.users independently — so fetch the owner separately.
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('full_name, department, academic_year')
          .eq('user_id', data.user_id)
          .maybeSingle();
        setDbActivity({ ...data, profiles: ownerProfile });
      }
    }
    setLoading(false);
  };

  const handleMessageOrganizer = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setShowMessagesModal(true);
  };

  const deleteActivity = async () => {
    if (!activityId) return;
    setDeleting(true);
    const { error } = await supabase.from('activities').delete().eq('id', activityId);
    setDeleting(false);
    if (error) {
      toast.error('Failed to delete activity: ' + error.message);
      return;
    }
    toast.success('Activity deleted');
    navigate('/');
  };

  const isJoined = user ? participantIds.includes(user.id) : false;
  const isFull = dbActivity?.max_participants ? participantIds.length >= dbActivity.max_participants : false;

  const toggleJoin = async () => {
    if (!user || !activityId) {
      navigate('/auth');
      return;
    }
    setJoining(true);
    if (isJoined) {
      const { error } = await supabase
        .from('activity_participants')
        .delete()
        .eq('activity_id', activityId)
        .eq('user_id', user.id);
      if (error) {
        toast.error('Failed to leave: ' + error.message);
      } else {
        toast.success('You left this activity');
        setParticipantIds(prev => prev.filter(id => id !== user.id));
      }
    } else {
      if (isFull) {
        toast.error('This activity is full');
        setJoining(false);
        return;
      }
      const { error } = await supabase
        .from('activity_participants')
        .insert({ activity_id: activityId, user_id: user.id });
      if (error) {
        toast.error('Failed to join: ' + error.message);
      } else {
        toast.success("You're in!");
        setParticipantIds(prev => [...prev, user.id]);
      }
    }
    setJoining(false);
  };

  // All activities come from the database — nothing hardcoded
  const activity = dbActivity ? {
    title: dbActivity.title,
    description: dbActivity.description || 'No description provided',
    category: dbActivity.category,
    maxParticipants: dbActivity.max_participants,
    owner: dbActivity.profiles,
    ownerUserId: dbActivity.user_id,
    date: dbActivity.date,
    time: dbActivity.time,
    venue: dbActivity.venue,
    requirements: dbActivity.requirements,
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NebulaBackground />
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <NebulaBackground />
        <div className="text-center relative z-10">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Activity not found</h1>
          <p className="text-muted-foreground mb-4">This activity may have been removed or doesn't exist.</p>
          <Button onClick={() => navigate('/')} className="plasma-button text-primary-foreground">
            Go back home
          </Button>
        </div>
      </div>
    );
  }

  const handleSignIn = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background relative">
      <NebulaBackground />
      
      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/')}
                className="text-foreground/70 hover:text-foreground hover:bg-primary/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {activity.title}
                </h1>
                <p className="text-muted-foreground text-sm">{activity.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {user?.id === activity.ownerUserId && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setShowEditModal(true)} className="text-foreground/70 hover:text-foreground hover:bg-primary/10">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-foreground/70 hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
              {!isSignedIn && (
                <Button onClick={handleSignIn} className="plasma-button text-primary-foreground">
                  Sign In to Join
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10">
        <div className="h-48 relative bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 flex items-center justify-center">
          <Calendar className="h-16 w-16 text-primary/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
        <div className="absolute bottom-4 left-4 text-foreground">
          <div className="flex flex-wrap items-center gap-3">
            {activity.category && (
              <div className="flex items-center space-x-2 bg-card/50 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <Badge className="bg-accent/20 text-accent border-accent/30">{activity.category}</Badge>
              </div>
            )}
            {activity.maxParticipants && (
              <div className="flex items-center space-x-2 bg-card/50 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-semibold">
                  {participantIds.length} / {activity.maxParticipants} joined
                  {isFull && ' — Full'}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Activity Details */}
      {activity && (
        <section className="py-8 px-4 relative z-10">
          <div className="container mx-auto">
            <Card className="crystal-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Activity Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activity.owner && (
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2 border-primary/30">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {activity.owner.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">Organized by {activity.owner.full_name}</p>
                        <p className="text-sm text-muted-foreground">{activity.owner.department} • {activity.owner.academic_year}</p>
                      </div>
                    </div>
                  )}
                  {activity.date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>{activity.date}</span>
                    </div>
                  )}
                  {activity.time && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 text-accent" />
                      <span>{activity.time}</span>
                    </div>
                  )}
                  {activity.venue && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{activity.venue}</span>
                    </div>
                  )}
                </div>
                {activity.requirements && (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Requirements:</span> {activity.requirements}
                    </p>
                  </div>
                )}
                {user?.id !== activity.ownerUserId && (
                  <div className="pt-4 border-t border-border/50 flex flex-wrap gap-3">
                    <Button
                      variant={isJoined ? 'outline' : 'default'}
                      className={isJoined ? 'border-primary/40' : 'plasma-button text-primary-foreground'}
                      onClick={toggleJoin}
                      disabled={joining || (!isJoined && isFull && isSignedIn)}
                    >
                      {isJoined ? <UserMinus className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                      {!isSignedIn
                        ? 'Sign In to Join'
                        : joining
                          ? 'Please wait...'
                          : isJoined
                            ? 'Leave Activity'
                            : isFull
                              ? 'Activity Full'
                              : 'Join Activity'}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-primary/40"
                      onClick={handleMessageOrganizer}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {isSignedIn ? 'Message the Organizer' : 'Sign In to Message the Organizer'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Messages Modal */}
      <MessagesModal
        isOpen={showMessagesModal}
        onClose={() => setShowMessagesModal(false)}
        currentUser={user ? { id: user.id, fullName: user.user_metadata?.full_name || 'User' } : null}
      />

      {dbActivity && (
        <AddActivityModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onActivityAdded={() => fetchActivity()}
          activityToEdit={{
            id: dbActivity.id,
            title: dbActivity.title,
            description: dbActivity.description,
            category: dbActivity.category,
            date: dbActivity.date,
            time: dbActivity.time,
            venue: dbActivity.venue,
            max_participants: dbActivity.max_participants,
            requirements: dbActivity.requirements,
          }}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{activity.title}" and its reviews. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteActivity} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ActivityDetail;