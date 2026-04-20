import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Loader2, Camera, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { logActivity } from '@/lib/activity';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProfile, type ProfileRow } from '@/hooks/useProfile';
import { 
  canvasToBlob, 
  avatarImageStyle, 
  validateProfileInputs 
} from '@/lib/profile-utils';
import { sanitizeFileName } from '@/lib/sanitizers';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

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

  const {
    profile,
    avatarUrl: avatarSignedUrl,
    isLoading,
    isUpdating,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    isAvatarUploading,
    isAvatarRemoving,
  } = useProfile();

  useEffect(() => {
    if (isLoading || !profile) return;

    setDisplayName(profile.display_name ?? '');
    setBio(profile.bio ?? '');
    setPhoneNumber(profile.phone_number ?? '');
    setAddress(profile.address ?? '');
    setAvatarCropX(profile.avatar_crop_x ?? 50);
    setAvatarCropY(profile.avatar_crop_y ?? 50);
    setAvatarZoom(profile.avatar_zoom ?? 1);
  }, [profile, isLoading]);

  const handleSave = async () => {
    const validationMessage = validateProfileInputs({ displayName, phoneNumber, address });
    if (validationMessage) {
      toast({ variant: 'destructive', title: 'Validation Error', description: validationMessage });
      return;
    }

    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        phone_number: phoneNumber.trim() || null,
        address: address.trim() || null,
      });
      
      if (user?.id) {
        await logActivity({
          user_id: user.id,
          event_type: 'profile_updated',
          entity_type: 'profile',
          entity_id: null,
          metadata: {
            display_name: displayName.trim(),
          },
        });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: error.message });
    }
  };

  const startCropFlow = (file: File) => {
    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: 'Please choose an image file.',
      });
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum avatar size is 5 MB.',
      });
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
      toast({
        variant: 'destructive',
        title: 'Capture failed',
        description: 'Could not capture photo.',
      });
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
    await uploadAvatar(pendingAvatarFile);
    handleCloseCropModal();
  };

  const getInitials = () => {
    const name = displayName || profile?.display_name || user?.email || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarSrc = avatarSignedUrl;

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarSrc]);

  const profileLastUpdated = profile?.updated_at
    ? new Date(profile.updated_at).toLocaleString()
    : 'N/A';

  const photoUpdatedAt = (() => {
    const avatarPath = profile?.avatar_path;
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

        <div className="grid gap-8 md:grid-cols-3">
          <Card className="md:col-span-1 border-muted/60 shadow-sm">
            <CardHeader>
              <CardTitle>Your Avatar</CardTitle>
              <CardDescription>Upload a photo with private signed access</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {isLoading ? (
                <Skeleton className="h-24 w-24 rounded-full" />
              ) : (
                <Avatar className="h-24 w-24 overflow-hidden">
                  {avatarSignedUrl && !avatarLoadFailed ? (
                    <img
                      src={avatarSignedUrl}
                      alt="User avatar"
                      className="h-full w-full object-cover"
                      style={avatarImageStyle(avatarCropX, avatarCropY, avatarZoom)}
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : null}
                  <AvatarFallback
                    className="bg-primary text-primary-foreground text-2xl"
                    style={{ display: avatarSignedUrl && !avatarLoadFailed ? 'none' : 'flex' }}
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
                  disabled={isUpdating}
                >
                  {isUpdating ? (
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
                  disabled={isUpdating}
                >
                  {isAvatarUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload from Device
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeAvatar()}
                  disabled={!profile?.avatar_path || isUpdating}
                >
                  {isAvatarRemoving ? (
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
                  Phone: {profile?.phone_number || 'Not provided'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Address: {profile?.address || 'Not provided'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Profile updated: {profileLastUpdated}
                </p>
                <p className="text-xs text-muted-foreground">Photo updated: {photoUpdatedAt}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border-muted/60 shadow-sm">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
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
                    className="w-full sm:w-auto shadow-sm"
                    onClick={handleSave}
                    disabled={isUpdating}
                  >
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              <video
                ref={videoRef}
                className="h-72 w-full object-cover"
                autoPlay
                playsInline
                muted
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCameraModal}>
              Cancel
            </Button>
            {!cameraError && (
              <Button type="button" onClick={takePhoto}>
                Take Photo
              </Button>
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
            <Button variant="outline" onClick={handleCloseCropModal}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyCrop}
              disabled={isAvatarUploading || !pendingAvatarFile}
            >
              {isAvatarUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply & Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
