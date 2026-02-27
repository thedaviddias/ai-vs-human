"use client";

import { useMutation, useQuery } from "convex/react";
import {
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Lock,
  RefreshCw,
  Star,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HumanAiBadges } from "@/components/badges/HumanAiBadges";
import { UserCard } from "@/components/cards/UserCard";
import { AIToolBreakdown } from "@/components/charts/AIToolBreakdown";
import { BotToolBreakdown } from "@/components/charts/BotToolBreakdown";
import { ContributionHeatmap } from "@/components/charts/ContributionHeatmap";
import { StatsSummary } from "@/components/charts/StatsSummary";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ShareButtons } from "@/components/sharing/ShareButtons";
import { OwnerPageSkeleton } from "@/components/skeletons/PageSkeletons";
import { NotificationModal } from "@/components/ui/NotificationModal";
import { PrivateDataBadge } from "@/components/ui/PrivateDataBadge";
import { PrivateRepoCard } from "@/components/ui/PrivateRepoCard";
import { api } from "@/convex/_generated/api";
import {
  aggregateMultiRepoStats,
  buildBreakdownFromWeeklyStats,
  computeUserSummary,
  mergeDetailedBreakdowns,
  mergePublicAndPrivateWeeklyStats,
  sumPrivateDailyStats,
} from "@/lib/aggregateUserStats";
import { authClient } from "@/lib/auth-client";
import { useSound } from "@/lib/hooks/useSound";
import { logger } from "@/lib/logger";
import { postJson } from "@/lib/postJson";
import { shouldAutoTriggerPrivateSync } from "@/lib/privateSyncTrigger";
import { shouldShowPrivateData } from "@/lib/privateVisibility";
import { getSyncBadgeLabel, getSyncStageLabel } from "@/lib/syncProgress";
import { trackEvent } from "@/lib/tracking";
import { createUserAutoAnalyzePlan } from "@/lib/userAutoAnalyzePlan";
import { formatPercentage } from "@/lib/utils";

const SYNC_FUN_MESSAGES = [
  "Counting ones and zeros...",
  "Teaching robots to read git logs...",
  "Asking GitHub very politely...",
  "Sorting spaghetti code from linguine code...",
  "Converting coffee into commit data...",
  "Peeking behind the curtain of your repos...",
  "Decoding your developer DNA...",
  "This is faster than a code review, promise...",
  "Running git blame on your entire career...",
  "Finding the human behind the machine...",
  "Measuring the AI vibes in your codebase...",
  "Your commits are telling a great story...",
  "Calculating your human-to-robot ratio...",
  "Almost there... just one more API call...",
  "Doing science with your commit history...",
  "Scanning for traces of Copilot...",
  "Your repos have quite the personality...",
  "Impressive commit streak, by the way...",
  "Separating human art from AI craft...",
  "Crunching numbers at the speed of git...",
];

/** Cycles through fun messages at a regular interval while syncing */
function useFunSyncMessage(isActive: boolean) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * SYNC_FUN_MESSAGES.length));

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % SYNC_FUN_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isActive]);

  return SYNC_FUN_MESSAGES[index];
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
  pushed_at: string | null;
}

const chartModes = ["commits", "loc"] as const;
const repoSortModes = ["latest", "stars"] as const;
const viewModes = ["owner", "public"] as const;

