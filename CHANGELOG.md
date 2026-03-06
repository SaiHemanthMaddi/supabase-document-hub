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

## [Unreleased]

### Added

- Placeholder for upcoming changes
