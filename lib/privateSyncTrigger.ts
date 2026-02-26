/**
 * Determines whether private repo sync should auto-trigger.
 *
 * The decision tree:
 *
 *   Not own profile?          → no
 *   Not authenticated?        → no
 *   Status undefined?         → no  (query still loading, wait)
 *   Status null?              → YES (user has never attempted private sync)
 *   Already syncing?          → no  (don't interrupt)
 *   Already has data?         → no  (nothing to do)
 *   Status "idle"?            → no  (user explicitly unlinked — respect their choice)
 *   Status "error"?           → no  (let user manually retry)
 *
 * The key insight: `null` means "no record exists" (never attempted),
 * while `{ syncStatus: "idle" }` means "record exists because user
 * explicitly unlinked." We only auto-trigger for the first case.
 *
 * This runs on the client in `UserDashboardContent` to seamlessly
 * start private sync after the user signs in — they already consented
 * to the `repo` scope during OAuth, so no extra confirmation is needed.
 */

interface PrivateSyncStatusInput {
  syncStatus: "idle" | "syncing" | "synced" | "error";
  includesPrivateData: boolean;
}

interface AutoTriggerInput {
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  /** null = never attempted, undefined = query still loading */
  privateSyncStatus: PrivateSyncStatusInput | null | undefined;
}

export function shouldAutoTriggerPrivateSync({
  isOwnProfile,
  isAuthenticated,
  privateSyncStatus,
}: AutoTriggerInput): boolean {
  // Gate: must be own profile and authenticated
  if (!isOwnProfile || !isAuthenticated) return false;

  // Query still loading — don't decide yet
  if (privateSyncStatus === undefined) return false;

  // Never attempted private sync → auto-trigger!
  // (null means no userPrivateSyncStatus record exists in the DB)
  if (privateSyncStatus === null) return true;

  // Any existing record means the user has interacted with private sync
  // before (either completed, errored, or explicitly unlinked).
  // In all these cases, let the user decide via the PrivateRepoCard UI.
  return false;
}
