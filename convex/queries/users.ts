import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { computeMergedUserStats, formatPercentage, shouldMergePrivateData } from "./userHelpers";

interface OwnerAggregate {
  owner: string;
  repoCount: number;
  totalStars: number;
  humanCommits: number;
  botCommits: number; // AI Assistants
  automationCommits: number; // Maintenance bots
  totalCommits: number;
  humanAdditions: number;
  aiAdditions: number;
  automationAdditions: number;
  totalAdditions: number;
  lastIndexedAt: number;
  isSyncing: boolean;
}

async function getIndexedUsersHelper(ctx: QueryCtx) {
  // Get ALL repos for these owners to check sync status accurately
  const allRepos = await ctx.db.query("repos").collect();

  const owners = new Map<string, OwnerAggregate>();

  // First pass: identify all owners and their sync status
  for (const repo of allRepos) {
    const existing = owners.get(repo.owner);
    const isRepoSyncing = repo.syncStatus === "pending" || repo.syncStatus === "syncing";

    if (existing) {
      existing.isSyncing = existing.isSyncing || isRepoSyncing;
    } else {
      owners.set(repo.owner, {
        owner: repo.owner,
        repoCount: 0,
        totalStars: 0,
        humanCommits: 0,
        botCommits: 0,
        automationCommits: 0,
        totalCommits: 0,
        humanAdditions: 0,
        aiAdditions: 0,
        automationAdditions: 0,
        totalAdditions: 0,
        lastIndexedAt: repo.requestedAt,
        isSyncing: isRepoSyncing,
      });
    }
  }

  // Second pass: aggregate stats only for synced repos
  const syncedRepos = allRepos.filter((r) => r.syncStatus === "synced");

  for (const repo of syncedRepos) {
    const weeklyStats = await ctx.db
      .query("repoWeeklyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
      .collect();

    let repoHumanCommits = 0;
    let repoBotCommits = 0; // AI assistants
    let repoAutomationCommits = 0; // Maintenance bots
    let repoTotalCommits = 0; // Use week.total (authoritative source of truth)
    let repoHumanAdditions = 0;
    let repoAiAdditions = 0;
    let repoTotalAdditions = 0;

    for (const week of weeklyStats) {
      repoHumanCommits += week.human;
      repoBotCommits +=
        week.copilot +
        week.claude +
        (week.cursor ?? 0) +
        week.aiAssisted +
        (week.aider ?? 0) +
        (week.devin ?? 0) +
        (week.openaiCodex ?? 0) +
        (week.gemini ?? 0);

      repoAutomationCommits += week.dependabot + week.renovate + week.githubActions + week.otherBot;

      // Use the pre-computed total from the DB — it's the source of truth
      repoTotalCommits += week.total;

      // LOC (additions)
      repoHumanAdditions += week.humanAdditions ?? 0;
      repoAiAdditions +=
        (week.copilotAdditions ?? 0) +
        (week.claudeAdditions ?? 0) +
        (week.cursorAdditions ?? 0) +
        (week.aiAssistedAdditions ?? 0) +
        (week.aiderAdditions ?? 0) +
        (week.devinAdditions ?? 0) +
        (week.openaiCodexAdditions ?? 0) +
        (week.geminiAdditions ?? 0);
      repoTotalAdditions += week.totalAdditions ?? 0;
    }
    const repoAutomationAdditions = Math.max(
      0,
      repoTotalAdditions - repoHumanAdditions - repoAiAdditions
    );
    const repoLastIndexedAt = repo.lastSyncedAt ?? repo.requestedAt;
    const existing = owners.get(repo.owner)!;

    existing.repoCount += 1;
    existing.totalStars += repo.stars ?? 0;
    existing.humanCommits += repoHumanCommits;
    existing.botCommits += repoBotCommits;
    existing.automationCommits += repoAutomationCommits;
    existing.totalCommits += repoTotalCommits;
    existing.humanAdditions += repoHumanAdditions;
    existing.aiAdditions += repoAiAdditions;
    existing.automationAdditions += repoAutomationAdditions;
    existing.totalAdditions += repoTotalAdditions;
    existing.lastIndexedAt = Math.max(existing.lastIndexedAt, repoLastIndexedAt);
  }

  return Array.from(owners.values())
    .filter((owner) => owner.repoCount > 0) // Only show users who have at least one synced repo
    .map((owner) => {
      return {
        owner: owner.owner,
        avatarUrl: `https://github.com/${owner.owner}.png?size=96`,
        repoCount: owner.repoCount,
        totalStars: owner.totalStars,
        totalCommits: owner.totalCommits,
        humanCommits: owner.humanCommits,
        botCommits: owner.botCommits,
        automationCommits: owner.automationCommits,
        lastIndexedAt: owner.lastIndexedAt,
        isSyncing: owner.isSyncing,
        // Commit-based percentages (primary, following GitHub convention)
        humanPercentage:
          owner.totalCommits > 0
            ? formatPercentage((owner.humanCommits / owner.totalCommits) * 100)
            : "0",
        botPercentage:
          owner.totalCommits > 0
            ? formatPercentage((owner.botCommits / owner.totalCommits) * 100)
            : "0",
        automationPercentage:
          owner.totalCommits > 0
            ? formatPercentage((owner.automationCommits / owner.totalCommits) * 100)
            : "0",
      };
    })
    .sort(
      (a, b) =>
        b.lastIndexedAt - a.lastIndexedAt ||
        b.totalCommits - a.totalCommits ||
        b.repoCount - a.repoCount ||
        a.owner.localeCompare(b.owner)
    );
}

export const getIndexedUsers = query({
  args: {},
  handler: async (ctx) => {
    return getIndexedUsersHelper(ctx);
  },
});

/**
 * Merges private aggregate stats into a user object returned by getIndexedUsersHelper.
 * Only aggregate numbers are read — no repo names, SHAs, or messages.
 * Delegates pure computation to computeMergedUserStats (tested in mergePrivateStats.test.ts).
 */
async function mergePrivateStatsIntoUser(
  ctx: QueryCtx,
  user: Awaited<ReturnType<typeof getIndexedUsersHelper>>[0]
) {
  const privateDailyStats = await ctx.db
    .query("userPrivateDailyStats")
    .withIndex("by_login", (q) => q.eq("githubLogin", user.owner))
    .collect();

  return computeMergedUserStats(user, privateDailyStats);
}

import { requirePrivateDataAccess } from "./userHelpers";

export const getIndexedUsersWithProfiles = query({
  args: {},
  handler: async (ctx) => {
    const users = await getIndexedUsersHelper(ctx);
    const result = [];

    for (const user of users) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_owner", (q) => q.eq("owner", user.owner))
        .unique();

      const hasPrivateData = profile?.hasPrivateData === true;

      // Use tested helper to determine merge eligibility
      const shouldMerge = shouldMergePrivateData({
        hasPrivateData,
        showPrivateDataPublicly: profile?.showPrivateDataPublicly,
      });

      let mergedUser = user;
      if (shouldMerge) {
        mergedUser = await mergePrivateStatsIntoUser(ctx, user);
      }

      result.push({
        ...mergedUser,
        hasPrivateData,
        isProfileSynced: !!profile,
        // Preserve original public-only values for fair leaderboard ranking
        publicTotalCommits: user.totalCommits,
        publicTotalStars: user.totalStars,
        profile: profile
          ? {
              name: profile.name,
              followers: profile.followers,
              avatarUrl: profile.avatarUrl,
            }
          : undefined,
      });
    }
    return result;
  },
});

