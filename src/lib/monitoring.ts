type MonitoringContext = Record<string, unknown>;

type MonitoringPayload = {
  level: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  url: string;
  userAgent: string;
  context?: MonitoringContext;
};

const monitoringEnabled = import.meta.env.VITE_MONITORING_ENABLED === 'true';
const ingestUrl = import.meta.env.VITE_MONITORING_INGEST_URL?.trim();
const appName = import.meta.env.VITE_MONITORING_APP_NAME?.trim() || 'document-hub';

let monitoringInitialized = false;

function stringifyError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

async function sendMonitoringEvent(payload: MonitoringPayload) {
  if (!monitoringEnabled || !ingestUrl) return;

  const body = JSON.stringify({
    app: appName,
    ...payload,
  });

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(ingestUrl, blob);
    return;
  }

  await fetch(ingestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Intentionally swallow to avoid telemetry failures impacting UX.
  });
}

export function reportError(error: unknown, context?: MonitoringContext) {
  const message = stringifyError(error);
  const payload: MonitoringPayload = {
    level: 'error',
    message,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    context,
  };

  if (import.meta.env.DEV) {
    console.error('[monitoring] captured error', { message, context });
  }

  void sendMonitoringEvent(payload);
}

export function initMonitoring() {
  if (monitoringInitialized || typeof window === 'undefined') return;
  monitoringInitialized = true;

  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, {
      source: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, {
      source: 'window.unhandledrejection',
    });
  });
}
