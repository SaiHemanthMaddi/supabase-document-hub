import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { logActivity } from '@/lib/activity';

export type ProfileRow = {
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

export function useProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id, 'full'],
    enabled: Boolean(user?.id),
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
          (user?.user_metadata?.full_name as string | undefined) || 
          (user?.user_metadata?.display_name as string | undefined) || 
          null;
        const fallbackAvatarPath = await resolveLatestAvatarPath(user!.id);
        
        const { error: insertError } = await supabase.from('profiles').insert({
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
      let resolvedAvatarPath = row.avatar_path ?? null;

      if (!resolvedAvatarPath) {
        resolvedAvatarPath = await resolveLatestAvatarPath(user!.id);
        if (resolvedAvatarPath) {
          await supabase.from('profiles').update({ avatar_path: resolvedAvatarPath }).eq('user_id', user!.id);
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

  const avatarUrlQuery = useQuery({
    queryKey: ['profile-avatar-url', user?.id, profileQuery.data?.avatar_path],
    enabled: Boolean(user?.id && profileQuery.data?.avatar_path),
    queryFn: async () => {
      const resolved = await resolveWorkingAvatar(user!.id, profileQuery.data?.avatar_path ?? null);
      return resolved?.signedUrl ?? null;
    },
  });

  const avatarUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('Not authenticated');

      const storagePath = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(storagePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      await logActivity({
        user_id: user.id,
        event_type: 'avatar_uploaded',
        entity_type: 'user',
        entity_id: user.id,
        metadata: { filename: file.name },
      });

      return storagePath;
    },
    onSuccess: (storagePath) => {
      updateProfile({ avatar_path: storagePath, avatar_url: null });
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile?.avatar_path) return;

      const { error: deleteError } = await supabase.storage
        .from('profile-avatars')
        .remove([profile.avatar_path]);

      if (deleteError) throw deleteError;

      await logActivity({
        user_id: user.id,
        event_type: 'avatar_removed',
        entity_type: 'user',
        entity_id: user.id,
      });

      await updateProfile({ avatar_path: null, avatar_url: null });
    },
    onSuccess: () => {
      toast({ title: 'Avatar Removed', description: 'Your profile photo has been removed.' });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<ProfileRow>) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' });

      if (error) throw error;

      await logActivity({
        user_id: user.id,
        event_type: 'profile_updated',
        entity_type: 'user',
        entity_id: user.id,
        metadata: { updated_fields: Object.keys(updates) },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast({ title: 'Profile Updated', description: 'Your changes have been saved.' });
    },
  });

  return {
    profile: profileQuery.data,
    avatarUrl: avatarUrlQuery.data,
    isLoading: profileQuery.isLoading || avatarUrlQuery.isLoading,
    isUpdating: updateProfileMutation.isPending || avatarUploadMutation.isPending || removeAvatarMutation.isPending,
    updateProfile: updateProfileMutation.mutateAsync,
    uploadAvatar: avatarUploadMutation.mutateAsync,
    removeAvatar: removeAvatarMutation.mutateAsync,
    isAvatarUploading: avatarUploadMutation.isPending,
    isAvatarRemoving: removeAvatarMutation.isPending,
  };
}
