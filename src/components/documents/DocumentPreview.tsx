import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, ExternalLink, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    title: string;
    storage_path: string;
    mime_type: string;
  } | null;
}

export function DocumentPreview({ isOpen, onClose, document }: DocumentPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && document) {
      fetchSignedUrl();
    } else {
      setUrl(null);
      setError(null);
    }
  }, [isOpen, document]);

  const fetchSignedUrl = async () => {
    if (!document) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.storage_path, 3600); // 1 hour

      if (error) throw error;
      if (data?.signedUrl) {
        setUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Error fetching signed URL:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load preview';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isImage = document?.mime_type.startsWith('image/');
  const isPdf = document?.mime_type === 'application/pdf';
  const isPlainText = document?.mime_type === 'text/plain';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="truncate pr-8">{document?.title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 relative bg-muted/30 flex items-center justify-center overflow-auto">
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating secure preview...</p>
            </div>
          )}

          {error && (
            <div className="text-center p-6">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={fetchSignedUrl}>Retry</Button>
            </div>
          )}

          {!loading && !error && url && (
            <>
              {isImage && (
                <img
                  src={url}
                  alt={document?.title}
                  className="max-w-full max-h-full object-contain shadow-lg"
                />
              )}

              {isPdf && (
                <iframe
                  src={`${url}#toolbar=0`}
                  className="w-full h-full border-none"
                  title={document?.title}
                />
              )}

              {isPlainText && (
                <iframe
                  src={url}
                  className="w-full h-full border-none bg-white p-4"
                  title={document?.title}
                />
              )}

              {!isImage && !isPdf && !isPlainText && (
                <div className="text-center p-6">
                  <p className="mb-4">
                    Preview not available for this file type ({document?.mime_type})
                  </p>
                  <Button asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download to View
                    </a>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center bg-card">
          <p className="text-xs text-muted-foreground">Securely served from Supabase Storage</p>
          <div className="flex gap-2">
            {url && (
              <Button variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in New Tab
                </a>
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
