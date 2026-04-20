import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type ActivityLog = Tables<'activity_logs'>;

export function useActivity() {
  const { user } = useAuth();

  const activityQuery = useQuery({
    queryKey: ['activity-logs', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as ActivityLog[];
    },
  });

  return {
    activities: activityQuery.data ?? [],
    isLoading: activityQuery.isLoading,
    isError: activityQuery.isError,
    refetch: activityQuery.refetch,
  };
}
