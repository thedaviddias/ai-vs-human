import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";

interface OwnerAggregate {
  owner: string;
  repoCount: number;
  humanCommits: number;
  botCommits: number;
  totalCommits: number;
  lastIndexedAt: number;
  isSyncing: boolean;
}

function formatPercentage(value: number): string {
  if (value === 0) return "0";
  if (value < 0.1) {
    const formatted = value.toFixed(2);
    return formatted.endsWith("0") ? value.toFixed(1) : formatted;
  }
  return value.toFixed(1);
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
        humanCommits: 0,
        botCommits: 0,
        totalCommits: 0,
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
    let repoBotCommits = 0;

    for (const week of weeklyStats) {
      repoHumanCommits += week.human;
      // Only count AI coding tools, NOT automation bots (dependabot, renovate,
      // githubActions, otherBot). This matches the dashboard methodology so
      // percentages are consistent across cards and detail pages.
      repoBotCommits += week.copilot + week.claude + (week.cursor ?? 0) + week.aiAssisted;
    }

    const repoTotalCommits = repoHumanCommits + repoBotCommits;
    const repoLastIndexedAt = repo.lastSyncedAt ?? repo.requestedAt;
    const existing = owners.get(repo.owner)!;

    existing.repoCount += 1;
    existing.humanCommits += repoHumanCommits;
    existing.botCommits += repoBotCommits;
    existing.totalCommits += repoTotalCommits;
    existing.lastIndexedAt = Math.max(existing.lastIndexedAt, repoLastIndexedAt);
  }

  return Array.from(owners.values())
    .filter((owner) => owner.repoCount > 0) // Only show users who have at least one synced repo
    .map((owner) => ({
      owner: owner.owner,
      avatarUrl: `https://github.com/${owner.owner}.png?size=96`,
      repoCount: owner.repoCount,
      totalCommits: owner.totalCommits,
      humanCommits: owner.humanCommits,
      botCommits: owner.botCommits,
      lastIndexedAt: owner.lastIndexedAt,
      isSyncing: owner.isSyncing,
      humanPercentage:
        owner.totalCommits > 0
          ? formatPercentage((owner.humanCommits / owner.totalCommits) * 100)
          : "0",
      botPercentage:
        owner.totalCommits > 0
          ? formatPercentage((owner.botCommits / owner.totalCommits) * 100)
          : "0",
    }))
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
      result.push({
        ...user,
        isProfileSynced: !!profile,
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

export const getUserByOwner = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    let repos = await ctx.db
      .query("repos")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .collect();

    if (repos.length === 0) return null;

    // Sort and limit to top 20 to match dashboard logic
    repos = repos.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)).slice(0, 20);

    let humanCommits = 0;
    let aiCommits = 0;
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
        // Commits (AI tools only, exclude automation bots)
        humanCommits += week.human;
        aiCommits += week.copilot + week.claude + (week.cursor ?? 0) + week.aiAssisted;

        // LOC
        humanAdditions += week.humanAdditions ?? 0;
        aiAdditions +=
          (week.copilotAdditions ?? 0) +
          (week.claudeAdditions ?? 0) +
          (week.cursorAdditions ?? 0) +
          (week.aiAssistedAdditions ?? 0);
      }
    }

    const totalCommits = humanCommits + aiCommits;
    const totalAdditions = humanAdditions + aiAdditions;

    // Aggregate daily stats for heatmap
    const dayBuckets = new Map<
      number,
      { human: number; ai: number; humanAdditions: number; aiAdditions: number }
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
          existing.humanAdditions += stat.humanAdditions;
          existing.aiAdditions += stat.aiAdditions;
        } else {
          dayBuckets.set(stat.date, {
            human: stat.human,
            ai: stat.ai,
            humanAdditions: stat.humanAdditions,
            aiAdditions: stat.aiAdditions,
          });
        }
      }
    }

    const dailyData = Array.from(dayBuckets.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date - b.date);

    return {
      owner: args.owner,
      avatarUrl: `https://github.com/${args.owner}.png?size=160`,
      humanCommits,
      aiCommits,
      totalCommits,
      totalAdditions,
      repoCount: syncedRepoIds.length,
      humanPercentage:
        totalCommits > 0 ? formatPercentage((humanCommits / totalCommits) * 100) : "0",
      aiPercentage: totalCommits > 0 ? formatPercentage((aiCommits / totalCommits) * 100) : "0",
      locHumanPercentage:
        totalAdditions > 0 ? formatPercentage((humanAdditions / totalAdditions) * 100) : null,
      locAiPercentage:
        totalAdditions > 0 ? formatPercentage((aiAdditions / totalAdditions) * 100) : null,
      dailyData,
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

    // Enrich with profiles
    const result = [];
    for (const user of filtered) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_owner", (q) => q.eq("owner", user.owner))
        .unique();
      result.push({
        ...user,
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
