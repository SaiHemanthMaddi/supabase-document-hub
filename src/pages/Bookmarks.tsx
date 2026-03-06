import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Download, Loader2, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type BookmarkResult = {
  id: string;
  created_at: string;
  document_id: string;
  documents: {
    id: string;
    title: string;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
    storage_path: string;
    created_at: string;
  } | null;
};

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function Bookmarks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bookmarksQuery = useQuery({
    queryKey: ['bookmarks', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select(
          'id, created_at, document_id, documents:document_id(id, title, original_filename, mime_type, size_bytes, storage_path, created_at)',
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as BookmarkResult[];
    },
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: async (bookmarkId: string) => {
      const { error } = await supabase.from('bookmarks').delete().eq('id', bookmarkId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['documents', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['documents-search', user?.id] }),
      ]);
      toast({ title: 'Bookmark removed', description: 'Removed from saved documents.' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Remove failed',
        description: error.message,
      });
    },
  });

  const handleDownload = async (item: BookmarkResult) => {
    if (!item.documents) return;

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(item.documents.storage_path, 60);

    if (error || !data?.signedUrl) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: error?.message || 'Could not create a download link.',
      });
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const items = (bookmarksQuery.data ?? []).filter((item) => item.documents);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bookmarks</h1>
          <p className="text-muted-foreground">Your saved documents and collections</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Saved Documents</CardTitle>
            <CardDescription>Documents you've bookmarked for later</CardDescription>
          </CardHeader>
          <CardContent>
            {bookmarksQuery.isLoading ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : bookmarksQuery.isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load bookmarks. Please refresh.
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Bookmark className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">No bookmarks yet</p>
                  <p className="text-sm text-muted-foreground">
                    Save documents to access them quickly later
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {item.documents?.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {item.documents?.original_filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.documents?.mime_type} �{' '}
                        {formatFileSize(item.documents?.size_bytes ?? 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleDownload(item)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeBookmarkMutation.mutate(item.id)}
                        disabled={removeBookmarkMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
