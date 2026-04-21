import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
import { LogOut, User, Settings as SettingsIcon, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { useProfile } from '@/hooks/useProfile';

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
  const { profile, avatarUrl } = useProfile();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.display_name ||
    'User';
  const avatarCropX = profile?.avatar_crop_x ?? 50;
  const avatarCropY = profile?.avatar_crop_y ?? 50;
  const avatarZoom = profile?.avatar_zoom ?? 1;

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
      <div className="flex items-center gap-4">
        <ThemeToggle />
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
            <DropdownMenuItem onClick={() => navigate('/activity')}>
              <History className="mr-2 h-4 w-4" />
              Activity Log
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
