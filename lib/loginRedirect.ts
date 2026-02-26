/**
 * Builds the redirect URL after OAuth sign-in.
 *
 * After GitHub OAuth completes, we redirect the user to their profile
 * page (`/{githubLogin}`) instead of the homepage. This gives immediate
 * feedback that auth worked and lets them see their enriched data.
 *
 * Falls back to `/` if the username is unavailable (defensive — should
 * never happen in practice since better-auth always provides `user.name`).
 */
export function buildProfileRedirectUrl(username: string | null | undefined): string {
  if (!username) return "/";
  return `/${encodeURIComponent(username)}`;
}
