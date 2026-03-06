# Document Hub

A full-stack document management web app built with React + Vite + TypeScript and Supabase.

## Repository

- GitHub: https://github.com/SaiHemanthMaddi/supabase-document-hub

## Key Features

- Email/password auth (sign up, sign in, forgot/reset password)
- Protected routing and public-only auth routing
- Profile management:
  - Display name, bio, phone, address
  - Avatar upload (camera + device), crop controls, remove photo
- Document management:
  - Upload, list, download, delete
  - File type/size validations
- Bookmarks for documents
- Search page for document discovery
- Dashboard metrics and recent activity
- Settings:
  - Change email
  - Change password
  - Sign out current session / all sessions
- Supabase RLS and storage policy hardening

## Tech Stack

- Frontend: React 18, TypeScript, Vite
- UI: Tailwind CSS, shadcn/ui, Radix UI
- Data/Auth/Storage: Supabase
- State/Data fetching: TanStack Query
- Testing: Vitest + Testing Library

## Project Structure

```text
src/
  components/
  hooks/
  integrations/supabase/
  lib/
  pages/
  test/
supabase/
  migrations/
```

## Prerequisites

- Node.js 18+
- npm 9+
- Supabase project

## Environment Variables

Create `.env.local` (or `.env`) with:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>
# optional:
VITE_ENABLE_DEMO_AUTH=false
```

## Install & Run

```bash
npm install
npm run dev
```

App default local URL:

```text
http://localhost:8082
```

## Apply Supabase Migrations

Apply all SQL files from `supabase/migrations` in order (via SQL Editor or CLI).

### Recommended (Supabase CLI)

```bash
supabase db push
```

### Important latest hardening migration

```text
supabase/migrations/20260306100000_harden_profile_avatar_policies.sql
```

This keeps avatar bucket/policies in the known working state.

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run tests
npm run test:watch   # Watch tests
npm run lint         # Lint
npm run format       # Prettier write
npm run format:check # Prettier check
```

## Troubleshooting

### Avatar upload works but image does not display

Usually caused by storage bucket RLS policy mismatch.

Ensure:

- `profile-avatars` bucket exists
- bucket is private (`public = false`)
- read/insert/update/delete policies exist on `storage.objects` for user folder ownership
- latest hardening migration is applied

### Reset password link opens dashboard instead of reset form

Ensure latest app code is running (route guards include recovery handling), then test with a newly generated reset email link.

## GitHub Push (First Time)

Current remote used for this project:

```text
https://github.com/SaiHemanthMaddi/supabase-document-hub.git
```

If this folder is not yet a git repository:

```bash
git init
git add .
git commit -m "Initial commit: Document Hub"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If remote already exists:

```bash
git add .
git commit -m "Update: feature and policy hardening"
git push
```

## Suggested GitHub Repository Titles

1. `document-hub`
2. `document-hub-supabase`
3. `secure-document-hub`
4. `docflow-hub`
5. `document-hub-dashboard`

Recommended: **`document-hub-supabase`** (clear and searchable).
