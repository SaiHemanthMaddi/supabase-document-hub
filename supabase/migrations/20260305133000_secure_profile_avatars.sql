-- Store private storage paths for avatars
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_path TEXT;

-- Convert existing public URLs to storage paths where possible
UPDATE public.profiles
SET avatar_path = regexp_replace(avatar_url, '^.*?/profile-avatars/', '')
WHERE avatar_path IS NULL
  AND avatar_url IS NOT NULL
  AND avatar_url LIKE '%/profile-avatars/%';

-- Clear legacy public URL after successful conversion
UPDATE public.profiles
SET avatar_url = NULL
WHERE avatar_path IS NOT NULL;

-- Make avatar bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'profile-avatars';

-- Recreate storage policies for private access
DROP POLICY IF EXISTS "Users can upload own profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own profile avatars" ON storage.objects;

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
