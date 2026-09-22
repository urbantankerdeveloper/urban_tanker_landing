import * as Sentry from '@sentry/node';

let enabled = false;

export function initializeMonitoring(): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development', tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1) });
  enabled = true;
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (enabled) Sentry.withScope(scope => { if (context) scope.setContext('context', context); Sentry.captureException(error); });
  else console.error(error);
}

export async function flushMonitoring(): Promise<void> {
  if (enabled) await Sentry.close(2000);
}
