-- Final hardening migration for profile avatar storage access.
-- Safe to run multiple times.

-- 1) Ensure the bucket exists and remains private.
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false;

-- 2) Keep strict constraints for avatar uploads.
UPDATE storage.buckets
SET
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
WHERE id = 'profile-avatars';

-- 3) Recreate deterministic RLS policies for storage.objects.
DROP POLICY IF EXISTS "Users can read own profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile avatars" ON storage.objects;

CREATE POLICY "Users can read own profile avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'profile-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own profile avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own profile avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own profile avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
