-- Activity log for user actions
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created_at
  ON public.activity_logs (user_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs"
ON public.activity_logs FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert their own activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enforce server-side file constraints at storage bucket level
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 20971520, -- 20 MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
WHERE id = 'documents';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
WHERE id = 'profile-avatars';
