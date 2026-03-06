import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search as SearchIcon, Download, Loader2, Bookmark } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type DocumentRow = Tables<'documents'>;
type BookmarkRow = Tables<'bookmarks'>;
type FileFilter = 'all' | 'pdf' | 'image' | 'other';

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function matchesFilter(doc: DocumentRow, filter: FileFilter) {
  if (filter === 'all') return true;
  if (filter === 'pdf') return doc.mime_type === 'application/pdf';
  if (filter === 'image') return doc.mime_type.startsWith('image/');
  return doc.mime_type !== 'application/pdf' && !doc.mime_type.startsWith('image/');
}

export default function Search() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');

  const documentsQuery = useQuery({
    queryKey: ['documents-search', user?.id, searchQuery],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const term = searchQuery.trim();
      if (term) {
        query = query.or(`title.ilike.%${term}%,original_filename.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
  });

  const bookmarksQuery = useQuery({
    queryKey: ['bookmarks', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from('bookmarks').select('*');
      if (error) throw error;
      return (data ?? []) as BookmarkRow[];
    },
  });

  const bookmarkedIds = useMemo(
    () => new Set((bookmarksQuery.data ?? []).map((item) => item.document_id)),
    [bookmarksQuery.data]
  );

  const bookmarkMutation = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      if (!user?.id) throw new Error('You must be signed in to bookmark files.');

      if (bookmarkedIds.has(doc.id)) {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('document_id', doc.id);
        if (error) throw error;
        return 'removed';
      }

      const { error } = await supabase.from('bookmarks').insert({
        user_id: user.id,
        document_id: doc.id,
      });
      if (error) throw error;
      return 'added';
    },
    onSuccess: async (state) => {
      await queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] });
      toast({
        title: state === 'added' ? 'Bookmarked' : 'Bookmark removed',
        description: state === 'added' ? 'Document saved to bookmarks.' : 'Document removed from bookmarks.',
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

  const filteredDocs = useMemo(
    () => (documentsQuery.data ?? []).filter((doc) => matchesFilter(doc, fileFilter)),
    [documentsQuery.data, fileFilter]
  );

  const handleDownload = async (doc: DocumentRow) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60);

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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Search</h1>
          <p className="text-muted-foreground">Find documents across your library</p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title or filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant={fileFilter === 'all' ? 'default' : 'outline'} onClick={() => setFileFilter('all')}>All</Button>
            <Button variant={fileFilter === 'pdf' ? 'default' : 'outline'} onClick={() => setFileFilter('pdf')}>PDF</Button>
            <Button variant={fileFilter === 'image' ? 'default' : 'outline'} onClick={() => setFileFilter('image')}>Images</Button>
            <Button variant={fileFilter === 'other' ? 'default' : 'outline'} onClick={() => setFileFilter('other')}>Other</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              {searchQuery
                ? `${filteredDocs.length} result(s) for "${searchQuery}"`
                : `${filteredDocs.length} document(s) available`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documentsQuery.isLoading ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : documentsQuery.isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Failed to fetch documents. Please refresh.
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <p>No results found. Try another search term or filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{doc.title}</p>
                      <p className="truncate text-sm text-muted-foreground">{doc.original_filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.mime_type} • {formatFileSize(doc.size_bytes)} • {new Date(doc.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={bookmarkedIds.has(doc.id) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => bookmarkMutation.mutate(doc)}
                        disabled={bookmarkMutation.isPending || bookmarksQuery.isLoading}
                      >
                        <Bookmark className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(doc)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
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
