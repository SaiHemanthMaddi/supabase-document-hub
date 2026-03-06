import { supabase } from "@/integrations/supabase/client";

const AVATAR_BUCKET = "profile-avatars";

export async function resolveLatestAvatarPath(userId: string): Promise<string | null> {
  const { data: objectList, error: listError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(userId, {
      limit: 1,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (listError || !objectList?.length) return null;
  return `${userId}/${objectList[0].name}`;
}

export async function patchProfileAvatarPath(userId: string, avatarPath: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: avatarPath, avatar_url: null })
    .eq("user_id", userId);

  if (error) throw error;
}

export async function ensureProfileAvatarPath(
  userId: string,
  currentPath: string | null | undefined
): Promise<string | null> {
  if (currentPath) return currentPath;
  const latestPath = await resolveLatestAvatarPath(userId);
  if (!latestPath) return null;
  await patchProfileAvatarPath(userId, latestPath);
  return latestPath;
}

export async function createAvatarSignedUrlWithFallback(
  userId: string,
  avatarPath: string | null | undefined,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  if (!avatarPath) return null;

  const first = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, expiresInSeconds);

  if (!first.error && first.data?.signedUrl) return first.data.signedUrl;

  const latestPath = await resolveLatestAvatarPath(userId);
  if (!latestPath) throw (first.error ?? new Error("Could not resolve avatar URL."));

  const second = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(latestPath, expiresInSeconds);

  if (second.error || !second.data?.signedUrl) {
    throw (second.error ?? new Error("Could not resolve avatar URL."));
  }

  if (latestPath !== avatarPath) {
    await patchProfileAvatarPath(userId, latestPath);
  }

  return second.data.signedUrl;
}

export async function createAvatarBlobUrl(avatarPath: string | null | undefined): Promise<string | null> {
  if (!avatarPath) return null;

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .download(avatarPath);

  if (error || !data) return null;
  return URL.createObjectURL(data);
}
