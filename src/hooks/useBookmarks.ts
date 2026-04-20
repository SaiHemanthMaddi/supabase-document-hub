import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { logActivity } from '@/lib/activity';
import type { Tables } from '@/integrations/supabase/types';
import { useMemo } from 'react';

type BookmarkRow = Tables<'bookmarks'>;
type DocumentRow = Tables<'documents'>;

export function useBookmarks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const bookmarksQuery = useQuery({
    queryKey: ['bookmarks', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*, documents(*)');

      if (error) throw error;
      return data ?? [];
    },
  });

  const bookmarkedIds = useMemo(
    () => new Set((bookmarksQuery.data ?? []).map((item) => item.document_id)),
    [bookmarksQuery.data],
  );

  const toggleBookmarkMutation = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      if (!user?.id) throw new Error('You must be signed in to bookmark files.');

      if (bookmarkedIds.has(doc.id)) {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('document_id', doc.id);
        if (error) throw error;
        await logActivity({
          user_id: user.id,
          event_type: 'bookmark_removed',
          entity_type: 'document',
          entity_id: doc.id,
          metadata: { title: doc.title },
        });
        return 'removed';
      }

      const { error } = await supabase.from('bookmarks').insert({
        user_id: user.id,
        document_id: doc.id,
      });
      if (error) throw error;
      await logActivity({
        user_id: user.id,
        event_type: 'bookmark_added',
        entity_type: 'document',
        entity_id: doc.id,
        metadata: { title: doc.title },
      });
      return 'added';
    },
    onSuccess: async (state) => {
      await queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] });
      toast({
        title: state === 'added' ? 'Bookmarked' : 'Bookmark removed',
        description:
          state === 'added' ? 'Document saved to bookmarks.' : 'Document removed from bookmarks.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Bookmark failed',
        description: error.message,
      });
    },
  });

  return {
    bookmarks: bookmarksQuery.data ?? [],
    bookmarkedIds,
    isLoading: bookmarksQuery.isLoading,
    toggleBookmark: toggleBookmarkMutation.mutate,
    isToggling: toggleBookmarkMutation.isPending,
  };
}
