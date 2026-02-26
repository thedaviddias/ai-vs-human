import { handler } from "@/lib/auth-server";

/**
 * Catch-all proxy route for better-auth.
 *
 * All requests to /api/auth/* are forwarded to the Convex HTTP router
 * which handles the actual OAuth flow, session management, etc.
 */
export const { GET, POST } = handler;
