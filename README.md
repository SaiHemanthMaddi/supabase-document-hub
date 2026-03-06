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

## Screenshots and Demo

Add your images/GIFs to `docs/assets/` using the names below.

### App Screenshots

| Screen    | Preview                                               |
| --------- | ----------------------------------------------------- |
| Auth      | ![Auth Screen](docs/assets/auth-screen.png)           |
| Dashboard | ![Dashboard Screen](docs/assets/dashboard-screen.png) |
| Documents | ![Documents Screen](docs/assets/documents-screen.png) |
| Profile   | ![Profile Screen](docs/assets/profile-screen.png)     |
| Settings  | ![Settings Screen](docs/assets/settings-screen.png)   |

### Demo GIFs

| Flow                         | Preview                                           |
| ---------------------------- | ------------------------------------------------- |
| Upload + Bookmark + Download | ![Documents Flow](docs/assets/documents-flow.gif) |
| Profile Avatar Update        | ![Profile Flow](docs/assets/profile-flow.gif)     |

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
npm run test:e2e     # Run Playwright E2E smoke tests
npm run test:e2e:headed # Run E2E in headed mode
npm run test:e2e:report # Open Playwright HTML report
npm run lint         # Lint
npm run format       # Prettier write
npm run format:check # Prettier check
npm run seed:help    # Print seed data setup instructions
npm run release:patch # Bump patch version + create git tag
npm run release:minor # Bump minor version + create git tag
npm run release:major # Bump major version + create git tag
```

## Seed Data (Optional)

- Seed SQL path: `supabase/seeds/20260306110000_seed_demo_data.sql`
- Run `npm run seed:help` for quick instructions.
- Execute the SQL in Supabase SQL Editor after applying migrations.

## Release Process

- Changelog: `CHANGELOG.md`
- Release guide: `docs/RELEASING.md`
- GitHub release workflow: `.github/workflows/release.yml` (runs on pushed `v*` tags)

## Documentation

- Architecture: `docs/ARCHITECTURE.md`
- Releasing: `docs/RELEASING.md`
- Contribution guide: `CONTRIBUTING.md`

## E2E Baseline

- Playwright config: `playwright.config.ts`
- Smoke suite: `e2e/auth-smoke.spec.ts`
- Install browser binaries once:

```bash
npx playwright install chromium
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
