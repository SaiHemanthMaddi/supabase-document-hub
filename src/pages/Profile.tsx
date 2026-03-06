import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Camera, Upload, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { logActivity } from '@/lib/activity';

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  bio: string | null;
  phone_number: string | null;
  address: string | null;
  avatar_crop_x: number;
  avatar_crop_y: number;
  avatar_zoom: number;
  updated_at: string | null;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Could not process captured image.'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.92);
    } catch {
      reject(new Error('Could not process captured image.'));
    }
  });
}

function avatarImageStyle(cropX: number, cropY: number, zoom: number): React.CSSProperties {
  return {
    objectFit: 'cover',
    objectPosition: `${cropX}% ${cropY}%`,
    transform: `scale(${zoom})`,
    transformOrigin: 'center',
  };
}

function validateProfileInputs(values: { displayName: string; phoneNumber: string; address: string }) {
  if (!values.displayName.trim()) {
    return 'Display name is required.';
  }

  if (values.displayName.trim().length > 80) {
    return 'Display name must be 80 characters or less.';
  }

  if (values.phoneNumber.trim()) {
    const phone = values.phoneNumber.trim();
    const validPhone = /^[+]?[\d\s()\-]{7,20}$/.test(phone);
    if (!validPhone) {
      return 'Phone number format looks invalid.';
    }
  }

  if (values.address.trim().length > 240) {
    return 'Address must be 240 characters or less.';
  }

  return null;
}

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

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
    const { data, error } = await supabase.storage
      .from('profile-avatars')
      .download(path);
    if (!error && data) {
      return { path, blobUrl: URL.createObjectURL(data) };
    }
  }

  return null;
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const systemInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');

  const [avatarCropX, setAvatarCropX] = useState(50);
  const [avatarCropY, setAvatarCropY] = useState(50);
  const [avatarZoom, setAvatarZoom] = useState(1);

  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [draftCropX, setDraftCropX] = useState(50);
  const [draftCropY, setDraftCropY] = useState(50);
  const [draftCropZoom, setDraftCropZoom] = useState(1);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
    };
  }, [stopCameraStream, pendingAvatarPreview]);

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id, 'full'],
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
      if (!data) {
        const fallbackDisplayName =
          (user?.user_metadata?.display_name as string | undefined) ?? null;
        const fallbackAvatarPath = await resolveLatestAvatarPath(user!.id);
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user!.id,
            display_name: fallbackDisplayName,
            avatar_path: fallbackAvatarPath,
          });
        if (insertError && !insertError.message.toLowerCase().includes('duplicate')) {
          throw insertError;
        }

        return {
          user_id: user!.id,
          display_name: fallbackDisplayName,
          avatar_url: null,
          avatar_path: fallbackAvatarPath,
          bio: null,
          phone_number: null,
          address: null,
          avatar_crop_x: 50,
          avatar_crop_y: 50,
          avatar_zoom: 1,
          updated_at: null,
        } as ProfileRow;
      }

      const row = data as Partial<ProfileRow> & { user_id: string };
      const duplicatePrefix = `${user!.id}/${user!.id}/`;
      if (typeof row.avatar_path === 'string' && row.avatar_path.startsWith(duplicatePrefix)) {
        row.avatar_path = row.avatar_path.slice(user!.id.length + 1);
      }
      let resolvedAvatarPath = row.avatar_path ?? null;
      if (!resolvedAvatarPath) {
        resolvedAvatarPath = await resolveLatestAvatarPath(user!.id);
        if (resolvedAvatarPath) {
          const { error: patchError } = await supabase
            .from('profiles')
            .update({ avatar_path: resolvedAvatarPath, avatar_url: null })
            .eq('user_id', user!.id);
          if (patchError) throw patchError;
        }
      }

      return {
        user_id: row.user_id ?? user!.id,
        display_name: row.display_name ?? null,
        avatar_url: row.avatar_url ?? null,
        avatar_path: resolvedAvatarPath,
        bio: row.bio ?? null,
        phone_number: row.phone_number ?? null,
        address: row.address ?? null,
        avatar_crop_x: typeof row.avatar_crop_x === 'number' ? row.avatar_crop_x : 50,
        avatar_crop_y: typeof row.avatar_crop_y === 'number' ? row.avatar_crop_y : 50,
        avatar_zoom: typeof row.avatar_zoom === 'number' ? row.avatar_zoom : 1,
        updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
      } as ProfileRow;
    },
  });

  const avatarSignedUrlQuery = useQuery({
    queryKey: ['profile-avatar-url', user?.id, 'full', profileQuery.data?.avatar_path],
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
    queryKey: ['profile-avatar-blob-url', user?.id, profileQuery.data?.avatar_path],
    enabled: Boolean(user?.id && profileQuery.data?.avatar_path),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const avatarPath = profileQuery.data?.avatar_path;
      if (!avatarPath) return null;

      const { data, error } = await supabase.storage
        .from('profile-avatars')
        .download(avatarPath);

      if (error || !data) return null;
      return URL.createObjectURL(data);
    },
  });

  const avatarResolvedUrlQuery = useQuery({
    queryKey: ['profile-avatar-resolved-url', user?.id, profileQuery.data?.avatar_path],
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

  useEffect(() => {
    if (profileQuery.isLoading) return;

    setDisplayName(profileQuery.data?.display_name ?? '');
    setBio(profileQuery.data?.bio ?? '');
    setPhoneNumber(profileQuery.data?.phone_number ?? '');
    setAddress(profileQuery.data?.address ?? '');
    setAvatarCropX(profileQuery.data?.avatar_crop_x ?? 50);
    setAvatarCropY(profileQuery.data?.avatar_crop_y ?? 50);
    setAvatarZoom(profileQuery.data?.avatar_zoom ?? 1);
  }, [profileQuery.data, profileQuery.isLoading]);

  const upsertProfile = async (
    nextAvatarPath?: string | null,
    crop?: { x: number; y: number; zoom: number }
  ) => {
    if (!user?.id) throw new Error('You must be logged in.');

    const payload = {
      user_id: user.id,
      display_name: displayName.trim() || null,
      avatar_url: null,
      avatar_path: nextAvatarPath ?? (profileQuery.data?.avatar_path || null),
      bio: bio.trim() || null,
      phone_number: phoneNumber.trim() || null,
      address: address.trim() || null,
      avatar_crop_x: crop?.x ?? avatarCropX,
      avatar_crop_y: crop?.y ?? avatarCropY,
      avatar_zoom: crop?.zoom ?? avatarZoom,
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) throw error;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validationMessage = validateProfileInputs({ displayName, phoneNumber, address });
      if (validationMessage) {
        throw new Error(validationMessage);
      }
      return upsertProfile();
    },
    onSuccess: async () => {
      if (user?.id) {
        await logActivity({
          user_id: user.id,
          event_type: 'profile_updated',
          entity_type: 'profile',
          entity_id: null,
          metadata: {
            display_name: displayName.trim(),
            phone_number: phoneNumber.trim() || null,
            address: address.trim() || null,
          },
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast({ title: 'Profile updated', description: 'Your changes were saved.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Save failed', description: error.message });
    },
  });

  const avatarUploadMutation = useMutation({
    mutationFn: async (payload: { file: File; cropX: number; cropY: number; cropZoom: number }) => {
      if (!user?.id) throw new Error('You must be logged in.');
      if (!payload.file.type.startsWith('image/')) throw new Error('Please upload an image file.');

      const path = `${user.id}/${Date.now()}-${sanitizeFileName(payload.file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(path, payload.file, {
          contentType: payload.file.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      await upsertProfile(path, { x: payload.cropX, y: payload.cropY, zoom: payload.cropZoom });
      return payload;
    },
    onSuccess: async ({ cropX, cropY, cropZoom }) => {
      setAvatarCropX(cropX);
      setAvatarCropY(cropY);
      setAvatarZoom(cropZoom);
      if (user?.id) {
        await logActivity({
          user_id: user.id,
          event_type: 'avatar_uploaded',
          entity_type: 'profile',
          entity_id: null,
          metadata: {
            crop_x: cropX,
            crop_y: cropY,
            zoom: cropZoom,
          },
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['profile-avatar-url'] }),
      ]);
      toast({ title: 'Photo updated', description: 'Profile photo uploaded successfully.' });
      handleCloseCropModal();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('You must be logged in.');

      const currentPath = profileQuery.data?.avatar_path ?? null;
      if (currentPath) {
        const { error: removeError } = await supabase.storage
          .from('profile-avatars')
          .remove([currentPath]);
        if (removeError) throw removeError;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_path: null, avatar_url: null, avatar_crop_x: 50, avatar_crop_y: 50, avatar_zoom: 1 })
        .eq('user_id', user.id);
      if (profileError) throw profileError;
    },
    onSuccess: async () => {
      setAvatarCropX(50);
      setAvatarCropY(50);
      setAvatarZoom(1);
      if (user?.id) {
        await logActivity({
          user_id: user.id,
          event_type: 'avatar_removed',
          entity_type: 'profile',
          entity_id: null,
          metadata: {},
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['profile-avatar-url'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-avatar-blob-url'] }),
      ]);
      toast({ title: 'Photo removed', description: 'Your profile photo has been removed.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Remove failed', description: error.message });
    },
  });

  const startCropFlow = (file: File) => {
    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please choose an image file.' });
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum avatar size is 5 MB.' });
      return;
    }

    if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
    const previewUrl = URL.createObjectURL(file);

    setPendingAvatarFile(file);
    setPendingAvatarPreview(previewUrl);
    setDraftCropX(avatarCropX);
    setDraftCropY(avatarCropY);
    setDraftCropZoom(avatarZoom);
    setCropModalOpen(true);
  };

  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    startCropFlow(file);
    event.target.value = '';
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        variant: 'destructive',
        title: 'Camera unavailable',
        description: 'This browser does not support direct camera access. Use Upload from Device.',
      });
      return;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraModalOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 0);
    } catch {
      setCameraError('Camera access denied or unavailable on this device/browser.');
      setCameraModalOpen(true);
    }
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 720;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    let blob: Blob;
    try {
      blob = await canvasToBlob(canvas);
    } catch {
      toast({ variant: 'destructive', title: 'Capture failed', description: 'Could not capture photo.' });
      return;
    }

    const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
    setCameraModalOpen(false);
    stopCameraStream();
    startCropFlow(file);
  };

  const closeCameraModal = () => {
    setCameraModalOpen(false);
    stopCameraStream();
  };

  const handleCloseCropModal = () => {
    setCropModalOpen(false);
    setPendingAvatarFile(null);
    if (pendingAvatarPreview) {
      URL.revokeObjectURL(pendingAvatarPreview);
      setPendingAvatarPreview(null);
    }
  };

  const handleApplyCrop = async () => {
    if (!pendingAvatarFile) return;
    await avatarUploadMutation.mutateAsync({
      file: pendingAvatarFile,
      cropX: draftCropX,
      cropY: draftCropY,
      cropZoom: draftCropZoom,
    });
  };

  const getInitials = () => {
    const name = displayName || profileQuery.data?.display_name || user?.email || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarSrc =
    avatarResolvedUrlQuery.data ||
    avatarBlobUrlQuery.data ||
    avatarSignedUrlQuery.data ||
    profileQuery.data?.avatar_url ||
    undefined;

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarSrc]);

  const profileLastUpdated = profileQuery.data?.updated_at
    ? new Date(profileQuery.data.updated_at).toLocaleString()
    : 'N/A';

  const photoUpdatedAt = (() => {
    const avatarPath = profileQuery.data?.avatar_path;
    if (!avatarPath) return 'N/A';
    const filePart = avatarPath.split('/').pop() ?? '';
    const timestampPart = filePart.split('-')[0];
    const timestamp = Number(timestampPart);
    if (!Number.isFinite(timestamp)) return 'N/A';
    return new Date(timestamp).toLocaleString();
  })();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profile</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Your Avatar</CardTitle>
              <CardDescription>Upload a photo with private signed access</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {profileQuery.isLoading ? (
                <Skeleton className="h-24 w-24 rounded-full" />
              ) : (
              <Avatar className="h-24 w-24 overflow-hidden">
                {avatarSrc && !avatarLoadFailed ? (
                  <img
                    src={avatarSrc}
                    alt="User avatar"
                    className="h-full w-full object-cover"
                    style={avatarImageStyle(avatarCropX, avatarCropY, avatarZoom)}
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : null}
                <AvatarFallback
                  className="bg-primary text-primary-foreground text-2xl"
                  style={{ display: avatarSrc && !avatarLoadFailed ? 'none' : 'flex' }}
                >
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              )}
              <input
                ref={systemInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openCamera}
                  disabled={avatarUploadMutation.isPending || removeAvatarMutation.isPending}
                >
                  {avatarUploadMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  Use Camera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => systemInputRef.current?.click()}
                  disabled={avatarUploadMutation.isPending || removeAvatarMutation.isPending}
                >
                  {avatarUploadMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload from Device
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeAvatarMutation.mutate()}
                  disabled={!profileQuery.data?.avatar_path || avatarUploadMutation.isPending || removeAvatarMutation.isPending}
                >
                  {removeAvatarMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Remove Photo
                </Button>
              </div>
              <div className="w-full space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">Saved Contact</p>
                <p className="text-xs text-muted-foreground">
                  Phone: {profileQuery.data?.phone_number || 'Not provided'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Address: {profileQuery.data?.address || 'Not provided'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Profile updated: {profileLastUpdated}
                </p>
                <p className="text-xs text-muted-foreground">
                  Photo updated: {photoUpdatedAt}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileQuery.isLoading ? (
                <div className="flex h-24 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={user?.email || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 555 123 4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street, City, State, Postal code"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={4}
                    />
                  </div>
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || avatarUploadMutation.isPending || removeAvatarMutation.isPending}
                  >
                    {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={cameraModalOpen} onOpenChange={(open) => !open && closeCameraModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Camera</DialogTitle>
            <DialogDescription>Capture a photo for your profile avatar.</DialogDescription>
          </DialogHeader>

          {cameraError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {cameraError}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border bg-black">
              <video ref={videoRef} className="h-72 w-full object-cover" autoPlay playsInline muted />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCameraModal}>Cancel</Button>
            {!cameraError && (
              <Button type="button" onClick={takePhoto}>Take Photo</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cropModalOpen} onOpenChange={(open) => !open && handleCloseCropModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Avatar</DialogTitle>
            <DialogDescription>Adjust your avatar before upload.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-center">
              <Avatar className="h-28 w-28 overflow-hidden">
                <AvatarImage
                  src={pendingAvatarPreview || ''}
                  alt="Crop preview"
                  style={avatarImageStyle(draftCropX, draftCropY, draftCropZoom)}
                />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="space-y-2">
              <Label htmlFor="crop-x">Horizontal</Label>
              <Input
                id="crop-x"
                type="range"
                min={0}
                max={100}
                step={1}
                value={draftCropX}
                onChange={(e) => setDraftCropX(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crop-y">Vertical</Label>
              <Input
                id="crop-y"
                type="range"
                min={0}
                max={100}
                step={1}
                value={draftCropY}
                onChange={(e) => setDraftCropY(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crop-zoom">Zoom</Label>
              <Input
                id="crop-zoom"
                type="range"
                min={1}
                max={2.5}
                step={0.01}
                value={draftCropZoom}
                onChange={(e) => setDraftCropZoom(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCropModal}>Cancel</Button>
            <Button onClick={handleApplyCrop} disabled={avatarUploadMutation.isPending || !pendingAvatarFile}>
              {avatarUploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply & Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
