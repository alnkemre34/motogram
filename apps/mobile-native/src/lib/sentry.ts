import * as Sentry from '@sentry/react-native';

import { env } from '../config/env';

export function initSentry(): void {
  if (!env.sentryDsn) {
    // eslint-disable-next-line no-console
    console.warn('[sentry] DSN missing, disabled.');
    return;
  }
  Sentry.init({
    dsn: env.sentryDsn,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

export const captureException = Sentry.captureException.bind(Sentry);
export const captureMessage = Sentry.captureMessage.bind(Sentry);

