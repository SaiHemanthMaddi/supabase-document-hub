import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, HardDrive, Clock3, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

type DocumentRow = Tables<'documents'>;
type ActivityLogRow = Tables<'activity_logs'>;
type ProfileRow = {
  user_id: string;
  display_name: string | null;
};

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function Index() {
  const { user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id, 'dashboard'],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProfileRow | null;
    },
  });

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

  const docs = documentsQuery.data ?? [];

  const metrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const thisMonthCount = docs.filter((doc) => {
      const d = new Date(doc.created_at);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;

    const totalStorageBytes = docs.reduce((sum, doc) => sum + doc.size_bytes, 0);
    const latestUpload = docs[0]?.created_at ? new Date(docs[0].created_at).toLocaleString() : 'No uploads yet';

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
    },
    {
      title: 'This Month',
      value: String(metrics.thisMonthCount),
      icon: Upload,
      description: 'New uploads',
    },
    {
      title: 'Storage Used',
      value: formatFileSize(metrics.totalStorageBytes),
      icon: HardDrive,
      description: 'Across all documents',
    },
    {
      title: 'Latest Upload',
      value: metrics.latestUpload,
      icon: Clock3,
      description: 'Most recent upload time',
    },
  ];

  const displayName = profileQuery.data?.display_name || user?.user_metadata?.display_name;
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back{displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="text-muted-foreground">Here's an overview of your document hub activity.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {documentsQuery.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="text-2xl font-bold truncate">{stat.value}</div>
                  )}
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Your recently uploaded documents</CardDescription>
            </CardHeader>
            <CardContent>
              {documentsQuery.isLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : docs.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <p>No documents yet. Start by uploading your first document.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {docs.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="rounded-md border border-border p-3">
                      <p className="font-medium text-foreground truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.original_filename} • {formatFileSize(doc.size_bytes)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest upload activity on your content</CardDescription>
            </CardHeader>
            <CardContent>
              {activityQuery.isLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <p>No activity yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="rounded-md border border-border p-3">
                      <p className="text-sm text-foreground">{activityLabel(activity)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(activity.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

