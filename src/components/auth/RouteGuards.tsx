import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const isPasswordRecoveryLink = hashParams.get('type') === 'recovery';
  if (isPasswordRecoveryLink) {
    return <Navigate to={`/auth?mode=reset${location.hash}`} replace />;
  }

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/auth" replace />;

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const isPasswordRecoveryRoute =
    searchParams.get('mode') === 'reset' || hashParams.get('type') === 'recovery';

  if (loading) return <FullPageSpinner />;
  if (user && !isPasswordRecoveryRoute) return <Navigate to="/" replace />;

  return <Outlet />;
}