export const getProfile = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .unique();
  },
});

/**
 * Returns the profile `owner` (GitHub login) matching the given avatar URL.
 *
 * Used as a client-side fallback when `getMyGitHubLogin` returns null
 * (legacy users whose `username` field is unset). Both better-auth's
 * `user.image` and `profiles.avatarUrl` store the same GitHub avatar
 * URL (`https://avatars.githubusercontent.com/u/{id}?v=4`), which is
 * unique per account and stable across name changes.
 */
export const getProfileOwnerByAvatarUrl = query({
  args: { avatarUrl: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_avatarUrl", (q) => q.eq("avatarUrl", args.avatarUrl))
      .first();
    return profile?.owner ?? null;
  },
});

/**
 * Internal helper that fetches public repo data for a user.
 * Extracted so it can be reused by both getUserByOwner and getUserByOwnerWithPrivateData.
 */
async function getUserByOwnerHelper(ctx: QueryCtx, owner: string) {
  let repos = await ctx.db
    .query("repos")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .collect();

  if (repos.length === 0) return null;

  // Sort and limit to top 20 to match dashboard logic
  repos = repos.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)).slice(0, 20);

  let humanCommits = 0;
  let aiCommits = 0;
  let automationCommits = 0;
  let humanAdditions = 0;
  let aiAdditions = 0;
  const syncedRepoIds = [];

  for (const repo of repos) {
    if (repo.syncStatus === "synced") {
      syncedRepoIds.push(repo._id);
    }

    const weeklyStats = await ctx.db
      .query("repoWeeklyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
      .collect();

    for (const week of weeklyStats) {
      // Commits (AI tools only — automation bots counted separately)
      humanCommits += week.human;
      aiCommits +=
        week.copilot +
        week.claude +
        (week.cursor ?? 0) +
        week.aiAssisted +
        (week.aider ?? 0) +
        (week.devin ?? 0) +
        (week.openaiCodex ?? 0) +
        (week.gemini ?? 0);
      automationCommits += week.dependabot + week.renovate + week.githubActions + week.otherBot;

      // LOC
      humanAdditions += week.humanAdditions ?? 0;
      aiAdditions +=
        (week.copilotAdditions ?? 0) +
        (week.claudeAdditions ?? 0) +
        (week.cursorAdditions ?? 0) +
        (week.aiAssistedAdditions ?? 0) +
        (week.aiderAdditions ?? 0) +
        (week.devinAdditions ?? 0) +
        (week.openaiCodexAdditions ?? 0) +
        (week.geminiAdditions ?? 0);
    }
  }

  const totalCommits = humanCommits + aiCommits + automationCommits;
  const totalAdditions = humanAdditions + aiAdditions;

  // Aggregate daily stats for heatmap
  const dayBuckets = new Map<
    number,
    {
      human: number;
      ai: number;
      automation: number;
      humanAdditions: number;
      aiAdditions: number;
      automationAdditions: number;
    }
  >();

  for (const repoId of syncedRepoIds) {
    const dailyStats = await ctx.db
      .query("repoDailyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", repoId))
      .collect();

    for (const stat of dailyStats) {
      const existing = dayBuckets.get(stat.date);
      if (existing) {
        existing.human += stat.human;
        existing.ai += stat.ai;
        existing.automation += stat.automation ?? 0;
        existing.humanAdditions += stat.humanAdditions;
        existing.aiAdditions += stat.aiAdditions;
        existing.automationAdditions += stat.automationAdditions ?? 0;
      } else {
        dayBuckets.set(stat.date, {
          human: stat.human,
          ai: stat.ai,
          automation: stat.automation ?? 0,
          humanAdditions: stat.humanAdditions,
          aiAdditions: stat.aiAdditions,
          automationAdditions: stat.automationAdditions ?? 0,
        });
      }
    }
  }

  const dailyData = Array.from(dayBuckets.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date - b.date);

  return {
    owner,
    avatarUrl: `https://github.com/${owner}.png?size=160`,
    humanCommits,
    aiCommits,
    automationCommits,
    totalCommits,
    totalAdditions,
    repoCount: syncedRepoIds.length,
    humanPercentage: totalCommits > 0 ? formatPercentage((humanCommits / totalCommits) * 100) : "0",
    aiPercentage: totalCommits > 0 ? formatPercentage((aiCommits / totalCommits) * 100) : "0",
    automationPercentage:
      totalCommits > 0 ? formatPercentage((automationCommits / totalCommits) * 100) : "0",
    locHumanPercentage:
      totalAdditions > 0 ? formatPercentage((humanAdditions / totalAdditions) * 100) : null,
    locAiPercentage:
      totalAdditions > 0 ? formatPercentage((aiAdditions / totalAdditions) * 100) : null,
    dailyData,
  };
}

