import { useMemo, useRef, useState } from 'react';
import { Upload, FileText, Download, Trash2, Loader2, Bookmark, Eye, MoreVertical, Info, CheckCircle2, ChevronDown, SortAsc, SortDesc, X, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocuments, type DocumentRow } from '@/hooks/useDocuments';
import { useBookmarks } from '@/hooks/useBookmarks';
import { formatFileSize } from '@/lib/formatters';
import { MAX_DOCUMENT_SIZE_BYTES, ALLOWED_DOCUMENT_MIME_TYPES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activity';

export type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc';


export default function Documents() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState<'all' | 'pdf' | 'image' | 'other'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailsDoc, setDetailsDoc] = useState<DocumentRow | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    documents,
    isLoading,
    isError,
    uploadDocument,
    isUploading,
    deleteDocument,
    batchDeleteDocuments,
    downloadDocument,
  } = useDocuments();

  const { bookmarkedIds, toggleBookmark } = useBookmarks();

  const handleBatchDelete = async () => {
    const docsToDelete = documents.filter((d) => selectedIds.has(d.id));
    if (docsToDelete.length === 0) return;
    if (confirm(`Are you sure you want to delete ${docsToDelete.length} documents?`)) {
      await batchDeleteDocuments(docsToDelete);
    }
  };

  const handleBatchDownload = async () => {
    const docsToDownload = documents.filter((d) => selectedIds.has(d.id));
    for (const doc of docsToDownload) {
      await downloadDocument(doc);
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  const processFile = async (file: File) => {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Unsupported file type',
        description: 'Please upload PDF, Office docs, text files, or PNG/JPEG/WEBP images.',
      });
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum document size is 20 MB.',
      });
      return;
    }

    await uploadDocument(file);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDownload = async (doc: DocumentRow) => {
    await downloadDocument(doc);
  };

  const docs = useMemo(() => {
    let filtered = documents;
    
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(term) || 
        doc.original_filename.toLowerCase().includes(term)
      );
    }

    if (fileFilter !== 'all') {
      if (fileFilter === 'pdf') {
        filtered = filtered.filter(doc => doc.mime_type === 'application/pdf');
      } else if (fileFilter === 'image') {
        filtered = filtered.filter(doc => doc.mime_type.startsWith('image/'));
      } else {
        filtered = filtered.filter(doc => !doc.mime_type.startsWith('image/') && doc.mime_type !== 'application/pdf');
      }
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name-asc':
          return a.title.localeCompare(b.title);
        case 'name-desc':
          return b.title.localeCompare(a.title);
        case 'size-asc':
          return a.size_bytes - b.size_bytes;
        case 'size-desc':
          return b.size_bytes - a.size_bytes;
        default:
          return 0;
      }
    });

    return sorted;
  }, [documents, searchQuery, fileFilter, sortBy]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === docs.length && docs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(docs.map(d => d.id)));
    }
  };

  const categories = useMemo(() => {
    const counts = {
      all: documents.length,
      pdf: documents.filter(d => d.mime_type === 'application/pdf').length,
      image: documents.filter(d => d.mime_type.startsWith('image/')).length,
      other: documents.filter(d => !d.mime_type.startsWith('image/') && d.mime_type !== 'application/pdf').length,
    };
    return [
      { id: 'all', name: 'All Files', icon: <FileText className="h-4 w-4" />, count: counts.all },
      { id: 'pdf', name: 'PDFs', icon: <FileText className="h-4 w-4 text-red-500" />, count: counts.pdf },
      { id: 'image', name: 'Images', icon: <Eye className="h-4 w-4 text-blue-500" />, count: counts.image },
      { id: 'other', name: 'Others', icon: <Info className="h-4 w-4 text-amber-500" />, count: counts.other },
    ];
  }, [documents]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Documents</h1>
            <p className="text-muted-foreground">Upload, organize, and access your files.</p>
          </div>
          <div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-3 px-6">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Categories</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <div className="space-y-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFileFilter(cat.id as any)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        fileFilter === cat.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {cat.icon}
                        <span>{cat.name}</span>
                      </div>
                      <span className={`text-xs ml-2 ${fileFilter === cat.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{cat.count}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 md:col-span-9 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  data-testid="search-documents"
                  className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[160px]">
                    <SortAsc className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                    <SelectItem value="size-asc">Size (Smallest)</SelectItem>
                    <SelectItem value="size-desc">Size (Largest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

        <Card 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`transition-colors duration-200 ${isDragging ? 'border-primary bg-primary/5' : ''}`}
        >
          <CardHeader className="pb-3 px-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Documents</CardTitle>
                <CardDescription>Manage and organize your uploaded files.</CardDescription>
              </div>
              {docs.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                  <Checkbox 
                    checked={selectedIds.size === docs.length && docs.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load documents. Please refresh.
              </div>
            ) : docs.length === 0 ? (
              <div className={`flex h-64 flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed ${isDragging ? 'border-primary' : 'border-border'}`}>
                <FileText className={`h-12 w-12 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">
                    {isDragging ? 'Drop file to upload' : 'No documents yet'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isDragging ? 'Release your mouse to start the upload' : 'Upload your first document to get started.'}
                  </p>
                </div>
                {!isDragging && (
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group flex items-center gap-3 p-4 transition-colors ${selectedIds.has(doc.id) ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                  >
                    <Checkbox 
                      checked={selectedIds.has(doc.id)}
                      onCheckedChange={() => toggleSelect(doc.id)}
                      className="transition-opacity"
                    />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailsDoc(doc)}>
                      <p className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {doc.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="uppercase font-bold text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {doc.mime_type.split('/')[1] || 'FILE'}
                        </span>
                        <span>{formatFileSize(doc.size_bytes)}</span>
                        <span>•</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setPreviewDoc(doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailsDoc(doc)}>
                            <Info className="mr-2 h-4 w-4" />
                            Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleBookmark(doc)}>
                            <Bookmark className={`mr-2 h-4 w-4 ${bookmarkedIds.has(doc.id) ? 'fill-current' : ''}`} />
                            {bookmarkedIds.has(doc.id) ? 'Remove Bookmark' : 'Bookmark'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteDocument(doc)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>

  <DocumentPreview
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />

      {/* Floating Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-foreground text-background px-6 py-3 rounded-full flex items-center gap-6 shadow-2xl border border-border/10">
            <div className="flex items-center gap-2 border-r border-background/20 pr-6">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="font-bold text-sm">{selectedIds.size} Selected</span>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 hover:bg-background/10 text-background px-3"
                onClick={handleBatchDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 hover:bg-destructive/20 hover:text-destructive text-background px-3"
                onClick={handleBatchDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-background/10 text-background ml-2"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* File Details Sidebar */}
      <Sheet open={Boolean(detailsDoc)} onOpenChange={(open) => !open && setDetailsDoc(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-8">
            <div className="p-4 bg-primary/10 w-fit rounded-xl mb-4">
              <FileText className="h-10 w-10 text-primary" />
            </div>
            <SheetTitle className="text-2xl font-bold truncate pr-6">{detailsDoc?.title}</SheetTitle>
            <SheetDescription>Document Metadata & Details</SheetDescription>
          </SheetHeader>
          
          {detailsDoc && (
            <div className="space-y-8">
              <div className="grid gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Original Filename</p>
                  <p className="text-sm font-medium break-all">{detailsDoc.original_filename}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Type</p>
                    <p className="text-sm font-medium uppercase">{detailsDoc.mime_type.split('/')[1] || 'Unknown'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Size</p>
                    <p className="text-sm font-medium">{formatFileSize(detailsDoc.size_bytes)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Uploaded At</p>
                  <p className="text-sm font-medium">{new Date(detailsDoc.created_at).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Storage Path</p>
                  <code className="text-[10px] block p-2 bg-muted rounded truncate">{detailsDoc.storage_path}</code>
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-border">
                <Button className="w-full flex justify-between px-4 h-12" onClick={() => { setPreviewDoc(detailsDoc); setDetailsDoc(null); }}>
                  <span>Preview File</span>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full flex justify-between px-4 h-12" onClick={() => downloadDocument(detailsDoc)}>
                  <span>Download File</span>
                  <Download className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className={`w-full flex justify-between px-4 h-12 ${bookmarkedIds.has(detailsDoc.id) ? 'bg-primary/5 border-primary/20' : ''}`}
                  onClick={() => toggleBookmark(detailsDoc)}
                >
                  <span>{bookmarkedIds.has(detailsDoc.id) ? 'Remove Bookmark' : 'Add to Bookmarks'}</span>
                  <Bookmark className={`h-4 w-4 ${bookmarkedIds.has(detailsDoc.id) ? 'fill-current text-primary' : ''}`} />
                </Button>
                <Button variant="destructive" className="w-full flex justify-between px-4 h-12" onClick={() => { if(confirm('Are you sure?')) deleteDocument(detailsDoc); setDetailsDoc(null); }}>
                  <span>Delete Permanently</span>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}