# Release Notes

## Project

Document Hub (React + Vite + TypeScript + Supabase)

## Summary

This release stabilizes core authentication, profile management, document workflows, settings/security controls, and Supabase storage/RLS policies.  
Primary focus was reliability, production hardening, and migration-backed reproducibility.

## Implemented Features

- Authentication
  - Sign up / sign in flow
  - Forgot password + reset password flow
  - Route guard handling for recovery links
- Profile
  - Save/load display name, bio, phone, address
  - Avatar upload from device/camera
  - Avatar crop controls
  - Avatar remove action
  - Avatar policy hardening and fallback resolution
- Documents
  - Upload, list, download, delete
  - Bookmark/unbookmark support
  - File type and size validation
- Search and Bookmarks
  - Search-based document discovery
  - Bookmark management with download support
- Dashboard
  - Document metrics from live data
  - Recent activity from activity logs
- Settings
  - Change email
  - Change password
  - Sign out current session
  - Sign out all sessions

## Security and Data Hardening

- Added/updated RLS-backed schema for:
  - `documents`
  - `bookmarks`
  - `profiles`
  - `activity_logs`
- Hardened storage policies and constraints:
  - `documents` bucket constraints
  - `profile-avatars` bucket private access + per-user folder policies
- Added final idempotent migration to enforce working avatar policy baseline.

## Supabase Migrations Included

- `20260203182922_169167bc-2f58-4e89-84f4-8cd0d7241b4d.sql`
- `20260305102000_create_documents.sql`
- `20260305113000_create_bookmarks.sql`
- `20260305123000_create_profile_avatars_bucket.sql`
- `20260305133000_secure_profile_avatars.sql`
- `20260305143000_add_profile_contact_fields.sql`
- `20260305150000_add_avatar_crop_fields.sql`
- `20260305170000_add_activity_logs_and_upload_limits.sql`
- `20260306100000_harden_profile_avatar_policies.sql`

## Test and Build Status

- Unit tests: passing (`vitest`)
- Production build: passing (`vite build`)

## Deployment / Handoff Checklist

1. Configure env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
2. Apply all Supabase migrations in order.
3. Verify auth reset-password email redirect behavior.
4. Verify avatar upload/display and policy access.
5. Verify document upload/download/delete and dashboard activity updates.

## Known Notes

- Route-level lazy loading is enabled to reduce initial bundle size.
- Avatar reliability depends on correct Supabase storage policies; final hardening migration covers this baseline.
