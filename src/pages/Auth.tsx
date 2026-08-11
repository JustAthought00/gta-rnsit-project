import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Lock, User, CheckCircle, ArrowLeft, KeyRound, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import NebulaBackground from '@/components/NebulaBackground';

type AuthViewMode = 'main' | 'forgot' | 'verify_sent' | 'reset_password';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Only allow same-origin relative redirect targets.
  const rawNext = searchParams.get('next') ?? '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const modeParam = searchParams.get('mode');

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [viewMode, setViewMode] = useState<AuthViewMode>(modeParam === 'reset' ? 'reset_password' : 'main');

  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({
    fullName: '',
    email: '',
    password: '',
    department: '',
    year: ''
  });
  
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sentVerificationEmail, setSentVerificationEmail] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setViewMode('reset_password');
        toast.info('Password recovery link verified. Please set your new password.');
      } else if (session?.user && viewMode !== 'reset_password') {
        navigate(next);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && viewMode !== 'reset_password') {
        navigate(next);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, next, viewMode]);



  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!signInData.email.toLowerCase().endsWith('@rnsit.ac.in')) {
      toast.error('Please use your RNSIT email address (@rnsit.ac.in)');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signInData.email,
        password: signInData.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setSentVerificationEmail(signInData.email);
          setViewMode('verify_sent');
          toast.warning('Please verify your email inbox before logging in.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Signed in successfully!');
        navigate(next);
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!signUpData.email.toLowerCase().endsWith('@rnsit.ac.in')) {
      toast.error('Please use your official RNSIT email address (@rnsit.ac.in)');
      setIsLoading(false);
      return;
    }

    if (signUpData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            full_name: signUpData.fullName,
            department: signUpData.department,
            academic_year: signUpData.year,
          }
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          toast.error('An account with this email already exists. Please sign in.');
        } else {
          toast.error(error.message);
        }
      } else {
        setSentVerificationEmail(signUpData.email);
        if (data.session) {
          toast.success('Account created successfully!');
          navigate(next);
        } else {
          // Email confirmation required
          setViewMode('verify_sent');
          toast.success('Verification link sent to your RNSIT email!');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your RNSIT email address');
      return;
    }
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password reset link sent to your Gmail inbox!');
        setSentVerificationEmail(forgotEmail);
        setViewMode('verify_sent');
      }
    } catch (error) {
      toast.error('Failed to send password reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully! You can now log in.');
        setViewMode('main');
        setActiveTab('signin');
      }
    } catch (error) {
      toast.error('Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!sentVerificationEmail) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: sentVerificationEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        }
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Verification link resent to your email!');
      }
    } catch (error) {
      toast.error('Failed to resend verification email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <NebulaBackground />
      
      <Card className="w-full max-w-md crystal-card relative z-10">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (viewMode !== 'main') setViewMode('main');
                else navigate('/');
              }}
              className="p-2 text-foreground/70 hover:text-foreground hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {viewMode !== 'main' ? 'Back to Auth' : 'Back'}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl text-foreground">
              {viewMode === 'forgot' && 'Reset Password'}
              {viewMode === 'verify_sent' && 'Verify Email'}
              {viewMode === 'reset_password' && 'New Password'}
              {viewMode === 'main' && 'Welcome to GTA'}
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            {viewMode === 'forgot' && 'Enter your RNSIT email to receive a password reset link'}
            {viewMode === 'verify_sent' && 'We have sent a verification link to your Gmail inbox'}
            {viewMode === 'reset_password' && 'Enter your new password below'}
            {viewMode === 'main' && 'Sign in or create an account with your RNSIT email'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* EMAIL VERIFICATION SENT VIEW */}
          {viewMode === 'verify_sent' && (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <Mail className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground text-lg">Check your Gmail Inbox</h3>
                <p className="text-sm text-muted-foreground">
                  We sent a link to <span className="font-semibold text-primary">{sentVerificationEmail || 'your email'}</span>.
                </p>
                <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border">
                  Click the link inside your email to verify your RNSIT account or reset your password, then return here to log in.
                </p>
              </div>

              <div className="pt-2 space-y-2">
                <Button 
                  onClick={handleResendVerification} 
                  variant="outline" 
                  className="w-full border-primary/30 text-primary hover:bg-primary/10"
                  disabled={isLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resend Email Link
                </Button>
                <Button 
                  onClick={() => setViewMode('main')} 
                  className="w-full plasma-button text-primary-foreground"
                >
                  Return to Sign In
                </Button>
              </div>
            </div>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {viewMode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-foreground">RNSIT Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="yourname@rnsit.ac.in"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="pl-10 bg-card/50 border-primary/20 focus:border-primary/50"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full plasma-button text-primary-foreground" disabled={isLoading}>
                {isLoading ? 'Sending Link...' : 'Send Reset Link to Gmail'}
              </Button>
            </form>
          )}

          {/* RESET PASSWORD FORM */}
          {viewMode === 'reset_password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-foreground">New Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 bg-card/50 border-primary/20 focus:border-primary/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-foreground">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-card/50 border-primary/20 focus:border-primary/50"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full plasma-button text-primary-foreground" disabled={isLoading}>
                {isLoading ? 'Updating Password...' : 'Update Password & Sign In'}
              </Button>
            </form>
          )}

          {/* MAIN SIGN IN / SIGN UP TABS */}
          {viewMode === 'main' && (
            <div className="space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                  <TabsTrigger value="signin" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="space-y-4 mt-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-foreground">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="yourname@rnsit.ac.in"
                          value={signInData.email}
                          onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                          className="pl-10 bg-card/50 border-primary/20 focus:border-primary/50"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password" className="text-foreground">Password</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(signInData.email);
                            setViewMode('forgot');
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="Enter your password"
                          value={signInData.password}
                          onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                          className="pl-10 bg-card/50 border-primary/20 focus:border-primary/50"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full plasma-button text-primary-foreground" disabled={isLoading}>
                      {isLoading ? 'Signing In...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4 mt-4">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-foreground">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Enter your full name"
                          value={signUpData.fullName}
                          onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                          className="pl-10 bg-card/50 border-primary/20 focus:border-primary/50"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-foreground">RNSIT Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="yourname@rnsit.ac.in"
                          value={signUpData.email}
                          onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                          className="pl-10 bg-card/50 border-primary/20 focus:border-primary/50"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-foreground">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Create a password (min 6 chars)"
                          value={signUpData.password}
                          onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                          className="pl-10 bg-card/50 border-primary/20 focus:border-primary/50"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-department" className="text-foreground">Department</Label>
                      <select
                        id="signup-department"
                        value={signUpData.department}
                        onChange={(e) => setSignUpData({ ...signUpData, department: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg bg-card/50 text-foreground border-primary/20 focus:border-primary/50 focus:outline-none"
                        required
                      >
                        <option value="">Select your department</option>
                        <option value="Computer Science">Computer Science & Engineering</option>
                        <option value="Information Science">Information Science & Engineering</option>
                        <option value="Electronics">Electronics & Communication</option>
                        <option value="Mechanical">Mechanical Engineering</option>
                        <option value="Civil">Civil Engineering</option>
                        <option value="Electrical">Electrical & Electronics</option>
                        <option value="MBA">Master of Business Administration</option>
                        <option value="MCA">Master of Computer Applications</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-year" className="text-foreground">Academic Year</Label>
                      <select
                        id="signup-year"
                        value={signUpData.year}
                        onChange={(e) => setSignUpData({ ...signUpData, year: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg bg-card/50 text-foreground border-primary/20 focus:border-primary/50 focus:outline-none"
                        required
                      >
                        <option value="">Select your year</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                        <option value="Graduate">Graduate</option>
                        <option value="Post Graduate">Post Graduate</option>
                      </select>
                    </div>

                    <Button type="submit" className="w-full plasma-button text-primary-foreground" disabled={isLoading}>
                      {isLoading ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;