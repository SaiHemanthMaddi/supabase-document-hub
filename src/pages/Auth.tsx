import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/lib/errors';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const { signUp, signIn } = useAuth();
  const { toast } = useToast();
  const resetRedirectUrl = useMemo(() => `${window.location.origin}/auth?mode=reset`, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const modeFromQuery = params.get('mode');
    const typeFromHash = hash.get('type');
    if (modeFromQuery === 'reset' || typeFromHash === 'recovery') {
      setIsResetMode(true);
    }
  }, []);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!isResetMode) {
      try {
        emailSchema.parse(email);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.email = e.errors[0].message;
        }
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    if (isResetMode && password !== confirmPassword) {
      newErrors.password = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (isResetMode) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Reset failed',
            description: error.message,
          });
          return;
        }

        toast({
          title: 'Password reset successful',
          description: 'Please sign in with your new password.',
        });
        setPassword('');
        setConfirmPassword('');
        setIsResetMode(false);
      } else if (isSignUp) {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              variant: 'destructive',
              title: 'Account exists',
              description: 'An account with this email already exists. Please sign in instead.',
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Sign up failed',
              description: getErrorMessage(error, 'Could not create your account.'),
            });
          }
        } else {
          toast({
            title: 'Check your email',
            description: 'We sent you a confirmation link. Please check your email to verify your account.',
          });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Sign in failed',
            description: getErrorMessage(error, 'Could not sign you in.'),
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim();
    try {
      emailSchema.parse(normalizedEmail);
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast({
          variant: 'destructive',
          title: 'Invalid email',
          description: e.errors[0].message,
        });
      }
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: resetRedirectUrl,
      });
      if (error) throw error;

      toast({
        title: 'Reset email sent',
        description: 'Check your inbox for the password reset link.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Reset request failed',
        description: getErrorMessage(error, 'Could not send reset email.'),
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Document Hub</CardTitle>
          <CardDescription>
            {isResetMode
              ? 'Set a new password for your account'
              : isSignUp
                ? 'Create an account to get started'
                : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isSignUp && !isResetMode && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}
            {!isResetMode && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>
            {isResetMode && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isResetMode ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
            {!isSignUp && !isResetMode && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleForgotPassword}
                disabled={isSendingReset || isLoading}
              >
                {isSendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Forgot Password
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                if (isResetMode) {
                  setIsResetMode(false);
                } else {
                  setIsSignUp(!isSignUp);
                }
                setErrors({});
              }}
            >
              {isResetMode
                ? 'Back to sign in'
                : isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
