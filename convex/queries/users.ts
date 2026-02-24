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
}

async function getIndexedUsersHelper(ctx: QueryCtx) {
  const syncedRepos = await ctx.db
    .query("repos")
    .withIndex("by_syncStatus", (q) => q.eq("syncStatus", "synced"))
    .collect();

  const owners = new Map<string, OwnerAggregate>();

  for (const repo of syncedRepos) {
    const weeklyStats = await ctx.db
      .query("repoWeeklyStats")
      .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
      .collect();

    let repoHumanCommits = 0;
    let repoBotCommits = 0;

    for (const week of weeklyStats) {
      repoHumanCommits += week.human;
      repoBotCommits +=
        week.dependabot +
        week.renovate +
        week.copilot +
        week.claude +
        (week.cursor ?? 0) +
        week.githubActions +
        week.otherBot +
        week.aiAssisted;
    }

    const repoTotalCommits = repoHumanCommits + repoBotCommits;
    const repoLastIndexedAt = repo.lastSyncedAt ?? repo.requestedAt;
    const existing = owners.get(repo.owner);

    if (existing) {
      existing.repoCount += 1;
      existing.humanCommits += repoHumanCommits;
      existing.botCommits += repoBotCommits;
      existing.totalCommits += repoTotalCommits;
      existing.lastIndexedAt = Math.max(existing.lastIndexedAt, repoLastIndexedAt);
    } else {
      owners.set(repo.owner, {
        owner: repo.owner,
        repoCount: 1,
        humanCommits: repoHumanCommits,
        botCommits: repoBotCommits,
        totalCommits: repoTotalCommits,
        lastIndexedAt: repoLastIndexedAt,
      });
    }
  }

  return Array.from(owners.values())
    .map((owner) => ({
      owner: owner.owner,
      avatarUrl: `https://github.com/${owner.owner}.png?size=96`,
      repoCount: owner.repoCount,
      totalCommits: owner.totalCommits,
      humanCommits: owner.humanCommits,
      botCommits: owner.botCommits,
      lastIndexedAt: owner.lastIndexedAt,
      humanPercentage:
        owner.totalCommits > 0 ? ((owner.humanCommits / owner.totalCommits) * 100).toFixed(1) : "0",
      botPercentage:
        owner.totalCommits > 0 ? ((owner.botCommits / owner.totalCommits) * 100).toFixed(1) : "0",
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
      humanPercentage: totalCommits > 0 ? ((humanCommits / totalCommits) * 100).toFixed(1) : "0",
      aiPercentage: totalCommits > 0 ? ((aiCommits / totalCommits) * 100).toFixed(1) : "0",
      locHumanPercentage:
        totalAdditions > 0 ? ((humanAdditions / totalAdditions) * 100).toFixed(1) : null,
      locAiPercentage:
        totalAdditions > 0 ? ((aiAdditions / totalAdditions) * 100).toFixed(1) : null,
      dailyData,
    };
  },
});
