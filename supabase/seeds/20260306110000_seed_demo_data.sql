-- Demo seed scaffold for Document Hub
-- Safe to run multiple times.
-- If no auth users exist, this script exits without changes.

DO $$
DECLARE
  target_user_id UUID;
  doc_a_id UUID;
  doc_b_id UUID;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'Seed skipped: no users found in auth.users. Create a user first, then rerun this script.';
    RETURN;
  END IF;

  -- Profile upsert for the selected user
  INSERT INTO public.profiles (
    user_id,
    display_name,
    bio,
    phone_number,
    address
  )
  VALUES (
    target_user_id,
    'Demo User',
    'Document Hub demo profile seeded from SQL.',
    '+1 555 010 2000',
    '100 Demo Street, Example City'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    bio = EXCLUDED.bio,
    phone_number = EXCLUDED.phone_number,
    address = EXCLUDED.address,
    updated_at = now();

  -- Demo document metadata rows (storage_path placeholders)
  INSERT INTO public.documents (
    user_id,
    title,
    original_filename,
    mime_type,
    size_bytes,
    storage_path
  )
  VALUES (
    target_user_id,
    'Welcome Guide',
    'welcome-guide.pdf',
    'application/pdf',
    102400,
    target_user_id::text || '/seed/welcome-guide.pdf'
  )
  ON CONFLICT (storage_path) DO UPDATE
  SET
    title = EXCLUDED.title,
    original_filename = EXCLUDED.original_filename,
    mime_type = EXCLUDED.mime_type,
    size_bytes = EXCLUDED.size_bytes,
    updated_at = now()
  RETURNING id INTO doc_a_id;

  INSERT INTO public.documents (
    user_id,
    title,
    original_filename,
    mime_type,
    size_bytes,
    storage_path
  )
  VALUES (
    target_user_id,
    'Project Plan',
    'project-plan.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    204800,
    target_user_id::text || '/seed/project-plan.docx'
  )
  ON CONFLICT (storage_path) DO UPDATE
  SET
    title = EXCLUDED.title,
    original_filename = EXCLUDED.original_filename,
    mime_type = EXCLUDED.mime_type,
    size_bytes = EXCLUDED.size_bytes,
    updated_at = now()
  RETURNING id INTO doc_b_id;

  -- Bookmark one seeded document
  IF doc_a_id IS NOT NULL THEN
    INSERT INTO public.bookmarks (user_id, document_id)
    VALUES (target_user_id, doc_a_id)
    ON CONFLICT (user_id, document_id) DO NOTHING;
  END IF;

  -- Activity samples
  INSERT INTO public.activity_logs (user_id, event_type, entity_type, entity_id, metadata)
  VALUES
    (target_user_id, 'profile_updated', 'profile', NULL, jsonb_build_object('source', 'seed')),
    (target_user_id, 'document_uploaded', 'document', doc_a_id, jsonb_build_object('title', 'Welcome Guide')),
    (target_user_id, 'document_uploaded', 'document', doc_b_id, jsonb_build_object('title', 'Project Plan'))
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed completed for user: %', target_user_id;
END $$;
