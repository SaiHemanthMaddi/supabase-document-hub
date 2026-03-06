import { useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Download, Trash2, Loader2, Bookmark } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { logActivity } from '@/lib/activity';

type DocumentRow = Tables<'documents'>;
type BookmarkRow = Tables<'bookmarks'>;

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export default function Documents() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const documentsQuery = useQuery({
    queryKey: ['documents', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
  });

  const bookmarksQuery = useQuery({
    queryKey: ['bookmarks', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*');

      if (error) throw error;
      return (data ?? []) as BookmarkRow[];
    },
  });

  const bookmarkedIds = useMemo(
    () => new Set((bookmarksQuery.data ?? []).map((item) => item.document_id)),
    [bookmarksQuery.data]
  );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('You must be signed in to upload files.');

      const storagePath = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const title = file.name.replace(/\.[^/.]+$/, '') || file.name;
      const { data: insertedDoc, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title,
          original_filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          storage_path: storagePath,
        })
        .select('*')
        .single();

      if (insertError) {
        await supabase.storage.from('documents').remove([storagePath]);
        throw insertError;
      }

      await logActivity({
        user_id: user.id,
        event_type: 'document_uploaded',
        entity_type: 'document',
        entity_id: insertedDoc.id,
        metadata: {
          title: insertedDoc.title,
          original_filename: insertedDoc.original_filename,
          size_bytes: insertedDoc.size_bytes,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', user?.id] });
      toast({ title: 'Uploaded', description: 'Document uploaded successfully.' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      if (!user?.id) throw new Error('You must be signed in.');

      const { error: deleteRowError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (deleteRowError) throw deleteRowError;

      const { error: deleteStorageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);

      if (deleteStorageError) {
        toast({
          variant: 'destructive',
          title: 'Storage cleanup issue',
          description: 'Metadata deleted, but file cleanup failed. Retry later.',
        });
      }

      await logActivity({
        user_id: user.id,
        event_type: 'document_deleted',
        entity_type: 'document',
        entity_id: doc.id,
        metadata: {
          title: doc.title,
          original_filename: doc.original_filename,
        },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['documents', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] }),
      ]);
      toast({ title: 'Deleted', description: 'Document removed.' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
    },
  });

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Unsupported file type',
        description: 'Please upload PDF, Office docs, text files, or PNG/JPEG/WEBP images.',
      });
      event.target.value = '';
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum document size is 20 MB.',
      });
      event.target.value = '';
      return;
    }

    await uploadMutation.mutateAsync(file);
    event.target.value = '';
  };

  const handleDownload = async (doc: DocumentRow) => {
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'You must be signed in to download files.',
      });
      return;
    }

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

    await logActivity({
      user_id: user.id,
      event_type: 'document_downloaded',
      entity_type: 'document',
      entity_id: doc.id,
      metadata: {
        title: doc.title,
        original_filename: doc.original_filename,
      },
    });
  };

  const docs = documentsQuery.data ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Documents</h1>
            <p className="text-muted-foreground">Upload, organize, and access your files.</p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Documents</CardTitle>
            <CardDescription>All uploaded files for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            {documentsQuery.isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : documentsQuery.isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load documents. Please refresh.
              </div>
            ) : docs.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">No documents yet</p>
                  <p className="text-sm text-muted-foreground">Upload your first document to get started.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{doc.title}</p>
                      <p className="truncate text-sm text-muted-foreground">{doc.original_filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.size_bytes)} • {new Date(doc.created_at).toLocaleString()}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(doc)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
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

