import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { logActivity } from '@/lib/activity';
import { sanitizeFileName } from '@/lib/sanitizers';
import type { Tables } from '@/integrations/supabase/types';

export type DocumentRow = Tables<'documents'>;

export function useDocuments() {
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

      const { error: deleteRowError } = await supabase.from('documents').delete().eq('id', doc.id);
      if (deleteRowError) throw deleteRowError;

      const { error: deleteStorageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);

      if (deleteStorageError) {
        toast({
          variant: 'destructive',
          title: 'Storage cleanup issue',
          description: 'Metadata deleted, but file cleanup failed.',
        });
      }

      await logActivity({
        user_id: user.id,
        event_type: 'document_deleted',
        entity_type: 'document',
        entity_id: doc.id,
        metadata: { title: doc.title, original_filename: doc.original_filename },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', user?.id] });
      toast({ title: 'Deleted', description: 'Document removed.' });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (docsToDelete: DocumentRow[]) => {
      if (!user?.id) throw new Error('You must be signed in.');
      
      const ids = docsToDelete.map(d => d.id);
      const paths = docsToDelete.map(d => d.storage_path);

      const { error: deleteRowError } = await supabase.from('documents').delete().in('id', ids);
      if (deleteRowError) throw deleteRowError;

      const { error: deleteStorageError } = await supabase.storage.from('documents').remove(paths);
      if (deleteStorageError) throw deleteStorageError;

      for (const doc of docsToDelete) {
        await logActivity({
          user_id: user.id,
          event_type: 'document_deleted',
          entity_type: 'document',
          entity_id: doc.id,
          metadata: { title: doc.title, original_filename: doc.original_filename },
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents', user?.id] });
      toast({ title: 'Batch Deleted', description: 'Selected documents removed.' });
    },
  });

  const handleDownload = async (doc: DocumentRow) => {
    if (!user?.id) return;

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
      metadata: { title: doc.title, original_filename: doc.original_filename },
    });
  };

  return {
    documents: documentsQuery.data ?? [],
    isLoading: documentsQuery.isLoading,
    isError: documentsQuery.isError,
    uploadDocument: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteDocument: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    batchDeleteDocuments: batchDeleteMutation.mutateAsync,
    isBatchDeleting: batchDeleteMutation.isPending,
    downloadDocument: handleDownload,
  };
}
