import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase-config';
import { useAccount } from '@/hooks/useAccount';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    updateEmail,
    updatePassword,
    signOutAllSessions,
    signOutCurrentDevice,
    isUpdatingEmail,
    isUpdatingPassword,
    isSigningOutAll,
    isSigningOutCurrent,
    isBusy,
  } = useAccount();

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const supabaseReady = isSupabaseConfigured();

  const handleEmailUpdate = async () => {
    const nextEmail = newEmail.trim();
    if (!nextEmail) return;

    if (nextEmail.toLowerCase() === (user?.email ?? '').toLowerCase()) {
      toast({
        variant: 'destructive',
        title: 'No changes',
        description: 'New email must be different from current email.',
      });
      return;
    }

    try {
      await updateEmail(nextEmail);
      setNewEmail('');
    } catch (err) {
      // Error handled in hook toast
    }
  };

  const handlePasswordUpdate = async () => {
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
      await updatePassword(nextPassword);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      // Error handled in hook toast
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
                {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              <Button onClick={signOutCurrentDevice} disabled={!supabaseReady || isBusy}>
                {isSigningOutCurrent ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Sign Out This Device
              </Button>
              <Button
                variant="destructive"
                onClick={signOutAllSessions}
                disabled={!supabaseReady || isBusy}
              >
                {isSigningOutAll ? (
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
