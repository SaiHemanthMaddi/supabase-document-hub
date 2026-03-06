INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO NOTHING;

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
