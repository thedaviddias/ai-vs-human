"use client";

import { useMutation } from "convex/react";
import { ChevronDown, EyeOff, Link2, Loader2, Lock, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { api } from "@/convex/_generated/api";
import { resolvePrivateRepoCardMode } from "@/lib/privateRepoCardMode";
import { trackEvent } from "@/lib/tracking";

/** Fun messages shown while the private sync is running. */
const PRIVATE_SYNC_MESSAGES = [
  "Scanning your private repos...",
  "Counting commits behind closed doors...",
  "Your secrets are safe with us...",
  "Classifying human vs AI in private...",
  "Peeking behind the curtain (securely)...",
  "Crunching numbers, no repo names stored...",
  "Only aggregate stats, pinky promise...",
  "Analyzing commit patterns in the shadows...",
  "Private activity is just as interesting...",
  "Working through your hidden gems...",
  "Your private repos tell a great story too...",
  "Almost there, just tallying the numbers...",
];

interface PrivateRepoCardProps {
  /** Whether private data has already been synced */
  hasPrivateData: boolean;
  /** Current sync status (idle, syncing, synced, error) */
  syncStatus?: string;
  /** Error message from last sync attempt */
  syncError?: string;
  /** Epoch ms of last successful sync */
  lastSyncedAt?: number;
  /** Whether private data is shown publicly to visitors (undefined = true) */
  showPrivateDataPublicly?: boolean;
  /** Called when user toggles public visibility */
  onToggleVisibility?: (show: boolean) => void;
  /** Called when user requests incremental sync */
  onResync?: () => Promise<void>;
  /** Called when user requests a full rebuild */
  onFullRebuild?: () => Promise<void>;
  /** Total number of private repos found */
  totalRepos?: number;
  /** Number of repos processed so far */
  processedRepos?: number;
  /** Total commits classified so far */
  totalCommitsFound?: number;
  /** Total private commits (from completed sync) */
  privateCommitCount?: number;
}

/**
 * Formats a timestamp into a human-readable relative time string.
 * Intentionally simple — avoids adding date-fns as a dependency.
 */
function formatRelativeTime(epochMs: number): string {
  const seconds = Math.floor((Date.now() - epochMs) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Cycles through fun messages while syncing — gives visual proof the UI isn't stuck. */
function useSyncMessage(isActive: boolean) {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * PRIVATE_SYNC_MESSAGES.length)
  );

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % PRIVATE_SYNC_MESSAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isActive]);

  return PRIVATE_SYNC_MESSAGES[index];
}

/**
 * Card shown to authenticated users viewing their OWN profile.
 * Allows linking/unlinking private repo aggregate data,
 * toggling public visibility, and re-syncing.
 *
 * Four modes:
 * 1. not_linked — CTA to start private sync
 * 2. syncing — animated progress with counters
 * 3. linked_compact — compact linked row + Manage entrypoint
 * 4. linked_expanded — linked row auto-opens Manage on sync errors
 */
