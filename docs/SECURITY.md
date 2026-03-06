# Security Guide

This document defines the current security model and operational controls for Document Hub.

## 1. Security Objectives

- Ensure each user can only access their own documents, bookmarks, profile updates, and storage objects.
- Prevent public exposure of private user files (documents and avatars).
- Keep secrets out of source control and CI logs.
- Maintain reproducible, migration-driven policy hardening.

## 2. Trust Boundaries

1. Browser client (untrusted runtime).
2. Supabase Auth (identity and sessions).
3. Supabase Postgres with RLS (authorization for table data).
4. Supabase Storage with policies (authorization for file objects).

## 3. Authentication Controls

- Email/password auth handled by Supabase Auth.
- Password reset flow uses recovery mode in `/auth?mode=reset`.
- Route guards block:
  - unauthenticated access to protected routes,
  - authenticated access to public-only auth route.

## 4. Authorization Controls (Postgres + RLS)

RLS is enabled on user-owned tables:

- `public.profiles`
- `public.user_roles`
- `public.documents`
- `public.bookmarks`
- `public.activity_logs`

Policy pattern:

- `auth.uid() = user_id` for user-owned data access.
- Insert/update/delete constrained to the authenticated owner.

## 5. Storage Security Controls

Buckets:

- `documents` -> private
- `profile-avatars` -> private

Storage object policy pattern:

- bucket-scoped access plus folder ownership check:
  - `auth.uid()::text = (storage.foldername(name))[1]`

Additional constraints:

- file size and MIME type limits configured in migrations.
- `profile-avatars` hardened by idempotent migration:
  - `supabase/migrations/20260306100000_harden_profile_avatar_policies.sql`

## 6. Sensitive Data and Secrets

Never commit:

- `.env`
- `.env.local`
- service-role keys
- database passwords

Committed safely:

- `.env.example` with placeholders only
- `VITE_SUPABASE_PUBLISHABLE_KEY` is safe for client usage (publishable key)

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## 7. Security Baseline Checklist

Before release:

1. Apply all migrations in order.
2. Verify both storage buckets are private.
3. Verify RLS policies exist for all user-owned tables.
4. Validate avatar upload + display using signed/private access.
5. Validate document upload/download/delete permissions by user boundary.
6. Run:
   - `npm run format:check`
   - `npm run test`
   - `npm run test:e2e`
   - `npm run build`

## 8. Incident Response (Practical)

If unauthorized access is suspected:

1. Rotate compromised credentials immediately.
2. Re-run hardening migration:
   - `20260306100000_harden_profile_avatar_policies.sql`
3. Review Supabase Auth logs and database/storage access logs.
4. Invalidate active sessions if needed (from app settings or Supabase admin tools).
5. Create a post-incident note in release/docs before next deploy.

## 9. Known Security Limitations

- CI lint step is currently non-blocking due existing legacy lint errors.
- Seed SQL creates demo metadata rows; run only in non-production environments unless intended.

## 10. Recommended Next Hardening Steps

1. Enforce stricter CSP headers for production hosting.
2. Add automated policy validation checks in CI (schema smoke checks).
3. Add dependency vulnerability scanning in CI (`npm audit` gate policy).
4. Add centralized error/incident monitoring (Phase 3 Step 4).
