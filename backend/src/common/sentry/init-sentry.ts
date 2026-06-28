/**
 * Опциональный Sentry — активируется только при SENTRY_DSN в окружении.
 */
export function initSentryIfConfigured(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as {
      init: (opts: Record<string, unknown>) => void;
    };
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    });
    // eslint-disable-next-line no-console
    console.log('[sentry] Инициализирован');
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[sentry] @sentry/node не установлен — мониторинг отключён');
  }
}