export function UserDashboardContent({ owner }: { owner: string }) {
  // Auth: detect if the viewer is looking at their own profile.
  // We use `getMyGitHubLogin` (returns GitHub login from the `username` field)
  // instead of `session.user.name` — which is the GitHub display name
  // (e.g., "David Dias") and doesn't match the URL's `owner` param.
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const myGitHubLogin = useQuery(api.auth.getMyGitHubLogin, session?.user ? {} : "skip");

  // Profile query — needed early for isOwnProfile fallback and privacy toggle
  const cachedProfile = useQuery(api.queries.users.getProfile, { owner });

  // "View as visitor" mode: ?view=public overrides isOwnProfile to false,
  // letting the owner see exactly what visitors see on their profile.
  const [viewMode, setViewMode] = useQueryState(
    "view",
    parseAsStringLiteral(viewModes).withDefault("owner").withOptions({ scroll: false })
  );

  const isActualOwner = useMemo(() => {
    // Primary: compare resolved GitHub login with URL owner
    if (myGitHubLogin) {
      return myGitHubLogin.toLowerCase() === owner.toLowerCase();
    }
    // Fallback: compare avatar URLs — both come from the GitHub API and
    // are unique per account (https://avatars.githubusercontent.com/u/{id}?v=4).
    // This works even for legacy users where getMyGitHubLogin returns null.
    if (session?.user?.image && cachedProfile?.avatarUrl) {
      return session.user.image === cachedProfile.avatarUrl;
    }
    return false;
  }, [myGitHubLogin, owner, session?.user?.image, cachedProfile?.avatarUrl]);

  // When ?view=public, pretend we're not the owner so the page renders
  // exactly as a visitor would see it (no PrivateRepoCard, no owner-only controls).
  const isPublicPreview = isActualOwner && viewMode === "public";
  const isOwnProfile = isActualOwner && !isPublicPreview;

  // Private data queries (reactive — update as sync progresses)
  const privateSyncStatus = useQuery(api.queries.privateStats.getUserPrivateSyncStatus, {
    githubLogin: owner,
  });

  const hasPrivateData = privateSyncStatus?.includesPrivateData === true;

  // Determine if private data should be visible to the current viewer
  const showPrivateToViewer = useMemo(
    () =>
      shouldShowPrivateData({
        isOwnProfile,
        hasPrivateData,
        showPrivateDataPublicly: cachedProfile?.showPrivateDataPublicly,
      }),
    [isOwnProfile, hasPrivateData, cachedProfile?.showPrivateDataPublicly]
  );

  const privateDailyStats = useQuery(
    api.queries.privateStats.getUserPrivateDailyStats,
    showPrivateToViewer && privateSyncStatus?.includesPrivateData ? { githubLogin: owner } : "skip"
  );

  // Private weekly stats — needed to merge into the stat card percentages.
  // Without this, the Human/AI/Bot percentages only reflect public repos.
  const privateWeeklyStats = useQuery(
    api.queries.privateStats.getUserPrivateWeeklyStats,
    showPrivateToViewer && privateSyncStatus?.includesPrivateData ? { githubLogin: owner } : "skip"
  );

  // Auto-trigger private sync on first visit after sign-in
  const requestPrivateSync = useMutation(api.mutations.requestPrivateSync.requestPrivateSync);
  const updatePrivateVisibility = useMutation(
    api.mutations.updatePrivateVisibility.updatePrivateVisibility
  );
  const hasAutoTriggeredPrivateSync = useRef(false);

  useEffect(() => {
    if (hasAutoTriggeredPrivateSync.current) return;

    const shouldTrigger = shouldAutoTriggerPrivateSync({
      isOwnProfile,
      isAuthenticated: !!session?.user,
      privateSyncStatus: privateSyncStatus === undefined ? undefined : privateSyncStatus,
    });

    if (shouldTrigger) {
      hasAutoTriggeredPrivateSync.current = true;
      void requestPrivateSync();
    }
  }, [isOwnProfile, session, privateSyncStatus, requestPrivateSync]);

  const [sortMode, setSortMode] = useQueryState(
    "sort",
    parseAsStringLiteral(repoSortModes).withDefault("latest").withOptions({ scroll: false })
  );
  const ownerHref = `/${encodeURIComponent(owner)}`;
  const ownerBreadcrumbs = [
    { label: "Home", href: "/" },
    { label: owner, href: ownerHref },
  ];

  // Phase 1: Fetch public repos from GitHub (to keep sync triggering logic)
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Phase 2: Local fallback for profile (cachedProfile fetched above for privacy check)
  const [localProfile, setLocalProfile] = useState<{
    name: string | null;
    avatar_url: string;
  } | null>(null);

  useEffect(() => {
    async function fetchGitHubRepos() {
      try {
        const [reposRes, userRes] = await Promise.all([
          fetch(`https://api.github.com/users/${owner}/repos?per_page=100&type=public`),
          fetch(`https://api.github.com/users/${owner}`),
        ]);

        if (reposRes.status === 404) {
          setGithubError(`GitHub user "${owner}" not found.`);
          setGithubLoading(false);
          return;
        }

        if (!reposRes.ok) {
          setGithubError(`Failed to fetch repos: ${reposRes.statusText}`);
          setGithubLoading(false);
          return;
        }

        const [reposData, userData] = await Promise.all([
          reposRes.json() as Promise<GitHubRepo[]>,
          userRes.ok
            ? (userRes.json() as Promise<{ name: string | null; avatar_url: string }>)
            : null,
        ]);

        // Exclude forks, sort by stars descending, take top 20
        const ownRepos = reposData
          .filter((r) => !r.fork)
          .sort((a, b) => b.stargazers_count - a.stargazers_count)
          .slice(0, 20);

        setGithubRepos(ownRepos);
        if (userData) setLocalProfile(userData);
      } catch {
        setGithubError("Failed to fetch data from GitHub.");
      } finally {
        setGithubLoading(false);
      }
    }

    fetchGitHubRepos();
  }, [owner]);

  const githubDisplayName = cachedProfile?.name ?? localProfile?.name ?? null;
  const githubAvatarUrl =
    cachedProfile?.avatarUrl ??
    localProfile?.avatar_url ??
    `https://github.com/${owner}.png?size=160`;

  const [isFirstIngestion, setIsFirstIngestion] = useState(false);

  useEffect(() => {
    if (!owner) return;
    setHasTriggered(false);
    setIsFirstIngestion(false);
  }, [owner]);

  const [chartMode, setChartMode] = useQueryState(
    "view",
    parseAsStringLiteral(chartModes).withDefault("commits").withOptions({ scroll: false })
  );

  // Resync: allows user to re-trigger analysis with latest classification
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncError, setResyncError] = useState<string | null>(null);

  const handleResync = useCallback(async () => {
    trackEvent("resync", { owner: owner });
    setIsResyncing(true);
    setResyncError(null);
    try {
      // Reset existing repos and queue analysis in one protected server flow.
      await postJson("/api/analyze/resync-user", {
        owner: owner,
        repos: githubRepos.map((repo) => ({
          owner: owner,
          name: repo.name,
          ...(repo.pushed_at ? { pushedAt: new Date(repo.pushed_at).getTime() } : {}),
        })),
      });
    } catch (error) {
      logger.error("Failed to re-sync user analysis", error, { owner: owner });
      setResyncError(
        error instanceof Error ? error.message : "Failed to re-sync. Please try again."
      );
    } finally {
      // The button stays in loading state until syncing actually starts
      // (the reactive query will show syncing status)
      setTimeout(() => setIsResyncing(false), 1000);
    }
  }, [owner, githubRepos]);

  // Phase 3: Reactive queries for sync progress + chart data
  // Build fullNames from `owner` (URL param) + repo name so they match the
  // format stored in Convex. GitHub's `r.full_name` uses canonical casing
  // (e.g. "MarwanBz/repo") which may differ from the URL path ("marwanbz").
  const repoFullNames = useMemo(
    () => githubRepos.map((r) => `${owner}/${r.name}`),
    [owner, githubRepos]
  );

  const convexRepos = useQuery(
    api.queries.repos.getReposByFullNames,
    repoFullNames.length > 0 ? { fullNames: repoFullNames } : "skip"
  );

  const autoAnalyzePlan = useMemo(() => {
    if (githubRepos.length === 0 || !convexRepos) return null;

    return createUserAutoAnalyzePlan({
      owner,
      githubRepos: githubRepos.map((repo) => ({
        name: repo.name,
        fullName: `${owner}/${repo.name}`,
        ...(repo.pushed_at ? { pushedAt: new Date(repo.pushed_at).getTime() } : {}),
      })),
      convexRepos,
    });
  }, [owner, githubRepos, convexRepos]);

  useEffect(() => {
    if (!autoAnalyzePlan || hasTriggered) return;
    setHasTriggered(true);

    if (!autoAnalyzePlan.shouldTrigger) return;

    const reposToAnalyze =
      autoAnalyzePlan.reposToAnalyze.length > 0
        ? autoAnalyzePlan.reposToAnalyze
        : githubRepos[0]
          ? [
              {
                owner,
                name: githubRepos[0].name,
                ...(githubRepos[0].pushed_at
                  ? { pushedAt: new Date(githubRepos[0].pushed_at).getTime() }
                  : {}),
              },
            ]
          : [];

    if (reposToAnalyze.length === 0) return;

    if (autoAnalyzePlan.showBootstrapIndicator) {
      setIsFirstIngestion(true);
    }

    void postJson("/api/analyze/user", { repos: reposToAnalyze })
      .then(() => {
        if (autoAnalyzePlan.showBootstrapIndicator) {
          // Keep "initializing" briefly to avoid flicker before reactive data updates.
          setTimeout(() => setIsFirstIngestion(false), 3000);
        }
      })
      .catch((error) => {
        logger.error("Failed to queue user analysis", error, { owner: owner });
        setIsFirstIngestion(false);
      });
  }, [autoAnalyzePlan, githubRepos, hasTriggered, owner]);

  const multiStats = useQuery(
    api.queries.stats.getMultiRepoWeeklyStats,
    repoFullNames.length > 0 ? { repoFullNames } : "skip"
  );

  const multiDailyStats = useQuery(
    api.queries.stats.getMultiRepoDailyStats,
    repoFullNames.length > 0 ? { repoFullNames } : "skip"
  );

  const multiRepoDetailedBreakdown = useQuery(
    api.queries.stats.getMultiRepoDetailedBreakdown,
    repoFullNames.length > 0 ? { repoFullNames } : "skip"
  );

  // Merge public + private daily stats for the heatmap.
  // Private stats are keyed by date (epoch ms) — we add counts to matching days
  // or create new entries for days that only have private activity.
  const dailyData = useMemo(() => {
    const publicData = multiDailyStats ?? [];
    if (!privateDailyStats || privateDailyStats.length === 0) return publicData;

    // Build a map from the public data
    const dayMap = new Map<number, (typeof publicData)[0]>();
    for (const day of publicData) {
      dayMap.set(day.date, { ...day });
    }

    // Merge private stats into the map
    for (const priv of privateDailyStats) {
      const existing = dayMap.get(priv.date);
      if (existing) {
        dayMap.set(priv.date, {
          ...existing,
          human: existing.human + priv.human,
          ai: existing.ai + priv.ai,
          automation: (existing.automation ?? 0) + priv.automation,
          humanAdditions: existing.humanAdditions + priv.humanAdditions,
          aiAdditions: existing.aiAdditions + priv.aiAdditions,
          automationAdditions: (existing.automationAdditions ?? 0) + priv.automationAdditions,
        });
      } else {
        // Day exists only in private data
        dayMap.set(priv.date, {
          date: priv.date,
          human: priv.human,
          ai: priv.ai,
          automation: priv.automation,
          humanAdditions: priv.humanAdditions,
          aiAdditions: priv.aiAdditions,
          automationAdditions: priv.automationAdditions,
        });
      }
    }

    return Array.from(dayMap.values()).sort((a, b) => a.date - b.date);
  }, [multiDailyStats, privateDailyStats]);

  // Total private commits for the stats card breakdown ("public + private")
  const privateCommitCount = useMemo(() => {
    if (!privateDailyStats || privateDailyStats.length === 0) return undefined;
    return sumPrivateDailyStats(privateDailyStats);
  }, [privateDailyStats]);

  // Merge public + private weekly stats, then aggregate by week.
  // This ensures stat cards (Human %, AI %, Bot %) reflect BOTH public and private data
  // when the user has linked private repos and visibility allows it.
  // When private data is unlinked, privateWeeklyStats becomes empty → reverts to public only.
  const aggregated = useMemo(() => {
    if (!multiStats) return [];
    const merged = mergePublicAndPrivateWeeklyStats(multiStats, privateWeeklyStats ?? []);
    return aggregateMultiRepoStats(merged);
  }, [multiStats, privateWeeklyStats]);

  const userSummary = useMemo(
    () => (aggregated.length > 0 ? computeUserSummary(aggregated) : null),
    [aggregated]
  );

  // Merge private tool/bot breakdowns into the public detailed breakdown.
  // `multiRepoDetailedBreakdown` reads from the repos table (public only, but with
  // granular keys like "coderabbit"). Private weekly stats add the standard 7 tools.
  const mergedBreakdown = useMemo(() => {
    if (!multiRepoDetailedBreakdown) return null;
    if (!privateWeeklyStats || privateWeeklyStats.length === 0) return multiRepoDetailedBreakdown;

    const privateBreakdown = buildBreakdownFromWeeklyStats(
      privateWeeklyStats as Array<Record<string, number | string | undefined>>
    );
    return mergeDetailedBreakdowns(multiRepoDetailedBreakdown, privateBreakdown);
  }, [multiRepoDetailedBreakdown, privateWeeklyStats]);

  const repoPercentagesById = useMemo(() => {
    if (!multiStats)
      return new Map<
        string,
        {
          humanPercentage: string;
          aiPercentage: string;
          automationPercentage: string;
          automationTools: string[];
        }
      >();

    const totalsByRepo = new Map<
      string,
      {
        human: number;
        ai: number;
        automation: number;
        total: number;
        dependabot: number;
        renovate: number;
        githubActions: number;
        otherBot: number;
      }
    >();
    for (const stat of multiStats) {
      const existing = totalsByRepo.get(stat.repoId) ?? {
        human: 0,
        ai: 0,
        automation: 0,
        total: 0,
        dependabot: 0,
        renovate: 0,
        githubActions: 0,
        otherBot: 0,
      };

      // 3-way split: human / AI tools / automation bots
      const aiCommits =
        stat.aiAssisted +
        stat.copilot +
        stat.claude +
        (stat.cursor ?? 0) +
        (stat.aider ?? 0) +
        (stat.devin ?? 0) +
        (stat.openaiCodex ?? 0) +
        (stat.gemini ?? 0);
      const automationCommits =
        stat.dependabot + stat.renovate + stat.githubActions + stat.otherBot;

      existing.human += stat.human;
      existing.ai += aiCommits;
      existing.automation += automationCommits;
      existing.total += stat.human + aiCommits + automationCommits;
      existing.dependabot += stat.dependabot;
      existing.renovate += stat.renovate;
      existing.githubActions += stat.githubActions;
      existing.otherBot += stat.otherBot;

      totalsByRepo.set(stat.repoId, existing);
    }

    const percentagesByRepo = new Map<
      string,
      {
        humanPercentage: string;
        aiPercentage: string;
        automationPercentage: string;
        automationTools: string[];
      }
    >();
    for (const [repoId, totals] of totalsByRepo) {
      const humanPercentage =
        totals.total > 0 ? formatPercentage((totals.human / totals.total) * 100) : "0";
      const aiPercentage =
        totals.total > 0 ? formatPercentage((totals.ai / totals.total) * 100) : "0";
      const automationPercentage =
        totals.total > 0 ? formatPercentage((totals.automation / totals.total) * 100) : "0";

      // Build list of active automation tools
      const automationTools: string[] = [];
      if (totals.dependabot > 0) automationTools.push("Dependabot");
      if (totals.renovate > 0) automationTools.push("Renovate");
      if (totals.githubActions > 0) automationTools.push("GitHub Actions");
      if (totals.otherBot > 0) automationTools.push("Other bots");

      percentagesByRepo.set(repoId, {
        humanPercentage,
        aiPercentage,
        automationPercentage,
        automationTools,
      });
    }

    return percentagesByRepo;
  }, [multiStats]);

  // Sync progress — split into "actively syncing" vs "queued"
  const activeCount = useMemo(() => {
    if (!convexRepos) return 0;
    return convexRepos.filter((r) => r.repo?.syncStatus === "syncing").length;
  }, [convexRepos]);

  const pendingCount = useMemo(() => {
    if (!convexRepos) return 0;
    return convexRepos.filter((r) => r.repo?.syncStatus === "pending").length;
  }, [convexRepos]);

  const syncedCount = useMemo(() => {
    if (!convexRepos) return 0;
    return convexRepos.filter((r) => r.repo?.syncStatus === "synced").length;
  }, [convexRepos]);

  const relatedUsers = useQuery(api.queries.users.getRelatedRecentUsers, {
    owner,
    limit: 6,
  });

  const isAnySyncing = useMemo(() => {
    if (!convexRepos) return false;
    return activeCount > 0 || pendingCount > 0;
  }, [activeCount, pendingCount, convexRepos]);

  // Find the currently syncing repo for detailed progress display
  const currentlySyncing = useMemo(() => {
    if (!convexRepos) return null;
    const syncingRepo = convexRepos.find((r) => r.repo?.syncStatus === "syncing");
    if (!syncingRepo?.repo) return null;
    return {
      name: syncingRepo.repo.name,
      syncStage: syncingRepo.repo.syncStage as string | undefined,
      syncCommitsFetched: syncingRepo.repo.syncCommitsFetched as number | undefined,
    };
  }, [convexRepos]);

  const totalRepoCount = convexRepos?.length ?? 0;

  const isSyncInProgress = (githubRepos.length > 0 && isAnySyncing) || isFirstIngestion;

  // True while Convex stats queries are still loading (undefined).
  // Prevents flashing "No analysis data available." before data arrives.
  const isDataLoading = repoFullNames.length > 0 && multiStats === undefined;

  // Notification logic
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [wantsNotification, setWantsNotification] = useState(false);
  const prevSyncingRef = useRef(isSyncInProgress);
  const { playSuccess } = useSound();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSyncInProgress) {
      timer = setTimeout(() => {
        setShowNotificationPrompt(true);
      }, 20000); // 20 seconds
    } else {
      setShowNotificationPrompt(false);
    }
    return () => clearTimeout(timer);
  }, [isSyncInProgress]);

  useEffect(() => {
    if (prevSyncingRef.current && !isSyncInProgress && wantsNotification) {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Analysis Ready! 🚀", {
          body: `@${owner}'s contribution breakdown is now available.`,
          icon: "/icon.png",
        });
        playSuccess();
      }
      setWantsNotification(false);
    }
    prevSyncingRef.current = isSyncInProgress;
  }, [isSyncInProgress, wantsNotification, owner, playSuccess]);

  const funMessage = useFunSyncMessage(isSyncInProgress);

  const repoGroups = useMemo(() => {
    if (!githubRepos || githubRepos.length === 0) return [];

    if (sortMode === "stars") {
      const starBuckets: Record<string, GitHubRepo[]> = {
        "1000+": [],
        "100+": [],
        "10+": [],
        "1+": [],
        none: [],
      };

      for (const repo of githubRepos) {
        const stars = repo.stargazers_count;
        if (stars >= 1000) starBuckets["1000+"].push(repo);
        else if (stars >= 100) starBuckets["100+"].push(repo);
        else if (stars >= 10) starBuckets["10+"].push(repo);
        else if (stars >= 1) starBuckets["1+"].push(repo);
        else starBuckets.none.push(repo);
      }

      const sortByStars = (repos: GitHubRepo[]) =>
        repos.sort((a, b) => b.stargazers_count - a.stargazers_count);

      const starGroupOrder = [
        { key: "1000+", label: "1,000+ Stars" },
        { key: "100+", label: "100+ Stars" },
        { key: "10+", label: "10+ Stars" },
        { key: "1+", label: "1+ Stars" },
        { key: "none", label: "No Stars" },
      ];

      return starGroupOrder
        .filter(({ key }) => starBuckets[key].length > 0)
        .map(({ key, label }) => ({ label, repos: sortByStars(starBuckets[key]) }));
    }

    // "latest": group by time period based on pushed_at
    const now = Date.now();
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const threeMonths = 3 * oneMonth;
    const sixMonths = 6 * oneMonth;
    const oneYear = 365 * 24 * 60 * 60 * 1000;

    const buckets: Record<string, GitHubRepo[]> = {
      thisMonth: [],
      last3Months: [],
      last6Months: [],
      thisYear: [],
      older: [],
    };

    for (const repo of githubRepos) {
      const pushedAt = repo.pushed_at ? new Date(repo.pushed_at).getTime() : 0;
      const age = now - pushedAt;

      if (age <= oneMonth) buckets.thisMonth.push(repo);
      else if (age <= threeMonths) buckets.last3Months.push(repo);
      else if (age <= sixMonths) buckets.last6Months.push(repo);
      else if (age <= oneYear) buckets.thisYear.push(repo);
      else buckets.older.push(repo);
    }

    const sortByPushed = (repos: GitHubRepo[]) =>
      repos.sort((a, b) => {
        const timeA = a.pushed_at ? new Date(a.pushed_at).getTime() : 0;
        const timeB = b.pushed_at ? new Date(b.pushed_at).getTime() : 0;
        return timeB - timeA;
      });

    const groupOrder = [
      { key: "thisMonth", label: "This Month" },
      { key: "last3Months", label: "Last 3 Months" },
      { key: "last6Months", label: "Last 6 Months" },
      { key: "thisYear", label: "This Year" },
      { key: "older", label: "Older" },
    ];

    return groupOrder
      .filter(({ key }) => buckets[key].length > 0)
      .map(({ key, label }) => ({ label, repos: sortByPushed(buckets[key]) }));
  }, [githubRepos, sortMode]);

  // Flat sorted list used only for the "has any repos" check
  const hasRepos = githubRepos.length > 0;

  // Loading state
  if (githubLoading) {
    return <OwnerPageSkeleton />;
  }

  // Error state
  if (githubError) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-neutral-500">{githubError}</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Go back and try again
        </Link>
      </div>
    );
  }

  if (githubRepos.length === 0) {
    return (
      <div className="py-8">
        <Breadcrumbs items={ownerBreadcrumbs} />
        <div className="mt-16 text-center text-neutral-500">
          <h1 className="text-2xl font-bold">{owner}</h1>
          <p className="mt-2">No public repositories found for this user.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 relative">
      {/* Management Actions - Top Right */}
      <div className="absolute right-0 top-0 flex items-center gap-2 sm:right-4 sm:top-4 z-10">
        <button
          type="button"
          onClick={handleResync}
          disabled={isResyncing || isSyncInProgress || githubRepos.length === 0}
          title={
            githubRepos.length === 0
              ? "GitHub repos not loaded — try refreshing the page"
              : undefined
          }
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-500 transition-all hover:bg-neutral-900 hover:text-neutral-300 active:scale-95 disabled:opacity-50 sm:gap-2 sm:px-3 sm:py-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncInProgress ? "animate-spin" : ""}`} />
          Re-sync
        </button>
        {isActualOwner && !isPublicPreview && (
          <button
            type="button"
            onClick={() => setViewMode("public")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-500 transition-all hover:bg-neutral-900 hover:text-neutral-300 active:scale-95 sm:gap-2 sm:px-3 sm:py-2"
          >
            <Eye className="h-3.5 w-3.5" />
            View as visitor
          </button>
        )}
      </div>

      {/* User Header - Minimal & Focused */}
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <Image
            src={githubAvatarUrl || `https://github.com/${owner}.png?size=160`}
            alt={owner}
            width={128}
            height={128}
            className="h-24 w-24 rounded-full border-4 border-neutral-900 shadow-2xl sm:h-32 sm:w-32"
          />
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {githubDisplayName ? (
            githubDisplayName
          ) : (
            <a
              href={`https://github.com/${owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              @{owner}
            </a>
          )}
        </h1>
        {githubDisplayName && (
          <a
            href={`https://github.com/${owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-neutral-500 text-sm font-medium uppercase tracking-widest hover:text-neutral-300 transition-colors"
          >
            @{owner}
          </a>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
          <ErrorBoundary level="widget">
            <ShareButtons
              label={owner}
              type="user"
              botPercentage={userSummary?.aiPercentage ?? "0"}
              humanPercentage={userSummary?.humanPercentage ?? "0"}
              automationPercentage={userSummary?.automationPercentage ?? "0"}
              includesPrivateData={hasPrivateData}
              isOwnProfile={isOwnProfile}
              isSyncing={isSyncInProgress}
            />
          </ErrorBoundary>
        </div>
      </div>

      {/* Public Preview Banner — shown when ?view=public is active */}
      {isPublicPreview && (
        <div className="mx-auto mt-6 max-w-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-800/50 bg-blue-950/30 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Eye className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-200">Viewing as a visitor</span>
            </div>
            <button
              type="button"
              onClick={() => setViewMode("owner")}
              className="rounded-lg border border-blue-700/50 px-3 py-1 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-900/40 hover:text-white"
            >
              Back to my view
            </button>
          </div>
        </div>
      )}

      {/* Private Repo Card — shown to authenticated users viewing their own profile */}
      {isOwnProfile && (
        <div className="mx-auto mt-8 max-w-xl">
          <PrivateRepoCard
            hasPrivateData={hasPrivateData}
            syncStatus={privateSyncStatus?.syncStatus}
            syncError={privateSyncStatus?.syncError}
            lastSyncedAt={privateSyncStatus?.lastSyncedAt}
            showPrivateDataPublicly={cachedProfile?.showPrivateDataPublicly}
            onToggleVisibility={async (show) => {
              await updatePrivateVisibility({ showPrivateDataPublicly: show });
            }}
            onResync={async () => {
              await requestPrivateSync();
            }}
            totalRepos={privateSyncStatus?.totalRepos}
            processedRepos={privateSyncStatus?.processedRepos}
            totalCommitsFound={privateSyncStatus?.totalCommitsFound}
            privateCommitCount={privateCommitCount}
          />
        </div>
      )}

      {/* Sign-in CTA — shown to non-authenticated visitors on any profile */}
      {!session?.user && !isSessionPending && (
        <div className="mx-auto mt-8 max-w-xl">
          <Link
            href="/login"
            className="group flex items-center gap-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/20 p-5 transition-colors hover:border-neutral-500 hover:bg-neutral-900/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
              <Lock className="h-5 w-5 text-neutral-400 transition-colors group-hover:text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white">
                Sign in to analyze your private repos
              </span>
              <p className="mt-0.5 text-xs text-neutral-500">
                Add private repo activity to your heatmap. We only store aggregate counts — no code
                or repo names.
              </p>
            </div>
          </Link>
        </div>
      )}

      {resyncError && (
        <div className="mx-auto mt-8 max-w-md rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {resyncError}
          {githubRepos.length === 0 && " GitHub data couldn't be loaded. Try refreshing the page."}
        </div>
      )}

      {/* Sync Progress Status Pill */}
      {isSyncInProgress && (
        <div className="mt-12 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400/80">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>
              {isAnySyncing
                ? `Synced ${syncedCount}/${totalRepoCount} repos`
                : "Initializing analysis"}
            </span>
            {currentlySyncing && (
              <span className="font-medium text-purple-400/50">
                — {currentlySyncing.name}:{" "}
                {getSyncStageLabel(currentlySyncing.syncStage, currentlySyncing.syncCommitsFetched)}
              </span>
            )}
          </div>
          <div className="text-sm italic text-neutral-500 transition-opacity duration-500">
            {funMessage}
          </div>

          {showNotificationPrompt && !wantsNotification && (
            <button
              type="button"
              onClick={() => setIsNotificationModalOpen(true)}
              className="mt-4 flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-all hover:bg-neutral-800 hover:text-white"
            >
              <Bell className="h-3 w-3 animate-bell-ring" />
              Taking a while? Notify me when done
            </button>
          )}

          {wantsNotification && (
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-green-500/80">
              <Bell className="h-3 w-3 animate-pulse" />
              We&apos;ll notify you once finished
            </div>
          )}
        </div>
      )}

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onConfirm={() => setWantsNotification(true)}
      />

      {/* Main Insights Card */}
      <div
        id="user-insights"
        className={`${isSyncInProgress ? "mt-6" : "mt-12"} relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/20 p-6 sm:p-10`}
      >
        {/* Core Stats */}
        {userSummary ? (
          <div className="space-y-12">
            <ErrorBoundary level="section">
              <StatsSummary
                totalCommits={userSummary.totals.total}
                botPercentage={userSummary.aiPercentage}
                humanPercentage={userSummary.humanPercentage}
                automationPercentage={userSummary.automationPercentage}
                trend={userSummary.trend}
                repoCount={syncedCount}
                locBotPercentage={userSummary.locBotPercentage}
                locHumanPercentage={userSummary.locHumanPercentage}
                locAutomationPercentage={userSummary.locAutomationPercentage}
                totalAdditions={userSummary.locTotals?.totalAdditions}
                hasLocData={userSummary.hasLocData}
                showZeroAiWhyCta={true}
                privateCommitCount={privateCommitCount}
              />
            </ErrorBoundary>

            {/* Heatmap */}
            <div className="space-y-6">
              <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">
                      {showPrivateToViewer ? "Activity Timeline" : "Public Activity Timeline"}
                    </h2>
                    {showPrivateToViewer && <PrivateDataBadge />}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {showPrivateToViewer
                      ? "Public + private repos. Only aggregate counts are stored — no private code or repo names."
                      : "Your top 20 public repos by stars. Commits by default, UTC."}
                  </p>
                </div>
                {userSummary?.hasLocData && (
                  <div className="inline-flex self-start rounded-lg border border-neutral-800 bg-black p-1">
                    <button
                      type="button"
                      onClick={() => setChartMode("commits")}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        chartMode === "commits" ? "bg-white text-black" : "text-neutral-500"
                      }`}
                    >
                      Commits
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMode("loc")}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        chartMode === "loc" ? "bg-white text-black" : "text-neutral-500"
                      }`}
                    >
                      Code Volume
                    </button>
                  </div>
                )}
              </div>
              <ErrorBoundary level="widget">
                <div className="rounded-xl border border-neutral-800/50 bg-black/20 p-4">
                  <ContributionHeatmap
                    data={dailyData}
                    viewMode={userSummary?.hasLocData ? chartMode : "commits"}
                    isSyncing={isSyncInProgress}
                    includesPrivateData={privateDailyStats != null && privateDailyStats.length > 0}
                  />
                </div>
              </ErrorBoundary>
            </div>

            {/* AI Tool Breakdown — uses merged public + private data */}
            {mergedBreakdown && mergedBreakdown.toolBreakdown.length > 0 && (
              <ErrorBoundary level="section">
                <AIToolBreakdown
                  toolBreakdown={mergedBreakdown.toolBreakdown}
                  viewMode={userSummary.hasLocData ? chartMode : "commits"}
                />
              </ErrorBoundary>
            )}

            {/* Automation Bot Breakdown — uses merged public + private data */}
            {mergedBreakdown && mergedBreakdown.botBreakdown.length > 0 && (
              <ErrorBoundary level="section">
                <BotToolBreakdown botBreakdown={mergedBreakdown.botBreakdown} />
              </ErrorBoundary>
            )}
          </div>
        ) : isSyncInProgress || isDataLoading ? (
          <div className="space-y-12">
            {/* Stats cards skeleton */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl border border-neutral-800 bg-neutral-900/40"
                />
              ))}
            </div>
            {/* Heatmap skeleton */}
            <div className="space-y-6">
              <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="h-6 w-40 animate-pulse rounded bg-neutral-800" />
                  <div className="mt-2 h-3 w-64 animate-pulse rounded bg-neutral-800 opacity-50" />
                </div>
              </div>
              <div className="h-[400px] w-full animate-pulse rounded-xl border border-neutral-800/50 bg-black/20" />
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-neutral-500 font-medium">
            No analysis data available.
          </div>
        )}
      </div>

      {/* Source Repositories */}
      {hasRepos && (
        <div className="mt-20">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-xl font-bold text-white whitespace-nowrap">
                Source Repositories
              </h2>
              <div className="h-px w-full bg-neutral-800 hidden sm:block" />
            </div>

            <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1">
              <button
                type="button"
                onClick={() => setSortMode("latest")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  sortMode === "latest" ? "bg-white text-black" : "text-neutral-500"
                }`}
              >
                Latest
              </button>
              <button
                type="button"
                onClick={() => setSortMode("stars")}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  sortMode === "stars" ? "bg-white text-black" : "text-neutral-500"
                }`}
              >
                Stars
              </button>
            </div>
          </div>

          <ErrorBoundary level="section">
            <div className="space-y-10">
              {repoGroups.map((group) => (
                <div key={group.label}>
                  <div className="mb-4 flex items-center gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">
                      {group.label}
                    </h3>
                    <span className="text-xs text-neutral-600">{group.repos.length}</span>
                    <div className="h-px flex-1 bg-neutral-800/50" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.repos.map((ghRepo) => {
                      const convexRepo = convexRepos?.find(
                        (r) => r.fullName === `${owner}/${ghRepo.name}`
                      );
                      const syncStatus = convexRepo?.repo?.syncStatus;
                      const repoPercentages = convexRepo?.repo?._id
                        ? repoPercentagesById.get(convexRepo.repo._id)
                        : undefined;
                      const repoHref = `/${encodeURIComponent(owner)}/${encodeURIComponent(
                        ghRepo.name
                      )}`;

                      return (
                        <Link
                          key={ghRepo.id}
                          href={repoHref}
                          className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 transition-all hover:border-neutral-700 hover:bg-neutral-900"
                        >
                          <div>
                            <div className="flex min-h-[20px] items-center justify-between gap-4">
                              <div className="truncate font-bold text-neutral-200 group-hover:text-white">
                                {ghRepo.name}
                              </div>
                              <SyncBadge
                                status={syncStatus}
                                syncStage={convexRepo?.repo?.syncStage as string | undefined}
                                syncCommitsFetched={
                                  convexRepo?.repo?.syncCommitsFetched as number | undefined
                                }
                              />
                            </div>
                            {ghRepo.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                                {ghRepo.description}
                              </p>
                            )}
                            <div className="mt-3 min-h-[22px]">
                              {repoPercentages && (
                                <HumanAiBadges
                                  humanPercentage={repoPercentages.humanPercentage}
                                  aiPercentage={repoPercentages.aiPercentage}
                                  automationPercentage={repoPercentages.automationPercentage}
                                  automationTools={repoPercentages.automationTools}
                                />
                              )}
                            </div>
                          </div>

                          <div className="mt-4 flex h-4 items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                            {ghRepo.stargazers_count > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {ghRepo.stargazers_count.toLocaleString()}
                              </span>
                            )}
                            {ghRepo.language && <span>{ghRepo.language}</span>}
                            {convexRepo?.repo?.totalCommitsFetched != null && (
                              <span>
                                {convexRepo.repo.totalCommitsFetched.toLocaleString()} commits
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ErrorBoundary>
        </div>
      )}

      {/* Related Recent Generations */}
      {relatedUsers && relatedUsers.length > 0 && (
        <div className="mt-24 pt-12 border-t border-neutral-800/50">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold tracking-tight text-white">Recent Generations</h2>
              <div className="h-px w-24 bg-neutral-800 hidden sm:block" />
              <p className="text-xs text-neutral-500 font-medium">
                Other users analyzed around the same time
              </p>
            </div>
          </div>

          <ErrorBoundary level="section">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedUsers.map((user) => (
                <UserCard
                  key={user.owner}
                  owner={user.owner}
                  avatarUrl={user.profile?.avatarUrl ?? user.avatarUrl}
                  displayName={user.profile?.name ?? undefined}
                  followers={user.profile?.followers}
                  humanPercentage={user.humanPercentage}
                  botPercentage={user.botPercentage}
                  automationPercentage={user.automationPercentage}
                  totalCommits={user.totalCommits}
                  repoCount={user.repoCount}
                  lastIndexedAt={user.lastIndexedAt}
                  isSyncing={user.isSyncing}
                  hasPrivateData={user.hasPrivateData}
                />
              ))}
            </div>
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

function SyncBadge({
  status,
  syncStage,
  syncCommitsFetched,
}: {
  status?: string;
  syncStage?: string;
  syncCommitsFetched?: number;
}) {
  if (!status || status === "pending") {
    return (
      <span className="flex items-center gap-1 text-xs text-neutral-400">
        <Clock className="h-3 w-3" />
        Queued
      </span>
    );
  }
  if (status === "syncing") {
    return (
      <span className="flex items-center gap-1 text-xs text-purple-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        {getSyncBadgeLabel(syncStage, syncCommitsFetched)}
      </span>
    );
  }
  if (status === "synced") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Synced
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-red-500">
        <XCircle className="h-3 w-3" />
        Error
      </span>
    );
  }
  return null;
}