export const getUserByOwner = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    return getUserByOwnerHelper(ctx, args.owner);
  },
});

/**
 * Returns user data with private daily stats merged into dailyData.
 * Used by the private OG image route to generate an image that includes
 * the owner's private activity for personal sharing/download.
 */
export const getUserByOwnerWithPrivateData = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    await requirePrivateDataAccess(ctx, args.owner);
    const baseUser = await getUserByOwnerHelper(ctx, args.owner);
    if (!baseUser) return null;

    const privateDailyStats = await ctx.db
      .query("userPrivateDailyStats")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.owner))
      .collect();

    if (privateDailyStats.length === 0) return baseUser;

    // Merge private daily stats into the public dailyData for heatmap
    const dailyMap = new Map(baseUser.dailyData.map((d) => [d.date, { ...d }]));

    let privateHuman = 0;
    let privateAi = 0;
    let privateAutomation = 0;

    for (const priv of privateDailyStats) {
      privateHuman += priv.human;
      privateAi += priv.ai;
      privateAutomation += priv.automation;

      const existing = dailyMap.get(priv.date);
      if (existing) {
        existing.human += priv.human;
        existing.ai += priv.ai;
        existing.automation += priv.automation;
      } else {
        dailyMap.set(priv.date, {
          date: priv.date,
          human: priv.human,
          ai: priv.ai,
          automation: priv.automation,
          humanAdditions: 0,
          aiAdditions: 0,
          automationAdditions: 0,
        });
      }
    }

    // Recalculate merged totals and percentages
    const mergedHuman = baseUser.humanCommits + privateHuman;
    const mergedAi = baseUser.aiCommits + privateAi;
    const mergedAutomation = baseUser.automationCommits + privateAutomation;
    const mergedTotal = mergedHuman + mergedAi + mergedAutomation;

    const mergedDailyData = Array.from(dailyMap.values()).sort((a, b) => a.date - b.date);

    return {
      ...baseUser,
      humanCommits: mergedHuman,
      aiCommits: mergedAi,
      automationCommits: mergedAutomation,
      totalCommits: mergedTotal,
      humanPercentage: mergedTotal > 0 ? formatPercentage((mergedHuman / mergedTotal) * 100) : "0",
      aiPercentage: mergedTotal > 0 ? formatPercentage((mergedAi / mergedTotal) * 100) : "0",
      automationPercentage:
        mergedTotal > 0 ? formatPercentage((mergedAutomation / mergedTotal) * 100) : "0",
      dailyData: mergedDailyData,
    };
  },
});

