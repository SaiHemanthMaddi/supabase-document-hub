import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { logActivity } from '@/lib/activity';
import { useNavigate } from 'react-router-dom';

export function useAccount() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const updateEmailMutation = useMutation({
    mutationFn: async (newEmail: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;

      await logActivity({
        user_id: user.id,
        event_type: 'email_change_requested',
        entity_type: 'security',
        entity_id: null,
        metadata: { next_email: newEmail },
      });
    },
    onSuccess: () => {
      toast({
        title: 'Email change requested',
        description: 'Please confirm the email change from your inbox.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Email update failed',
        description: error.message,
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await logActivity({
        user_id: user.id,
        event_type: 'password_updated',
        entity_type: 'security',
        entity_id: null,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Password updated',
        description: 'Your password was changed successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Password update failed',
        description: error.message,
      });
    },
  });

  const signOutAllSessionsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      await logActivity({
        user_id: user.id,
        event_type: 'all_sessions_logged_out',
        entity_type: 'security',
        entity_id: null,
      });

      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Signed out from all sessions',
        description: 'All active sessions were revoked.',
      });
      navigate('/auth');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Logout failed',
        description: error.message,
      });
    },
  });

  const signOutCurrentDeviceMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      await logActivity({
        user_id: user.id,
        event_type: 'current_session_logged_out',
        entity_type: 'security',
        entity_id: null,
      });

      await signOut();
    },
    onSuccess: () => {
      navigate('/auth');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Sign out failed',
        description: error.message,
      });
    },
  });

  return {
    updateEmail: updateEmailMutation.mutateAsync,
    isUpdatingEmail: updateEmailMutation.isPending,
    updatePassword: updatePasswordMutation.mutateAsync,
    isUpdatingPassword: updatePasswordMutation.isPending,
    signOutAllSessions: signOutAllSessionsMutation.mutateAsync,
    isSigningOutAll: signOutAllSessionsMutation.isPending,
    signOutCurrentDevice: signOutCurrentDeviceMutation.mutateAsync,
    isSigningOutCurrent: signOutCurrentDeviceMutation.isPending,
    isBusy:
      updateEmailMutation.isPending ||
      updatePasswordMutation.isPending ||
      signOutAllSessionsMutation.isPending ||
      signOutCurrentDeviceMutation.isPending,
  };
}
