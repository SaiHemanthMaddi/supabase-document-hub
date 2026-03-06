# Seed Data

This folder contains optional SQL seeds for quick local/demo setup.

## File

- `20260306110000_seed_demo_data.sql`

## What it does

- Selects the first user from `auth.users`
- Upserts a basic profile row
- Inserts two demo document metadata rows
- Adds one bookmark
- Inserts sample activity log rows

## Important notes

- The script is idempotent and safe to rerun.
- If no users exist in `auth.users`, it exits without changes.
- Seeded documents are metadata placeholders; upload real files in `/documents` for download testing.

## How to run

Run the SQL file in Supabase SQL Editor (or via CLI query execution), after migrations are applied.
