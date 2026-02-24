/**
 * Shared utility for translating sync pipeline stages into user-facing labels.
 *
 * The sync pipeline has 4 stages:
 *   fetching_commits → enriching_loc → classifying_prs → computing_stats
 *
 * Two label variants:
 *   - getSyncStageLabel:  Full sentence for progress overlays / repo detail pages
 *   - getSyncBadgeLabel:  Short label for compact badges in repo cards
 */

/** Full-length label for progress overlays and repo detail sync indicators */
export function getSyncStageLabel(stage?: string, commitsFetched?: number): string {
  switch (stage) {
    case "fetching_commits":
      return commitsFetched
        ? `${commitsFetched.toLocaleString()} commits fetched`
        : "Fetching commits...";
    case "enriching_loc":
      return "Enriching LOC data...";
    case "classifying_prs":
      return "Classifying PRs...";
    case "computing_stats":
      return "Computing stats...";
    default:
      return "Syncing...";
  }
}

/** Compact label for SyncBadge in repo cards */
export function getSyncBadgeLabel(stage?: string, commitsFetched?: number): string {
  switch (stage) {
    case "fetching_commits":
      return commitsFetched ? `${commitsFetched.toLocaleString()} commits` : "Fetching...";
    case "enriching_loc":
      return "LOC...";
    case "classifying_prs":
      return "PRs...";
    case "computing_stats":
      return "Stats...";
    default:
      return "Syncing";
  }
}
