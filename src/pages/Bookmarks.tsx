import { Bookmark, Download, Loader2, X, Eye, FileText } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useDocuments, type DocumentRow } from '@/hooks/useDocuments';
import { formatFileSize } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

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

export default function Bookmarks() {
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const { bookmarks, isLoading, toggleBookmark } = useBookmarks();
  const { downloadDocument } = useDocuments();

  const handleDownload = async (item: BookmarkResult) => {
    if (!item.documents) return;
    await downloadDocument(item.documents as DocumentRow);
  };

  const items = (bookmarks as unknown as BookmarkResult[]).filter((item) => item.documents);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bookmarks</h1>
          <p className="text-muted-foreground">Your saved documents and collections</p>
        </div>

        <Card className="border-muted/60">
          <CardHeader>
            <CardTitle>Saved Documents</CardTitle>
            <CardDescription>Documents you've bookmarked for later</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
                <div className="p-4 bg-muted/40 rounded-full">
                  <Bookmark className="h-10 w-10 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">No bookmarks yet</p>
                  <p className="text-sm">
                    Save documents to access them quickly later.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-muted/50 bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => toggleBookmark(item.documents as DocumentRow)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-4 min-w-0">
                      <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {item.documents?.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground mt-1">
                        {item.documents?.original_filename}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 mt-2">
                        {item.documents?.mime_type.split('/')[1] || 'FILE'} • {formatFileSize(item.documents?.size_bytes ?? 0)}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <Button variant="secondary" size="sm" className="flex-1 text-xs h-8" onClick={() => handleDownload(item)}>
                        <Download className="mr-2 h-3 w-3" />
                        Download
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPreviewDoc(item.documents as DocumentRow)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DocumentPreview 
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />
    </AppLayout>
  );
}