export const getRelatedRecentUsers = query({
  args: { owner: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const allUsers = await getIndexedUsersHelper(ctx);
    const limit = args.limit ?? 6;

    if (allUsers.length <= 1) return [];

    // Find the target user's position
    const targetIndex = allUsers.findIndex((u) => u.owner === args.owner);

    let start = 0;
    if (targetIndex === -1) {
      // If target not found (not synced yet), just return latest
      start = 0;
    } else {
      // Try to center the target user
      start = Math.max(0, targetIndex - Math.floor(limit / 2));
      if (start + limit > allUsers.length) {
        start = Math.max(0, allUsers.length - limit);
      }
    }

    const selectedUsers = allUsers.slice(start, start + limit + 1);
    // Filter out the current user and limit to the requested amount
    const filtered = selectedUsers.filter((u) => u.owner !== args.owner).slice(0, limit);

    // Enrich with profiles and merge private stats
    const result = [];
    for (const user of filtered) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_owner", (q) => q.eq("owner", user.owner))
        .unique();

      const hasPrivateData = profile?.hasPrivateData === true;

      const shouldMerge = shouldMergePrivateData({
        hasPrivateData,
        showPrivateDataPublicly: profile?.showPrivateDataPublicly,
      });

      let mergedUser = user;
      if (shouldMerge) {
        mergedUser = await mergePrivateStatsIntoUser(ctx, user);
      }

      result.push({
        ...mergedUser,
        hasPrivateData,
        profile: profile
          ? {
              name: profile.name,
              followers: profile.followers,
              avatarUrl: profile.avatarUrl,
            }
          : undefined,
      });
    }

    return result;
  },
});
