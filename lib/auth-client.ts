import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Client-side auth instance used by React components.
 *
 * Provides hooks like `authClient.useSession()` and methods like
 * `authClient.signIn.social({ provider: "github" })`.
 *
 * The `convexClient` plugin synchronises the auth token with the
 * Convex client so authenticated queries/mutations work automatically.
 */
export const authClient = createAuthClient({
  plugins: [convexClient()],
});
