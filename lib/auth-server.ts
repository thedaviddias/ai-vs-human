import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

/**
 * Server-side auth utilities for Next.js.
 *
 * `handler` — used as the API route handler for /api/auth/[...all]
 * `isAuthenticated` — check auth status in server components / API routes
 * `getToken` — retrieve the session token for server-side Convex calls
 * `fetchAuthQuery` / `fetchAuthMutation` / `fetchAuthAction` — run
 *   authenticated Convex functions from server components
 * `preloadAuthQuery` — preload authenticated queries for SSR
 */
export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});
