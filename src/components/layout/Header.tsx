import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  avatar_crop_x: number;
  avatar_crop_y: number;
  avatar_zoom: number;
};

function toAvatarPath(userId: string, objectName: string) {
  return objectName.startsWith(`${userId}/`) ? objectName : `${userId}/${objectName}`;
}

async function resolveWorkingAvatar(userId: string, currentPath: string | null) {
  const candidatePaths = new Set<string>();
  if (currentPath) candidatePaths.add(currentPath);

  const { data: objectList } = await supabase.storage
    .from('profile-avatars')
    .list(userId, { limit: 100 });

  (objectList ?? []).forEach((obj) => candidatePaths.add(toAvatarPath(userId, obj.name)));

  for (const path of candidatePaths) {
    const { data, error } = await supabase.storage
      .from('profile-avatars')
      .createSignedUrl(path, 60 * 60);
    if (!error && data?.signedUrl) {
      return { path, signedUrl: data.signedUrl };
    }
  }

  return null;
}

async function resolveAvatarBlobUrl(userId: string, currentPath: string | null) {
  const candidatePaths = new Set<string>();
  if (currentPath) candidatePaths.add(currentPath);

  const { data: objectList } = await supabase.storage
    .from('profile-avatars')
    .list(userId, { limit: 100 });

  (objectList ?? []).forEach((obj) => candidatePaths.add(toAvatarPath(userId, obj.name)));

  for (const path of candidatePaths) {
    const { data, error } = await supabase.storage.from('profile-avatars').download(path);
    if (!error && data) {
      return { path, blobUrl: URL.createObjectURL(data) };
    }
  }

  return null;
}

function avatarImageStyle(cropX: number, cropY: number, zoom: number): React.CSSProperties {
  return {
    objectFit: 'cover',
    objectPosition: `${cropX}% ${cropY}%`,
    transform: `scale(${zoom})`,
    transformOrigin: 'center',
  };
}

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id, 'header'],
    enabled: Boolean(user?.id),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const resolveLatestAvatarPath = async (userId: string): Promise<string | null> => {
        const { data: objectList, error: listError } = await supabase.storage
          .from('profile-avatars')
          .list(userId, {
            limit: 1,
            sortBy: { column: 'created_at', order: 'desc' },
          });

        if (listError || !objectList?.length) return null;
        return toAvatarPath(userId, objectList[0].name);
      };

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;

      if (!data) return null;

      const row = data as ProfileRow;
      const duplicatePrefix = `${user!.id}/${user!.id}/`;
      if (typeof row.avatar_path === 'string' && row.avatar_path.startsWith(duplicatePrefix)) {
        row.avatar_path = row.avatar_path.slice(user!.id.length + 1);
      }
      if (row.avatar_path) return row;

      const fallbackPath = await resolveLatestAvatarPath(user!.id);
      if (!fallbackPath) return row;

      const { error: patchError } = await supabase
        .from('profiles')
        .update({ avatar_path: fallbackPath, avatar_url: null })
        .eq('user_id', user!.id);
      if (patchError) throw patchError;

      return { ...row, avatar_path: fallbackPath };
    },
  });

  const avatarSignedUrlQuery = useQuery({
    queryKey: ['profile-avatar-url', user?.id, 'header', profileQuery.data?.avatar_path],
    enabled: Boolean(user?.id),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) return null;
      const resolved = await resolveWorkingAvatar(user.id, profileQuery.data?.avatar_path ?? null);
      if (!resolved) return null;

      if (resolved.path !== (profileQuery.data?.avatar_path ?? null)) {
        const { error: patchError } = await supabase
          .from('profiles')
          .update({ avatar_path: resolved.path, avatar_url: null })
          .eq('user_id', user.id);
        if (patchError) throw patchError;
      }

      return resolved.signedUrl;
    },
  });

  const avatarBlobUrlQuery = useQuery({
    queryKey: ['profile-avatar-blob-url', user?.id, profileQuery.data?.avatar_path, 'header'],
    enabled: Boolean(user?.id && profileQuery.data?.avatar_path),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const path = profileQuery.data?.avatar_path;
      if (!path) return null;

      const { data, error } = await supabase.storage.from('profile-avatars').download(path);

      if (error || !data) return null;
      return URL.createObjectURL(data);
    },
  });

  const avatarResolvedUrlQuery = useQuery({
    queryKey: ['profile-avatar-resolved-url', user?.id, profileQuery.data?.avatar_path, 'header'],
    enabled: Boolean(user?.id),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) return null;
      const resolved = await resolveAvatarBlobUrl(user.id, profileQuery.data?.avatar_path ?? null);
      if (!resolved) return null;

      if (resolved.path !== (profileQuery.data?.avatar_path ?? null)) {
        const { error: patchError } = await supabase
          .from('profiles')
          .update({ avatar_path: resolved.path, avatar_url: null })
          .eq('user_id', user.id);
        if (patchError) throw patchError;
      }

      return resolved.blobUrl;
    },
  });

  useEffect(() => {
    const currentBlobUrl = avatarBlobUrlQuery.data;
    return () => {
      if (currentBlobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [avatarBlobUrlQuery.data]);

  useEffect(() => {
    const currentBlobUrl = avatarResolvedUrlQuery.data;
    return () => {
      if (currentBlobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [avatarResolvedUrlQuery.data]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName =
    profileQuery.data?.display_name || user?.user_metadata?.display_name || 'User';
  const avatarUrl =
    avatarResolvedUrlQuery.data ||
    avatarBlobUrlQuery.data ||
    avatarSignedUrlQuery.data ||
    profileQuery.data?.avatar_url ||
    user?.user_metadata?.avatar_url;
  const avatarCropX = profileQuery.data?.avatar_crop_x ?? 50;
  const avatarCropY = profileQuery.data?.avatar_crop_y ?? 50;
  const avatarZoom = profileQuery.data?.avatar_zoom ?? 1;

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

  const getInitials = () => {
    const source = (displayName || user?.email || 'U').trim();
    return source
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="md:hidden">
        <span className="text-lg font-semibold text-foreground">Document Hub</span>
      </div>
      <div className="hidden md:block" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10 overflow-hidden">
              {avatarUrl && !avatarLoadFailed ? (
                <img
                  src={avatarUrl}
                  alt="User avatar"
                  className="h-full w-full object-cover"
                  style={avatarImageStyle(avatarCropX, avatarCropY, avatarZoom)}
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : null}
              <AvatarFallback
                className="bg-primary text-primary-foreground"
                style={{ display: avatarUrl && !avatarLoadFailed ? 'none' : 'flex' }}
              >
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
