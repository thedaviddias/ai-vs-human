import * as Sentry from "@sentry/nextjs";
import "./sentry.client.config";
import { initBotId } from "botid/client/core";

// Sentry navigation instrumentation for App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Only initialize BotID client on Vercel — in local dev the proxy
// endpoint doesn't exist (withBotId is skipped in next.config.ts),
// so these challenge requests would fail with EBADF or 404.
// Note: NEXT_PUBLIC_VERCEL_ENV is auto-set by Vercel ("production" | "preview" | "development").
// NEXT_PUBLIC_VERCEL is NOT a Vercel system env var and would always be undefined.
if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  initBotId({
    protect: [
      { path: "/api/analyze/repo", method: "POST" },
      { path: "/api/analyze/user", method: "POST" },
      { path: "/api/analyze/resync-user", method: "POST" },
    ],
  });
}
