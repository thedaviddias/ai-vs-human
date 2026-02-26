import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

/**
 * Server-side auth utilities for Next.js.
 *
 * `handler` — used as the API route handler for /api/auth/[...all]
 */
type AuthServer = ReturnType<typeof convexBetterAuthNextJs>;

let cachedAuthServer: AuthServer | null = null;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set in the Next.js environment.`);
  }
  return value;
}

function getAuthServer(): AuthServer {
  if (cachedAuthServer) return cachedAuthServer;

  const convexUrl = requireEnv("NEXT_PUBLIC_CONVEX_URL", process.env.NEXT_PUBLIC_CONVEX_URL);
  // Support both names: CONVEX_SITE_URL is the package's canonical env var,
  // NEXT_PUBLIC_CONVEX_SITE_URL is kept for existing project compatibility.
  const convexSiteUrl = requireEnv(
    "CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_SITE_URL",
    process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  );

  cachedAuthServer = convexBetterAuthNextJs({
    convexUrl,
    convexSiteUrl,
  });

  return cachedAuthServer;
}

export const handler: AuthServer["handler"] = {
  GET: (request) => getAuthServer().handler.GET(request),
  POST: (request) => getAuthServer().handler.POST(request),
};
