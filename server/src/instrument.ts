/**
 * Sentry instrumentation — must be the very first import in the server entry point.
 * Sentry v8 uses OpenTelemetry under the hood and requires early initialization
 * before any other modules are loaded.
 */
import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

dotenv.config();

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',

    // Capture 100% of transactions in production for now.
    // Lower this (e.g. 0.1 = 10%) once traffic grows.
    tracesSampleRate: 1.0,

    // Redact sensitive data from breadcrumbs
    beforeSend(event) {
      // Strip authorization headers from captured events
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  console.log('✅ Sentry monitoring initialized.');
} else {
  console.warn('⚠️  SENTRY_DSN not set — error monitoring is disabled.');
}
