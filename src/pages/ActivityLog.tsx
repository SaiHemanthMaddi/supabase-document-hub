import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useActivity } from '@/hooks/useActivity';
import { formatDate } from '@/lib/formatters';
import { 
  FileUp, 
  Trash2, 
  Download, 
  Settings, 
  User, 
  Bookmark, 
  Eye, 
  Shield, 
  Loader2,
  AlertCircle
} from 'lucide-react';

const getEventIcon = (type: string) => {
  switch (type) {
    case 'document_uploaded': return <FileUp className="h-4 w-4 text-blue-500" />;
    case 'document_deleted': return <Trash2 className="h-4 w-4 text-red-500" />;
    case 'document_downloaded': return <Download className="h-4 w-4 text-green-500" />;
    case 'bookmark_added': return <Bookmark className="h-4 w-4 text-amber-500 fill-amber-500" />;
    case 'bookmark_removed': return <Bookmark className="h-4 w-4 text-muted-foreground" />;
    case 'profile_updated': return <User className="h-4 w-4 text-purple-500" />;
    case 'avatar_uploaded': return <Eye className="h-4 w-4 text-indigo-500" />;
    case 'email_change_requested':
    case 'password_updated':
    case 'all_sessions_logged_out':
    case 'current_session_logged_out':
      return <Shield className="h-4 w-4 text-orange-500" />;
    default: return <Settings className="h-4 w-4 text-muted-foreground" />;
  }
};

const formatEventName = (type: string) => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function ActivityLog() {
  const { activities, isLoading, isError } = useActivity();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Activity Log</h1>
          <p className="text-muted-foreground">A detailed audit trail of your account activities.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>View your most recent actions and security events.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-destructive">
                <AlertCircle className="h-8 w-8" />
                <p>Failed to load activity logs.</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Settings className="h-8 w-8 opacity-20" />
                <p>No activity recorded yet.</p>
              </div>
            ) : (
              <div className="relative overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Event</th>
                      <th className="px-6 py-3 font-semibold">Target</th>
                      <th className="px-6 py-3 font-semibold">Details</th>
                      <th className="px-6 py-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activities.map((log) => (
                      <tr key={log.id} className="bg-card hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background border border-border">
                              {getEventIcon(log.event_type)}
                            </div>
                            <span className="font-medium text-foreground">
                              {formatEventName(log.event_type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="capitalize text-muted-foreground">
                            {log.entity_type || 'System'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs truncate text-xs text-muted-foreground">
                            {log.metadata && typeof log.metadata === 'object' 
                              ? Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')
                              : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {formatDate(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
