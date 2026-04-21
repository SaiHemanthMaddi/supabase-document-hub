# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [1.0.0] - 2026-03-06

### Added

- Email/password auth (sign up, sign in, forgot/reset password)
- Route guards for authenticated and unauthenticated routes
- Profile management fields: display name, bio, phone number, address
- Avatar upload from camera/device with crop and remove actions
- Document workflows: upload, list, download, delete
- Bookmark workflows and search page
- Dashboard metrics and recent activity sections
- Settings controls for email/password and session logout options
- Supabase schema migrations for documents, bookmarks, profiles, activity logs
- Storage hardening for private `profile-avatars` bucket with policy updates
- Project tooling setup: Prettier, CI workflow, issue/PR templates, contributing guide

### Changed

- Avatar display reliability hardened with final policy migration baseline
- README expanded with setup, migrations, scripts, and troubleshooting

### Fixed

- Password recovery flow now routes to reset-password form instead of dashboard redirect
- Profile persistence/display mismatches resolved for contact fields and avatar data
- Prettier config encoding issue (BOM) fixed

## [1.1.0] - 2026-04-20

### Added

- **Dark Mode Support**: Integrated `next-themes` for seamless toggling between light, dark, and system themes.
- **Document Preview**: Secure, short-lived signed URL-based previewing for PDF, images, and text files.
- **Advanced File Management**:
  - File Details Sidebar with deep metadata and quick actions.
  - Batch Actions (multi-select) for bulk download and deletion.
  - Advanced Sorting (Name, Date, Size) and Filtering (by type).
- **Activity Log**: New dedicated page for tracking all document-related interactions and system events.
- **Document Categories**: Virtual folders that organize files automatically by type.
- **Dashboard Enhancements**: Interactive stat cards, recent file previews, and improved UX micro-animations.

### Changed

- **Architecture Refactor**: Scalable, feature-based project structure.
- **Feature Hooks**: Centralized business logic into `useDocuments`, `useBookmarks`, and `useProfile` hooks.
- **UI Uniformity**: Standardized styles, typography, and spacing across all pages using shadcn/ui components.
- **Shared Utilities**: Extracted core logic into centralized `lib/formatters.ts`, `lib/sanitizers.ts`, and `lib/constants.ts`.

### Fixed

- **Profile Page Regression**: Fixed `ReferenceError` crashes on the profile page after the refactor.
- **Password Recovery**: Hardened routing to ensure reset links direct users to the password reset form.

### Removed

- Legacy JavaScript-based E2E scripts and unused seed files.

## [Unreleased]

### Added

- Placeholder for upcoming changes
