import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, HardDrive, Clock3, Loader2, Eye, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useDocuments, type DocumentRow } from '@/hooks/useDocuments';
import { useProfile } from '@/hooks/useProfile';
import { formatFileSize } from '@/lib/formatters';

type ActivityLogRow = Tables<'activity_logs'>;

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  const { profile, isLoading: isProfileLoading } = useProfile();
  const { documents, isLoading: isDocsLoading } = useDocuments();

  const activityQuery = useQuery({
    queryKey: ['activity-logs', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      return (data ?? []) as ActivityLogRow[];
    },
  });

  const docs = documents;

  const metrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const thisMonthCount = docs.filter((doc) => {
      const d = new Date(doc.created_at);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;

    const totalStorageBytes = docs.reduce((sum, doc) => sum + doc.size_bytes, 0);
    const latestUpload = docs[0]?.created_at
      ? new Date(docs[0].created_at).toLocaleDateString()
      : 'No uploads yet';

    return {
      totalDocuments: docs.length,
      thisMonthCount,
      totalStorageBytes,
      latestUpload,
    };
  }, [docs]);

  const stats = [
    {
      title: 'Total Documents',
      value: String(metrics.totalDocuments),
      icon: FileText,
      description: 'Current files',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'This Month',
      value: String(metrics.thisMonthCount),
      icon: Upload,
      description: 'New uploads',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Storage Used',
      value: formatFileSize(metrics.totalStorageBytes),
      icon: HardDrive,
      description: 'Total size',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Latest Upload',
      value: metrics.latestUpload,
      icon: Clock3,
      description: 'Last file added',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.display_name || 'User';
  const recentActivities = activityQuery.data ?? [];

  const activityLabel = (activity: ActivityLogRow) => {
    const metadata = (activity.metadata ?? {}) as Record<string, string | number | null>;
    switch (activity.event_type) {
      case 'document_uploaded':
        return `Uploaded ${metadata.original_filename ?? 'a document'}`;
      case 'document_deleted':
        return `Deleted ${metadata.original_filename ?? 'a document'}`;
      case 'document_downloaded':
        return `Downloaded ${metadata.original_filename ?? 'a document'}`;
      case 'bookmark_added':
        return `Bookmarked ${metadata.title ?? 'a document'}`;
      case 'bookmark_removed':
        return `Removed bookmark from ${metadata.title ?? 'a document'}`;
      case 'profile_updated':
        return 'Updated profile details';
      case 'avatar_uploaded':
        return 'Updated profile photo';
      case 'avatar_removed':
        return 'Removed profile photo';
      case 'password_updated':
        return 'Changed account password';
      case 'all_sessions_logged_out':
        return 'Logged out all active sessions';
      default:
        return activity.event_type.replace(/_/g, ' ');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground lg:text-5xl">
            Welcome back{displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">Manage your documents with ease and security.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="overflow-hidden transition-all hover:shadow-md group border-muted/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-full ${stat.bgColor} ${stat.color} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  {isDocsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="text-2xl font-bold truncate">{stat.value}</div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-muted/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Documents</CardTitle>
                <CardDescription>Your recently uploaded items</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="text-primary font-medium">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {isDocsLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : docs.length === 0 ? (
                <div className="flex flex-col h-48 items-center justify-center text-muted-foreground gap-4">
                  <div className="p-4 bg-muted/40 rounded-full">
                    <FileText className="h-8 w-8 opacity-40" />
                  </div>
                  <p>No documents yet. Start by uploading your first one.</p>
                  <Button size="sm" onClick={() => navigate('/documents')}>Upload Now</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {docs.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="group flex items-center justify-between rounded-lg border border-muted/50 p-3 hover:border-primary/50 transition-colors">
                      <div className="min-w-0 mr-4">
                        <p className="font-medium text-foreground truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {doc.original_filename} • {formatFileSize(doc.size_bytes)}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setPreviewDoc(doc)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-muted/60">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest changes across your account</CardDescription>
            </CardHeader>
            <CardContent>
              {activityQuery.isLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="flex flex-col h-48 items-center justify-center text-muted-foreground gap-4">
                   <div className="p-4 bg-muted/40 rounded-full">
                    <Clock3 className="h-8 w-8 opacity-40" />
                  </div>
                  <p>Your activity list is currently empty.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">{activityLabel(activity)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DocumentPreview 
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />
    </AppLayout>
  );
}
