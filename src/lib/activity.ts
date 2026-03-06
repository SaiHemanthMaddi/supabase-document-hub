import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';

type ActivityInsert = TablesInsert<'activity_logs'>;

export async function logActivity(entry: ActivityInsert) {
  const { error } = await supabase.from('activity_logs').insert(entry);
  if (error) {
    // Non-blocking: activity logging should never break the main workflow.
    console.error('Activity log insert failed:', error.message);
  }
}
