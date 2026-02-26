import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Resolves the authenticated user's GitHub login (e.g. "thedaviddias").
 *
 * Priority order:
 * 1. `user.username` — set by `mapProfileToUser` on sign-in (correct for new users)
 * 2. `profiles` lookup by avatar URL — matches the user's GitHub avatar to find
 *    their profile `owner` (the GitHub login). Works for legacy users because
 *    both `user.image` and `profiles.avatarUrl` come from the same GitHub API.
 * 3. `repoContributorStats` lookup by email — last-ditch attempt; often fails
 *    because commit emails are frequently noreply addresses that differ from
 *    the OAuth email stored in better-auth.
 * 4. `null` — cannot determine login
 *
 * Why not just use `user.name`?
 * better-auth's GitHub provider sets `user.name` to the **display name** (e.g.
 * "David Dias"), not the login ("thedaviddias"). These can differ significantly,
 * and the login is what appears in URLs and the `profiles.owner` field.
 */
export async function resolveGitHubLogin(
  ctx: QueryCtx | MutationCtx,
  user: { username?: string | null; email: string; name: string; image?: string | null }
): Promise<string | null> {
  // Fast path: username was correctly set by mapProfileToUser on sign-in
  if (user.username) {
    return user.username;
  }

  // Fallback 1: match GitHub avatar URL against profiles table.
  // Both user.image (from OAuth) and profiles.avatarUrl (from GitHub API)
  // use the same format: https://avatars.githubusercontent.com/u/{id}?v=4
  // This is unique per GitHub account and stable across name changes.
  if (user.image) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_avatarUrl", (q) => q.eq("avatarUrl", user.image as string))
      .first();

    if (profile) {
      return profile.owner;
    }
  }

  // Fallback 2: cross-reference via repoContributorStats by email.
  // Often fails because git commit emails are noreply addresses, but worth trying.
  if (user.email) {
    const contributor = await ctx.db
      .query("repoContributorStats")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .first();

    if (contributor?.login) {
      return contributor.login;
    }
  }

  // Cannot determine login — user may need to sign out and sign back in
  return null;
}

/**
 * Builds the array of trusted origins for better-auth CSRF protection.
 *
 * better-auth validates the `Origin` header on every POST request against
 * this list. If the browser's origin is not included, the request is
 * rejected with a 403 "Invalid origin" error.
 *
 * This is extracted as a pure function so it can be unit-tested
 * independently of the Convex runtime.
 *
 * @param siteUrl      — The primary site URL (e.g. "https://aivshuman.dev")
 * @param extraOrigins — Optional comma-separated string of additional trusted origins
 *                        (e.g. from a TRUSTED_ORIGINS env var)
 */
export function buildTrustedOrigins(siteUrl: string, extraOrigins?: string): string[] {
  const origins = new Set<string>([
    siteUrl,
    // Local development — Next.js default port.
    // Both localhost and 127.0.0.1 are needed because browsers treat them
    // as different origins (different Host header → different Origin header).
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    // Vercel preview deployments use dynamic subdomains
    "https://*.vercel.app",
  ]);

  if (extraOrigins) {
    for (const origin of extraOrigins.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) {
        origins.add(trimmed);
      }
    }
  }

  return Array.from(origins);
}
