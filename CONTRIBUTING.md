# Contributing Guide

Thanks for contributing to Document Hub.

## 1. Prerequisites

- Node.js 18+
- npm 9+
- Supabase project (for full feature testing)

## 2. Setup

```bash
npm install
```

Create environment variables from `.env.example`:

```bash
cp .env.example .env.local
```

Then set valid Supabase credentials in `.env.local`.

## 3. Local Development

```bash
npm run dev
```

## 4. Quality Checks (Required Before PR)

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

## 5. Database and Supabase Changes

- Add all schema/policy/storage changes as SQL migrations in `supabase/migrations`.
- Use timestamp-based file names, e.g. `YYYYMMDDHHMMSS_description.sql`.
- If manual execution is required, document it in the PR.

## 6. Commit and Pull Request Rules

- Keep commits focused and small.
- Use clear commit messages (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).
- Open PRs against `main`.
- Fill out the PR template completely.
- Include screenshots for UI changes.

## 7. Testing Expectations

- Add/update unit tests when behavior changes.
- Verify critical flows manually:
  - Auth (sign in/sign up/forgot-reset)
  - Documents (upload/download/delete)
  - Profile (save fields/avatar)
  - Dashboard reflects user data
