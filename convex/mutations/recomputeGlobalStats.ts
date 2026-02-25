import { internalMutation } from "../_generated/server";

export const recomputeGlobalStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete existing global stats
    const existingStats = await ctx.db.query("globalWeeklyStats").collect();
    for (const stat of existingStats) {
      await ctx.db.delete(stat._id);
    }

    // Get all synced repos
    const syncedRepos = await ctx.db
      .query("repos")
      .withIndex("by_syncStatus", (q) => q.eq("syncStatus", "synced"))
      .collect();

    // Aggregate all repo weekly stats
    const globalBuckets = new Map<
      number,
      {
        weekLabel: string;
        human: number;
        dependabot: number;
        renovate: number;
        copilot: number;
        claude: number;
        cursor: number;
        aider: number;
        devin: number;
        openaiCodex: number;
        gemini: number;
        githubActions: number;
        otherBot: number;
        aiAssisted: number;
        total: number;
        // LOC fields
        humanAdditions: number;
        copilotAdditions: number;
        claudeAdditions: number;
        cursorAdditions: number;
        aiderAdditions: number;
        devinAdditions: number;
        openaiCodexAdditions: number;
        geminiAdditions: number;
        aiAssistedAdditions: number;
        totalAdditions: number;
        totalDeletions: number;
        repoIds: Set<string>;
      }
    >();

    for (const repo of syncedRepos) {
      const repoStats = await ctx.db
        .query("repoWeeklyStats")
        .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
        .collect();

      for (const stat of repoStats) {
        const existing = globalBuckets.get(stat.weekStart);
        if (existing) {
          existing.human += stat.human;
          existing.dependabot += stat.dependabot;
          existing.renovate += stat.renovate;
          existing.copilot += stat.copilot;
          existing.claude += stat.claude;
          existing.cursor += stat.cursor ?? 0;
          existing.aider += stat.aider ?? 0;
          existing.devin += stat.devin ?? 0;
          existing.openaiCodex += stat.openaiCodex ?? 0;
          existing.gemini += stat.gemini ?? 0;
          existing.githubActions += stat.githubActions;
          existing.otherBot += stat.otherBot;
          existing.aiAssisted += stat.aiAssisted;
          existing.total += stat.total;
          // LOC
          existing.humanAdditions += stat.humanAdditions ?? 0;
          existing.copilotAdditions += stat.copilotAdditions ?? 0;
          existing.claudeAdditions += stat.claudeAdditions ?? 0;
          existing.cursorAdditions += stat.cursorAdditions ?? 0;
          existing.aiderAdditions += stat.aiderAdditions ?? 0;
          existing.devinAdditions += stat.devinAdditions ?? 0;
          existing.openaiCodexAdditions += stat.openaiCodexAdditions ?? 0;
          existing.geminiAdditions += stat.geminiAdditions ?? 0;
          existing.aiAssistedAdditions += stat.aiAssistedAdditions ?? 0;
          existing.totalAdditions += stat.totalAdditions ?? 0;
          existing.totalDeletions += stat.totalDeletions ?? 0;
          existing.repoIds.add(repo._id);
        } else {
          globalBuckets.set(stat.weekStart, {
            weekLabel: stat.weekLabel,
            human: stat.human,
            dependabot: stat.dependabot,
            renovate: stat.renovate,
            copilot: stat.copilot,
            claude: stat.claude,
            cursor: stat.cursor ?? 0,
            aider: stat.aider ?? 0,
            devin: stat.devin ?? 0,
            openaiCodex: stat.openaiCodex ?? 0,
            gemini: stat.gemini ?? 0,
            githubActions: stat.githubActions,
            otherBot: stat.otherBot,
            aiAssisted: stat.aiAssisted,
            total: stat.total,
            // LOC
            humanAdditions: stat.humanAdditions ?? 0,
            copilotAdditions: stat.copilotAdditions ?? 0,
            claudeAdditions: stat.claudeAdditions ?? 0,
            cursorAdditions: stat.cursorAdditions ?? 0,
            aiderAdditions: stat.aiderAdditions ?? 0,
            devinAdditions: stat.devinAdditions ?? 0,
            openaiCodexAdditions: stat.openaiCodexAdditions ?? 0,
            geminiAdditions: stat.geminiAdditions ?? 0,
            aiAssistedAdditions: stat.aiAssistedAdditions ?? 0,
            totalAdditions: stat.totalAdditions ?? 0,
            totalDeletions: stat.totalDeletions ?? 0,
            repoIds: new Set([repo._id]),
          });
        }
      }
    }

    // Insert global weekly stats
    for (const [weekStart, bucket] of globalBuckets) {
      await ctx.db.insert("globalWeeklyStats", {
        weekStart,
        weekLabel: bucket.weekLabel,
        human: bucket.human,
        dependabot: bucket.dependabot,
        renovate: bucket.renovate,
        copilot: bucket.copilot,
        claude: bucket.claude,
        cursor: bucket.cursor,
        aider: bucket.aider,
        devin: bucket.devin,
        openaiCodex: bucket.openaiCodex,
        gemini: bucket.gemini,
        githubActions: bucket.githubActions,
        otherBot: bucket.otherBot,
        aiAssisted: bucket.aiAssisted,
        total: bucket.total,
        repoCount: bucket.repoIds.size,
        // LOC
        humanAdditions: bucket.humanAdditions,
        copilotAdditions: bucket.copilotAdditions,
        claudeAdditions: bucket.claudeAdditions,
        cursorAdditions: bucket.cursorAdditions,
        aiderAdditions: bucket.aiderAdditions,
        devinAdditions: bucket.devinAdditions,
        openaiCodexAdditions: bucket.openaiCodexAdditions,
        geminiAdditions: bucket.geminiAdditions,
        aiAssistedAdditions: bucket.aiAssistedAdditions,
        totalAdditions: bucket.totalAdditions,
        totalDeletions: bucket.totalDeletions,
      });
    }

    // --- Global daily stats ---
    const existingDailyStats = await ctx.db.query("globalDailyStats").collect();
    for (const stat of existingDailyStats) {
      await ctx.db.delete(stat._id);
    }

    // Aggregate all repo daily stats by date
    const globalDayBuckets = new Map<
      number,
      {
        human: number;
        ai: number;
        automation: number;
        humanAdditions: number;
        aiAdditions: number;
        automationAdditions: number;
        repoIds: Set<string>;
      }
    >();

    for (const repo of syncedRepos) {
      const repoDailyStats = await ctx.db
        .query("repoDailyStats")
        .withIndex("by_repo", (q) => q.eq("repoId", repo._id))
        .collect();

      for (const stat of repoDailyStats) {
        const existing = globalDayBuckets.get(stat.date);
        if (existing) {
          existing.human += stat.human;
          existing.ai += stat.ai;
          existing.automation += stat.automation ?? 0;
          existing.humanAdditions += stat.humanAdditions;
          existing.aiAdditions += stat.aiAdditions;
          existing.automationAdditions += stat.automationAdditions ?? 0;
          existing.repoIds.add(repo._id);
        } else {
          globalDayBuckets.set(stat.date, {
            human: stat.human,
            ai: stat.ai,
            automation: stat.automation ?? 0,
            humanAdditions: stat.humanAdditions,
            aiAdditions: stat.aiAdditions,
            automationAdditions: stat.automationAdditions ?? 0,
            repoIds: new Set([repo._id]),
          });
        }
      }
    }

    // Insert global daily stats
    for (const [date, bucket] of globalDayBuckets) {
      await ctx.db.insert("globalDailyStats", {
        date,
        human: bucket.human,
        ai: bucket.ai,
        automation: bucket.automation,
        humanAdditions: bucket.humanAdditions,
        aiAdditions: bucket.aiAdditions,
        automationAdditions: bucket.automationAdditions,
        repoCount: bucket.repoIds.size,
      });
    }
  },
});
