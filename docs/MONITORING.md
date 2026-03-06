# Monitoring and Error Tracking

This project includes a lightweight monitoring baseline that is safe by default.

## 1. What is implemented

- Global browser error capture:
  - `window.onerror`
  - `window.onunhandledrejection`
- React crash capture with an app-level error boundary
- Optional event forwarding to an external ingest endpoint

Code locations:

- `src/lib/monitoring.ts`
- `src/components/monitoring/AppErrorBoundary.tsx`
- `src/main.tsx`

## 2. Default behavior

- Monitoring forwarding is disabled unless explicitly enabled.
- In development, captured errors are logged to console.
- In production, app crashes show a fallback screen with a reload action.

## 3. Environment variables

Set these in `.env.local` (or environment config):

```env
VITE_MONITORING_ENABLED=true
VITE_MONITORING_INGEST_URL=https://your-monitoring-endpoint.example.com/events
VITE_MONITORING_APP_NAME=document-hub
```

If `VITE_MONITORING_ENABLED` is not `true` or ingest URL is empty, events are not sent.

## 4. Event payload shape

Outgoing events include:

- `app`
- `level`
- `message`
- `timestamp`
- `url`
- `userAgent`
- optional `context`

## 5. Supabase operational monitoring checklist

Use Supabase Dashboard regularly for:

1. Auth activity and sign-in anomalies
2. Database query errors and slow query patterns
3. Storage errors (policy denials, failed uploads/downloads)
4. API error spikes over time

## 6. Incident playbook (quick)

1. Confirm issue scope from client logs + monitoring endpoint.
2. Check Supabase auth/database/storage logs for correlated errors.
3. Validate latest migrations/policies in production.
4. Roll forward a patch (preferred) and tag release.
5. Document root cause and prevention in `CHANGELOG.md` and `docs/SECURITY.md`.
