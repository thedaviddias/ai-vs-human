import type { BrowserOptions, NodeOptions } from "@sentry/nextjs";

/**
 * Centralized Sentry configuration for AI vs Human
 *
 * Optimized for free tier:
 * - Low sample rates to preserve quota
 * - Aggressive error filtering to ignore noise
 * - Minimal breadcrumbs to reduce payload size
 * - No replays or profiling
 */

const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

/**
 * Common errors that are safe to ignore (browser quirks, network issues, user cancellations)
 */
export const IGNORED_ERRORS: (string | RegExp)[] = [
  // Browser quirks
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",

  // Network errors (user's network issues, not our bugs)
  "Network request failed",
  "Failed to fetch",
  "Load failed",
  "NetworkError",
  "net::ERR_",
  /^Loading chunk \d+ failed/,
  "ChunkLoadError",

  // User-initiated cancellations
  "AbortError",
  "The operation was aborted",
  "The user aborted a request",

  // Third-party script errors
  "Script error.",
  "Script error",

  // WebSocket errors (Convex reconnections are handled internally)
  "WebSocket connection failed",

  // Safari-specific
  "cancelled",

  // React hydration (usually caused by browser extensions)
  /Hydration failed because the server rendered HTML didn't match the client/,
  /There was an error while hydrating/,
  /Minified React error #\d+/,
];

/**
 * URLs to ignore errors from (browser extensions, third-party scripts)
 */
export const DENY_URLS: (string | RegExp)[] = [
  // Browser extensions
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^safari-extension:\/\//,
  /^safari-web-extension:\/\//,

  // Analytics scripts
  /plausible\.io/,
  /analytics\./,

  // Browser internals
  /^webkit-masked-url:\/\//,
];

/**
 * Shared Sentry configuration options
 * Used by client, server, and edge configs
 */
export const sharedSentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Production only: enabled when DSN is set
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && isProduction,

  // Environment tag: use Vercel's names so events show under vercel-production / vercel-preview
  environment:
    process.env.VERCEL_ENV === "production"
      ? "vercel-production"
      : process.env.VERCEL_ENV === "preview"
        ? "vercel-preview"
        : process.env.NODE_ENV || "development",

  // Release tracking (auto-populated by Vercel if available)
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Send all errors in production (no sampling)
  sampleRate: 1,

  // Sample only 1% of transactions for performance monitoring
  tracesSampleRate: 0.01,

  // Reduce breadcrumbs from 100 (default) to 20 for smaller payloads
  maxBreadcrumbs: 20,

  // Don't attach stack traces to non-error events (saves payload size)
  attachStacktrace: false,

  // Disable structured logs (uses quota)
  enableLogs: false,

  // Optional: set SENTRY_DEBUG=1 to log to console why events are or aren't sent
  debug: process.env.SENTRY_DEBUG === "1",

  // Error filtering
  ignoreErrors: IGNORED_ERRORS,
  denyUrls: DENY_URLS,

  /**
   * Filter errors before sending to Sentry.
   * Return null to drop the event.
   */
  beforeSend(event, hint) {
    const error = hint?.originalException;

    if (isDevelopment) {
      return null;
    }

    // Filter out errors from browser extensions
    if (event.exception?.values) {
      const isExtensionError = event.exception.values.some((exception) => {
        const frames = exception.stacktrace?.frames || [];
        return frames.some(
          (frame) =>
            frame.filename?.includes("chrome-extension://") ||
            frame.filename?.includes("moz-extension://") ||
            frame.filename?.includes("safari-extension://")
        );
      });

      if (isExtensionError) {
        return null;
      }
    }

    // Filter errors with no useful stack trace
    if (error instanceof Error && (!error.stack || error.stack === "Error") && !error.message) {
      return null;
    }

    return event;
  },

  /**
   * Filter breadcrumbs to reduce noise
   */
  beforeBreadcrumb(breadcrumb) {
    // Skip noisy console breadcrumbs
    if (breadcrumb.category === "console" && breadcrumb.level === "log") {
      return null;
    }

    // Skip fetch breadcrumbs for analytics endpoints
    if (breadcrumb.category === "fetch") {
      const url = breadcrumb.data?.url || "";
      if (url.includes("plausible.io")) {
        return null;
      }
    }

    return breadcrumb;
  },
} satisfies Partial<BrowserOptions & NodeOptions>;

/**
 * Client-specific options (browser)
 */
export const clientSentryOptions: BrowserOptions = {
  ...sharedSentryOptions,

  // Configure which URLs receive trace headers for distributed tracing
  tracePropagationTargets: [
    "localhost",
    // Convex API
    /^https:\/\/.*\.convex\.cloud/,
    // Our own API routes
    /^https:\/\/aivshuman\.thedaviddias\.com\/api/,
    /^https:\/\/.*\.vercel\.app\/api/,
  ],
};

/**
 * Server-specific options (Node.js runtime)
 */
export const serverSentryOptions: NodeOptions = {
  ...sharedSentryOptions,
};

/**
 * Edge-specific options (Edge runtime)
 */
export const edgeSentryOptions: NodeOptions = {
  ...sharedSentryOptions,

  // Edge runtime has limited APIs, keep config minimal
  maxBreadcrumbs: 10,
};
