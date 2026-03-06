# Releasing Guide

This project uses semantic version tags (`vMAJOR.MINOR.PATCH`) and GitHub Releases.

## 1. Prepare release content

1. Ensure local branch is clean and up to date:
   - `git checkout main`
   - `git pull`
2. Run quality checks:
   - `npm run format:check`
   - `npm run lint`
   - `npm run test`
   - `npm run build`
3. Update `CHANGELOG.md`:
   - Move items from `Unreleased` into a version section with date.

## 2. Create version commit + tag

Use one of:

```bash
npm run release:patch
npm run release:minor
npm run release:major
```

These commands:

- bump `package.json` version,
- create a git commit,
- create an annotated tag (`vX.Y.Z`).

## 3. Push release

```bash
git push origin main --follow-tags
```

On tag push, GitHub Actions will auto-create a GitHub Release with generated notes.

## 4. Verify

1. Open GitHub -> Releases.
2. Confirm new release version and notes.
3. Confirm CI status is green.

## Notes

- If you need a prerelease, create a tag manually (for example `v1.1.0-rc.1`).
- If a release tag is wrong, delete local/remote tags and recreate carefully:
  - `git tag -d vX.Y.Z`
  - `git push --delete origin vX.Y.Z`
