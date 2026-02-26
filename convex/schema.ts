import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { classificationValidator } from "./lib/validators";

export default defineSchema({
  repos: defineTable({
    owner: v.string(),
    name: v.string(),
    fullName: v.string(),
    description: v.optional(v.string()),
    stars: v.optional(v.number()),
    defaultBranch: v.string(),
    githubId: v.number(),
    syncStatus: v.union(
      v.literal("pending"),
      v.literal("syncing"),
      v.literal("synced"),
      v.literal("error")
    ),
    syncError: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    totalCommitsFetched: v.optional(v.number()),
    syncCursor: v.optional(v.string()),
    // Progress tracking — updated during sync pipeline
    syncStage: v.optional(v.string()), // "fetching_commits" | "enriching_loc" | "classifying_prs" | "computing_stats"
    syncCommitsFetched: v.optional(v.number()), // running count, updated per page of 100 commits
    requestedAt: v.number(),
    pushedAt: v.optional(v.number()), // GitHub pushed_at timestamp — used to order sync queue (latest first)
    // Granular tool/bot breakdown — computed during sync while commits exist, persisted after cleanup
    toolBreakdown: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          commits: v.number(),
          additions: v.number(),
        })
      )
    ),
    botBreakdown: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          commits: v.number(),
        })
      )
    ),
    prAttribution: v.optional(
      v.object({
        totalCommits: v.number(),
        aiCommits: v.number(),
        automationCommits: v.number(),
        breakdown: v.array(
          v.object({
            key: v.string(),
            label: v.string(),
            lane: v.union(v.literal("ai"), v.literal("automation")),
            commits: v.number(),
          })
        ),
        computedAt: v.number(),
      })
    ),
  })
    .index("by_fullName", ["fullName"])
    .index("by_owner", ["owner"])
    .index("by_owner_syncStatus", ["owner", "syncStatus"])
    .index("by_syncStatus", ["syncStatus"])
    .index("by_githubId", ["githubId"]),

  commits: defineTable({
    repoId: v.id("repos"),
    sha: v.string(),
    message: v.string(),
    fullMessage: v.optional(v.string()),
    authoredAt: v.number(),
    committedAt: v.number(),
    authorName: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    authorGithubUserId: v.optional(v.number()),
    authorLogin: v.optional(v.string()),
    authorType: v.optional(v.string()),
    committerName: v.optional(v.string()),
    committerEmail: v.optional(v.string()),
    classification: classificationValidator,
    coAuthors: v.optional(v.array(v.string())),
    additions: v.optional(v.number()),
    deletions: v.optional(v.number()),
  })
    .index("by_repo", ["repoId"])
    .index("by_repo_and_date", ["repoId", "authoredAt"])
    .index("by_sha", ["sha"])
    .index("by_repo_and_classification", ["repoId", "classification"]),

  repoWeeklyStats: defineTable({
    repoId: v.id("repos"),
    weekStart: v.number(),
    weekLabel: v.string(),
    human: v.number(),
    dependabot: v.number(),
    renovate: v.number(),
    copilot: v.number(),
    claude: v.number(),
    cursor: v.optional(v.number()),
    aider: v.optional(v.number()),
    devin: v.optional(v.number()),
    openaiCodex: v.optional(v.number()),
    gemini: v.optional(v.number()),
    githubActions: v.number(),
    otherBot: v.number(),
    aiAssisted: v.number(),
    total: v.number(),
    // LOC (lines of code) per classification — additions only
    humanAdditions: v.optional(v.number()),
    copilotAdditions: v.optional(v.number()),
    claudeAdditions: v.optional(v.number()),
    cursorAdditions: v.optional(v.number()),
    aiderAdditions: v.optional(v.number()),
    devinAdditions: v.optional(v.number()),
    openaiCodexAdditions: v.optional(v.number()),
    geminiAdditions: v.optional(v.number()),
    aiAssistedAdditions: v.optional(v.number()),
    totalAdditions: v.optional(v.number()),
    totalDeletions: v.optional(v.number()),
  })
    .index("by_repo", ["repoId"])
    .index("by_repo_and_week", ["repoId", "weekStart"]),

  repoContributorStats: defineTable({
    repoId: v.id("repos"),
    login: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    classification: v.string(),
    commitCount: v.number(),
    additions: v.optional(v.number()),
    deletions: v.optional(v.number()),
    firstCommitAt: v.number(),
    lastCommitAt: v.number(),
  })
    .index("by_repo", ["repoId"])
    .index("by_repo_and_commits", ["repoId", "commitCount"])
    .index("by_email", ["email"]),

  globalWeeklyStats: defineTable({
    weekStart: v.number(),
    weekLabel: v.string(),
    human: v.number(),
    dependabot: v.number(),
    renovate: v.number(),
    copilot: v.number(),
    claude: v.number(),
    cursor: v.optional(v.number()),
    aider: v.optional(v.number()),
    devin: v.optional(v.number()),
    openaiCodex: v.optional(v.number()),
    gemini: v.optional(v.number()),
    githubActions: v.number(),
    otherBot: v.number(),
    aiAssisted: v.number(),
    total: v.number(),
    repoCount: v.number(),
    // LOC (lines of code) per classification — additions only
    humanAdditions: v.optional(v.number()),
    copilotAdditions: v.optional(v.number()),
    claudeAdditions: v.optional(v.number()),
    cursorAdditions: v.optional(v.number()),
    aiderAdditions: v.optional(v.number()),
    devinAdditions: v.optional(v.number()),
    openaiCodexAdditions: v.optional(v.number()),
    geminiAdditions: v.optional(v.number()),
    aiAssistedAdditions: v.optional(v.number()),
    totalAdditions: v.optional(v.number()),
    totalDeletions: v.optional(v.number()),
  }).index("by_week", ["weekStart"]),

  repoDailyStats: defineTable({
    repoId: v.id("repos"),
    date: v.number(), // epoch ms, midnight UTC
    human: v.number(),
    ai: v.number(),
    automation: v.optional(v.number()),
    humanAdditions: v.number(),
    aiAdditions: v.number(),
    automationAdditions: v.optional(v.number()),
  })
    .index("by_repo", ["repoId"])
    .index("by_repo_and_date", ["repoId", "date"]),

  globalDailyStats: defineTable({
    date: v.number(), // epoch ms, midnight UTC
    human: v.number(),
    ai: v.number(),
    automation: v.optional(v.number()),
    humanAdditions: v.number(),
    aiAdditions: v.number(),
    automationAdditions: v.optional(v.number()),
    repoCount: v.number(),
  }).index("by_date", ["date"]),

  rateLimits: defineTable({
    ipHash: v.string(),
    date: v.string(),
    requestCount: v.number(),
  }).index("by_ip_and_date", ["ipHash", "date"]),

  resyncRateLimits: defineTable({
    owner: v.string(),
    ipHash: v.string(),
    lastResyncAt: v.number(),
    dayKey: v.string(),
    dayCount: v.number(),
  }).index("by_owner_ip", ["owner", "ipHash"]),

  repoResyncRateLimits: defineTable({
    repoFullName: v.string(),
    ipHash: v.string(),
    lastResyncAt: v.number(),
    dayKey: v.string(),
    dayCount: v.number(),
  }).index("by_repo_ip", ["repoFullName", "ipHash"]),

  profiles: defineTable({
    owner: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.string(),
    followers: v.number(),
    lastUpdated: v.number(),
    hasPrivateData: v.optional(v.boolean()),
    /** Whether private activity is visible to public visitors. undefined = true (default on). */
    showPrivateDataPublicly: v.optional(v.boolean()),
  })
    .index("by_owner", ["owner"])
    .index("by_avatarUrl", ["avatarUrl"]),

  // ─── Private Repo Aggregate Stats ─────────────────────────────
  // These tables store ONLY aggregate numbers keyed by githubLogin.
  // NO repo names, NO commit messages, NO SHAs, NO file paths.

  userPrivateDailyStats: defineTable({
    githubLogin: v.string(),
    date: v.number(), // epoch ms, midnight UTC
    human: v.number(),
    ai: v.number(),
    automation: v.number(),
    humanAdditions: v.number(),
    aiAdditions: v.number(),
    automationAdditions: v.number(),
  })
    .index("by_login", ["githubLogin"])
    .index("by_login_and_date", ["githubLogin", "date"]),

  userPrivateWeeklyStats: defineTable({
    githubLogin: v.string(),
    weekStart: v.number(),
    weekLabel: v.string(),
    human: v.number(),
    copilot: v.number(),
    claude: v.number(),
    cursor: v.optional(v.number()),
    aider: v.optional(v.number()),
    devin: v.optional(v.number()),
    openaiCodex: v.optional(v.number()),
    gemini: v.optional(v.number()),
    aiAssisted: v.number(),
    dependabot: v.number(),
    renovate: v.number(),
    githubActions: v.number(),
    otherBot: v.number(),
    total: v.number(),
    humanAdditions: v.optional(v.number()),
    copilotAdditions: v.optional(v.number()),
    claudeAdditions: v.optional(v.number()),
    cursorAdditions: v.optional(v.number()),
    aiderAdditions: v.optional(v.number()),
    devinAdditions: v.optional(v.number()),
    openaiCodexAdditions: v.optional(v.number()),
    geminiAdditions: v.optional(v.number()),
    aiAssistedAdditions: v.optional(v.number()),
    totalAdditions: v.optional(v.number()),
    totalDeletions: v.optional(v.number()),
  })
    .index("by_login", ["githubLogin"])
    .index("by_login_and_week", ["githubLogin", "weekStart"]),

  userPrivateSyncStatus: defineTable({
    githubLogin: v.string(),
    syncStatus: v.union(
      v.literal("idle"),
      v.literal("syncing"),
      v.literal("synced"),
      v.literal("error")
    ),
    syncError: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    includesPrivateData: v.boolean(),
    // Progress tracking — updated during sync so the UI can show live progress.
    // All fields are optional for backward compatibility with existing rows.
    totalRepos: v.optional(v.number()),
    processedRepos: v.optional(v.number()),
    totalCommitsFound: v.optional(v.number()),
  }).index("by_login", ["githubLogin"]),
});
