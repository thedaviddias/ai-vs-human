/**
 * Pure computation helpers for user stats merging.
 * Extracted from users.ts so they can be tested without a DB context.
 */
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/authHelpers";

// ─── Types ──────────────────────────────────────────────────────────

export interface MergeableUser {
  owner: string;
  humanCommits: number;
  botCommits: number; // AI assistants (copilot, claude, cursor, etc.)
  automationCommits: number; // Maintenance bots (dependabot, renovate, etc.)
  totalCommits: number;
  humanPercentage: string;
  botPercentage: string;
  automationPercentage: string;
  [key: string]: unknown; // pass-through for other props (avatarUrl, repoCount, etc.)
}

export interface PrivateDayStat {
  human: number;
  ai: number;
  automation: number;
}

// ─── formatPercentage (shared with users.ts) ─────────────────────

export function formatPercentage(value: number): string {
  if (value === 0) return "0";
  if (value < 0.1) {
    const formatted = value.toFixed(2);
    return formatted.endsWith("0") ? value.toFixed(1) : formatted;
  }
  return value.toFixed(1);
}

// ─── computeMergedUserStats ──────────────────────────────────────

/**
 * Merges private daily stats into a user's public stats.
 * Pure function — no DB access, fully testable.
 *
 * Returns the original user object if privateDailyStats is empty.
 * Otherwise, returns a new object with summed commit counts and recalculated percentages.
 */
export function computeMergedUserStats<T extends MergeableUser>(
  user: T,
  privateDailyStats: PrivateDayStat[]
): T {
  if (privateDailyStats.length === 0) return user;

  let privateHuman = 0;
  let privateAi = 0;
  let privateAutomation = 0;

  for (const day of privateDailyStats) {
    privateHuman += day.human;
    privateAi += day.ai;
    privateAutomation += day.automation;
  }

  // If all private stats are zero, return unchanged
  if (privateHuman === 0 && privateAi === 0 && privateAutomation === 0) {
    return user;
  }

  const mergedHuman = user.humanCommits + privateHuman;
  const mergedBot = user.botCommits + privateAi;
  const mergedAutomation = user.automationCommits + privateAutomation;
  const mergedTotal = mergedHuman + mergedBot + mergedAutomation;

  return {
    ...user,
    humanCommits: mergedHuman,
    botCommits: mergedBot,
    automationCommits: mergedAutomation,
    totalCommits: mergedTotal,
    humanPercentage: mergedTotal > 0 ? formatPercentage((mergedHuman / mergedTotal) * 100) : "0",
    botPercentage: mergedTotal > 0 ? formatPercentage((mergedBot / mergedTotal) * 100) : "0",
    automationPercentage:
      mergedTotal > 0 ? formatPercentage((mergedAutomation / mergedTotal) * 100) : "0",
  };
}

// ─── shouldMergePrivateData ──────────────────────────────────────

/**
 * Determines whether private data should be merged into a user's public stats
 * for display on cards and leaderboards.
 */
export function shouldMergePrivateData(profile: {
  hasPrivateData: boolean;
  showPrivateDataPublicly?: boolean;
}): boolean {
  if (!profile.hasPrivateData) return false;
  // undefined means the user has never toggled → default to showing publicly
  return profile.showPrivateDataPublicly !== false;
}

// ─── requirePrivateDataAccess ────────────────────────────────────

/**
 * Enforces authorization for private data access.
 * Throws an error if the user is not authorized to view the data.
 */
export async function requirePrivateDataAccess(ctx: QueryCtx, githubLogin: string) {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_owner", (q) => q.eq("owner", githubLogin))
    .unique();

  // If the user hasn't explicitly set this to false, it defaults to true (publicly visible)
  if (profile?.showPrivateDataPublicly !== false) {
    return true;
  }

  // If it is false, we must verify the requesting user is the owner
  let user: {
    username?: string | null;
    email: string;
    name: string;
    image?: string | null;
  } | null = null;
  try {
    user = await authComponent.getAuthUser(ctx);
  } catch {
    throw new ConvexError("Unauthorized: Private data is not public. Please sign in.");
  }

  if (!user) {
    throw new ConvexError("Unauthorized: Private data is not public. Please sign in.");
  }

  const requestingLogin = await resolveGitHubLogin(ctx, user);
  if (requestingLogin?.toLowerCase() !== githubLogin.toLowerCase()) {
    throw new ConvexError("Unauthorized: You do not have permission to view this private data.");
  }

  return true;
}
