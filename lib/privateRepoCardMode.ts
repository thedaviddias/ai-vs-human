export type PrivateRepoCardMode = "not_linked" | "syncing" | "linked_compact" | "linked_expanded";

interface ResolvePrivateRepoCardModeInput {
  hasPrivateData: boolean;
  syncStatus?: string;
  syncError?: string;
}

/**
 * Resolves which UI mode the private repo card should render in.
 *
 * Priority:
 * 1) syncing always wins (active work in progress)
 * 2) not linked (no private aggregate data)
 * 3) linked + error (expanded to expose recovery actions)
 * 4) linked steady state (compact)
 */
export function resolvePrivateRepoCardMode({
  hasPrivateData,
  syncStatus,
  syncError,
}: ResolvePrivateRepoCardModeInput): PrivateRepoCardMode {
  if (syncStatus === "syncing") return "syncing";

  if (!hasPrivateData) return "not_linked";

  if (syncStatus === "error" || (syncError != null && syncError.trim().length > 0)) {
    return "linked_expanded";
  }

  return "linked_compact";
}
