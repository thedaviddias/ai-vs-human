import * as Sentry from "@sentry/nextjs";

type LogContext = Record<string, unknown>;

/**
 * Centralized logger that wraps console + Sentry.
 *
 * - `error()` captures an exception (or message) in Sentry and logs to console.
 * - `warn()` adds a Sentry breadcrumb (context for the next error) and logs to console.
 * - `info()` adds a Sentry breadcrumb and logs to console.
 *
 * Sentry SDK is configured with `enabled: process.env.NODE_ENV === "production"`,
 * so Sentry calls are no-ops in development — console output is always preserved.
 */
export const logger = {
  /**
   * Log an error and capture it in Sentry.
   *
   * If `error` is an Error instance, Sentry receives the full stack trace.
   * Otherwise, Sentry records a message-level event with the original value attached.
   */
  error(message: string, error?: unknown, context?: LogContext) {
    console.error(message, error);

    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: { message, ...context },
      });
    } else {
      Sentry.captureMessage(message, {
        level: "error",
        extra: { originalError: error, ...context },
      });
    }
  },

  /**
   * Log a warning. Appears as a Sentry breadcrumb — adds context
   * to the next captured error but does NOT create its own Sentry event.
   */
  warn(message: string, context?: LogContext) {
    console.warn(message, context);
    Sentry.addBreadcrumb({
      message,
      level: "warning",
      data: context,
    });
  },

  /**
   * Log an informational message as a Sentry breadcrumb.
   */
  info(message: string, context?: LogContext) {
    console.log(message, context);
    Sentry.addBreadcrumb({
      message,
      level: "info",
      data: context,
    });
  },
};
