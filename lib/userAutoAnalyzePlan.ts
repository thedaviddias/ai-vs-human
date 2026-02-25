export interface AutoAnalyzeGitHubRepo {
  name: string;
  fullName: string;
  pushedAt?: number; // epoch ms from GitHub pushed_at
}

export interface AutoAnalyzeConvexRepo {
  fullName: string;
  repo: { syncStatus: string } | null | undefined;
}

export interface UserAutoAnalyzePlan {
  shouldTrigger: boolean;
  reposToAnalyze: Array<{ owner: string; name: string; pushedAt?: number }>;
  shouldKickPendingQueue: boolean;
  showBootstrapIndicator: boolean;
}

interface CreateUserAutoAnalyzePlanArgs {
  owner: string;
  githubRepos: AutoAnalyzeGitHubRepo[];
  convexRepos: AutoAnalyzeConvexRepo[];
}

export function createUserAutoAnalyzePlan({
  owner,
  githubRepos,
  convexRepos,
}: CreateUserAutoAnalyzePlanArgs): UserAutoAnalyzePlan {
  const convexByFullName = new Map(
    convexRepos.map((entry) => [entry.fullName, entry.repo ?? null])
  );

  const reposToAnalyze = githubRepos
    .filter((repo) => {
      const existing = convexByFullName.get(repo.fullName);
      return !existing || existing.syncStatus === "error";
    })
    .map((repo) => ({
      owner,
      name: repo.name,
      ...(repo.pushedAt !== undefined ? { pushedAt: repo.pushedAt } : {}),
    }));

  const hasPending = convexRepos.some((entry) => entry.repo?.syncStatus === "pending");
  const hasSyncing = convexRepos.some((entry) => entry.repo?.syncStatus === "syncing");
  const shouldKickPendingQueue = hasPending && !hasSyncing;

  return {
    shouldTrigger: reposToAnalyze.length > 0 || shouldKickPendingQueue,
    reposToAnalyze,
    shouldKickPendingQueue,
    showBootstrapIndicator: reposToAnalyze.length > 0,
  };
}