export function PrivateRepoCard({
  hasPrivateData,
  syncStatus,
  syncError,
  lastSyncedAt,
  showPrivateDataPublicly,
  onToggleVisibility,
  onResync,
  onFullRebuild,
  totalRepos,
  processedRepos,
  totalCommitsFound,
  privateCommitCount,
}: PrivateRepoCardProps) {
  const requestSync = useMutation(api.mutations.requestPrivateSync.requestPrivateSync);
  const unlinkData = useMutation(api.mutations.unlinkPrivateData.unlinkPrivateData);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isFullRebuilding, setIsFullRebuilding] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [showFullRebuildConfirm, setShowFullRebuildConfirm] = useState(false);
  const [isManagePanelOpen, setIsManagePanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = resolvePrivateRepoCardMode({ hasPrivateData, syncStatus, syncError });
  const isSyncing = mode === "syncing";
  const funMessage = useSyncMessage(isSyncing);
  const managePanelId = useId();

  useEffect(() => {
    if (mode === "linked_expanded") {
      setIsManagePanelOpen(true);
      return;
    }

    if (mode !== "linked_compact") {
      setIsManagePanelOpen(false);
    }
  }, [mode]);

  const handleLink = async () => {
    trackEvent("private_link", {});
    setIsRequesting(true);
    setError(null);
    try {
      await requestSync({ mode: "incremental" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start sync");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleUnlinkConfirm = async () => {
    trackEvent("private_unlink", {});
    setShowUnlinkConfirm(false);
    setIsUnlinking(true);
    setError(null);
    try {
      await unlinkData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink data");
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleResync = async () => {
    trackEvent("private_resync", {});
    setIsResyncing(true);
    setError(null);
    try {
      if (onResync) {
        await onResync();
      } else {
        await requestSync({ mode: "incremental" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start re-sync");
    } finally {
      setIsResyncing(false);
    }
  };

  const handleFullRebuildConfirm = async () => {
    setShowFullRebuildConfirm(false);
    setIsFullRebuilding(true);
    setError(null);
    try {
      if (onFullRebuild) {
        await onFullRebuild();
      } else {
        await requestSync({ mode: "full" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start full rebuild");
    } finally {
      setIsFullRebuilding(false);
    }
  };

  const handleVisibilityToggle = (show: boolean) => {
    trackEvent("private_visibility_toggle", { show });
    onToggleVisibility?.(show);
  };

  // ─── State: Syncing — animated progress display ───────────────────
  if (mode === "syncing") {
    const progressPercent =
      totalRepos && processedRepos ? Math.round((processedRepos / totalRepos) * 100) : 0;

    return (
      <div className="rounded-xl border border-blue-800/50 bg-blue-950/20 p-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-semibold text-white">Syncing Private Activity</span>
            {totalRepos != null && processedRepos != null ? (
              <p className="mt-0.5 text-xs text-blue-300/80">
                Repo {processedRepos}/{totalRepos}
                {totalCommitsFound != null && totalCommitsFound > 0 && (
                  <span className="text-blue-400/60">
                    {" "}
                    &middot; {totalCommitsFound.toLocaleString()} commits classified
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-blue-300/60">Discovering private repos...</p>
            )}
          </div>
        </div>

        {totalRepos != null && totalRepos > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-900/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700 ease-out"
              style={{ width: `${Math.max(progressPercent, 3)}%` }}
            />
          </div>
        )}

        <p className="mt-3 text-xs italic text-neutral-500 transition-opacity duration-500">
          {funMessage}
        </p>
        {syncError && <p className="mt-2 text-xs text-red-400">{syncError}</p>}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // ─── States: Linked (compact + expanded) ──────────────────────────
  if (mode === "linked_compact" || mode === "linked_expanded") {
    const showManagePanel = isManagePanelOpen;
    const showLinkedError = mode === "linked_expanded";

    return (
      <div
        className={`rounded-xl p-4 ${
          showLinkedError
            ? "border border-amber-800/50 bg-amber-950/10"
            : "border border-neutral-800 bg-neutral-900/40"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Private Activity Linked</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {privateCommitCount != null && privateCommitCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-md bg-blue-900/30 px-2 py-1">
                  <Lock className="h-3 w-3 text-blue-400" />
                  <span className="text-xs font-medium text-blue-300">
                    {privateCommitCount.toLocaleString()} private commits
                  </span>
                </div>
              )}
              {lastSyncedAt && (
                <span className="text-xs text-neutral-500">
                  Synced {formatRelativeTime(lastSyncedAt)}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsManagePanelOpen((prev) => !prev)}
            aria-expanded={showManagePanel}
            aria-controls={managePanelId}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:border-blue-700 hover:text-blue-300"
          >
            Manage
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showManagePanel ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {showManagePanel && (
          <div id={managePanelId} className="mt-3 border-t border-neutral-800 pt-3">
            <p className="text-xs text-neutral-500">
              Your heatmap includes private repo commit stats. Only aggregate numbers are stored.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResync}
                disabled={isResyncing || isFullRebuilding}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:border-blue-700 hover:text-blue-400"
              >
                {isResyncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Sync latest
              </button>
              <button
                type="button"
                onClick={() => setShowFullRebuildConfirm(true)}
                disabled={isResyncing || isFullRebuilding}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:border-amber-700 hover:text-amber-400"
              >
                {isFullRebuilding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Full rebuild
              </button>
              <button
                type="button"
                onClick={() => setShowUnlinkConfirm(true)}
                disabled={isUnlinking || isResyncing || isFullRebuilding}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:border-red-700 hover:text-red-400"
              >
                {isUnlinking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Unlink
              </button>
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={showPrivateDataPublicly !== false}
                onChange={(e) => handleVisibilityToggle(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-blue-500/20"
              />
              <span className="text-xs text-neutral-400">Show private activity to visitors</span>
            </label>

            {syncError && <p className="mt-2 text-xs text-red-400">{syncError}</p>}
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <p className="mt-2 text-[11px] text-neutral-500">
              Sync latest uses an incremental window. Full rebuild reprocesses the full 2-year
              history.
            </p>
          </div>
        )}

        <ConfirmModal
          isOpen={showUnlinkConfirm}
          onClose={() => setShowUnlinkConfirm(false)}
          onConfirm={handleUnlinkConfirm}
          title="Unlink Private Data"
          description="This will permanently delete all your private repo aggregate stats. Your heatmap and stat cards will revert to showing only public repo data. This action cannot be undone."
          confirmLabel="Delete Private Data"
          cancelLabel="Keep My Data"
          destructive
          isLoading={isUnlinking}
        />
        <ConfirmModal
          isOpen={showFullRebuildConfirm}
          onClose={() => setShowFullRebuildConfirm(false)}
          onConfirm={handleFullRebuildConfirm}
          title="Full Rebuild Private Data"
          description="This reprocesses the full 2-year private history and may take significantly longer than Sync latest."
          confirmLabel="Start Full Rebuild"
          cancelLabel="Cancel"
          isLoading={isFullRebuilding}
        />
      </div>
    );
  }

  // ─── State: Not linked — CTA to start ─────────────────────────────
  return (
    <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/20 p-5">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-neutral-400" />
            <span className="text-sm font-semibold text-white">Enrich with Private Activity</span>
          </div>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-neutral-500">
            Add private repo commit activity to your heatmap. We only store aggregate counts — no
            repo names, code, or commit messages are ever saved.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLink}
          disabled={isRequesting}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50"
        >
          {isRequesting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            "Link Private Repos"
          )}
        </button>
      </div>
      {syncError && <p className="mt-3 text-xs text-red-400">{syncError}</p>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
