/**
 * Shared GitHub API helpers for rate-limit handling across all sync actions.
 *
 * Centralizes logic that was previously duplicated (with inconsistencies)
 * across fetchCommits.ts, fetchCommitStats.ts, and privateRepoSync.ts.
 */

export interface GitHubRateLimitInfo {
  /** Remaining requests in the current window, or null if header missing */
  remaining: number | null;
  /** Epoch ms when the rate-limit window resets, or null if header missing */
  resetAt: number | null;
  /** True when GitHub returned 403 specifically because the rate limit is exhausted */
  isRateLimited: boolean;
}

/**
 * Extracts rate-limit info from GitHub REST API response headers.
 * Works for both 403 rate-limit responses and successful responses.
 */
export function extractRateLimitInfo(response: Response): GitHubRateLimitInfo {
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const resetTime = response.headers.get("X-RateLimit-Reset");

  const remainingNum = remaining !== null ? parseInt(remaining, 10) : null;
  const resetMs = resetTime !== null ? parseInt(resetTime, 10) * 1000 : null;

  return {
    remaining: remainingNum,
    resetAt: resetMs,
    isRateLimited: response.status === 403 && remainingNum === 0,
  };
}

/**
 * Calculates the delay in ms before retrying after a rate limit hit.
 * Falls back to 60s if the reset timestamp is missing.
 */
export function getRetryDelayMs(rateLimitInfo: GitHubRateLimitInfo): number {
  if (!rateLimitInfo.resetAt) return 60_000;
  return Math.max(0, rateLimitInfo.resetAt - Date.now()) + 1_000;
}

/** Standard headers for GitHub REST API requests. */
export function getGitHubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}
