import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { logActivity } from '@/lib/activity';
import { getErrorMessage } from '@/lib/errors';
import { isSupabaseConfigured } from '@/lib/supabase-config';

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const [newEmail, setNewEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSigningOutDevice, setIsSigningOutDevice] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const supabaseReady = isSupabaseConfigured();
  const isBusy = isUpdatingEmail || isSavingPassword || isSigningOutDevice || isLoggingOutAll;

  const handleEmailUpdate = async () => {
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Not signed in',
        description: 'Please sign in again and retry.',
      });
      return;
    }

    const nextEmail = newEmail.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail);
    if (!isValidEmail) {
      toast({
        variant: 'destructive',
        title: 'Invalid email',
        description: 'Enter a valid email address.',
      });
      return;
    }

    if (nextEmail.toLowerCase() === (user.email ?? '').toLowerCase()) {
      toast({
        variant: 'destructive',
        title: 'No changes',
        description: 'New email must be different from current email.',
      });
      return;
    }

    try {
      setIsUpdatingEmail(true);
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;

      await logActivity({
        user_id: user.id,
        event_type: 'email_change_requested',
        entity_type: 'security',
        entity_id: null,
        metadata: { next_email: nextEmail },
      });

      setNewEmail('');
      toast({
        title: 'Email change requested',
        description: 'Please confirm the email change from your inbox.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Email update failed',
        description: getErrorMessage(error, 'Unable to update email.'),
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Not signed in',
        description: 'Please sign in again and retry.',
      });
      return;
    }

    const nextPassword = newPassword.trim();
    if (nextPassword.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Invalid password',
        description: 'Password must be at least 8 characters.',
      });
      return;
    }

    if (nextPassword !== confirmPassword.trim()) {
      toast({
        variant: 'destructive',
        title: 'Passwords do not match',
        description: 'Please make sure both password fields match.',
      });
      return;
    }

    try {
      setIsSavingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) throw error;

      await logActivity({
        user_id: user.id,
        event_type: 'password_updated',
        entity_type: 'security',
        entity_id: null,
        metadata: {},
      });

      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: 'Password updated',
        description: 'Your password was changed successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Password update failed',
        description: getErrorMessage(error, 'Unable to update password.'),
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Not signed in',
        description: 'Please sign in again and retry.',
      });
      return;
    }

    try {
      setIsLoggingOutAll(true);
      await logActivity({
        user_id: user.id,
        event_type: 'all_sessions_logged_out',
        entity_type: 'security',
        entity_id: null,
        metadata: {},
      });
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;

      toast({
        title: 'Signed out from all sessions',
        description: 'All active sessions were revoked.',
      });
      navigate('/auth');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Logout failed',
        description: getErrorMessage(error, 'Could not sign out from all sessions.'),
      });
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  const handleSignOutCurrentDevice = async () => {
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Not signed in',
        description: 'Please sign in again and retry.',
      });
      return;
    }

    try {
      setIsSigningOutDevice(true);
      await logActivity({
        user_id: user.id,
        event_type: 'current_session_logged_out',
        entity_type: 'security',
        entity_id: null,
        metadata: {},
      });
      await signOut();
      navigate('/auth');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Sign out failed',
        description: getErrorMessage(error, 'Unable to sign out.'),
      });
    } finally {
      setIsSigningOutDevice(false);
    }
  };

  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString()
    : 'Unavailable';
  const accountCreated = user?.created_at
    ? new Date(user.created_at).toLocaleString()
    : 'Unavailable';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage important account controls</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Update your primary email address.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">Current Email</Label>
              <Input id="current-email" value={user?.email ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={!supabaseReady || isBusy}
              />
            </div>
            <Button onClick={handleEmailUpdate} disabled={!supabaseReady || isBusy}>
              {isUpdatingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Email
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Change your password securely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimum 8 characters"
                disabled={!supabaseReady || isBusy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat new password"
                disabled={!supabaseReady || isBusy}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handlePasswordUpdate} disabled={!supabaseReady || isBusy}>
                {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>Manage active sessions and device access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm text-foreground">Last sign in: {lastSignIn}</p>
              <p className="text-sm text-muted-foreground">Account created: {accountCreated}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleSignOutCurrentDevice}
                disabled={!supabaseReady || isBusy}
              >
                {isSigningOutDevice ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Sign Out This Device
              </Button>
              <Button
                variant="destructive"
                onClick={handleLogoutAllSessions}
                disabled={!supabaseReady || isBusy}
              >
                {isLoggingOutAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                Logout All Sessions
              </Button>
            </div>

            {!supabaseReady && (
              <p className="text-sm text-muted-foreground">
                Supabase auth is not configured. Set `VITE_SUPABASE_URL` and
                `VITE_SUPABASE_PUBLISHABLE_KEY` to enable security actions.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
