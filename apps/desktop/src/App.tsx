import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ContributionHeatmap, type DailyDataPoint } from "./components/ContributionHeatmap";
import { SummaryStats } from "./components/SummaryStats";
import {
  clearSavedDesktopToken,
  type DailyMetricRow,
  type DeviceStartResponse,
  getDefaultBaseUrl,
  getLocalCursorStats,
  getSavedDesktopToken,
  getSourceVisibility,
  getUserStats,
  openUrl,
  pollDeviceLink,
  setSourceVisibility,
  startDeviceLink,
  syncNow,
  type UserStats,
} from "./lib/tauri";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-500">Something went wrong</h1>
          <p className="mb-6 text-neutral-400">The application encountered a rendering error.</p>
          <pre className="mb-8 overflow-auto rounded-lg bg-neutral-900 p-4 text-left text-xs text-red-400 max-w-full">
            {this.state.error?.message}
            {"\n"}
            {this.state.error?.stack}
          </pre>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            Reload App
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

const FALLBACK_URL = "https://aivshuman.dev";
const LOCAL_LINE_MODE_OPTIONS = [
  { value: "cursor", label: "Cursor" },
  { value: "combined", label: "Combined" },
  { value: "tab", label: "Tab" },
] as const;

type LocalLineMode = (typeof LOCAL_LINE_MODE_OPTIONS)[number]["value"];

function dateToUtcEpochMs(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function LocalLineModeToggle({
  mode,
  onChange,
}: {
  mode: LocalLineMode;
  onChange: (mode: LocalLineMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900 p-1">
      {LOCAL_LINE_MODE_OPTIONS.map((option) => {
        const isActive = mode === option.value;
        return (
          <button
            type="button"
            key={option.value}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "bg-neutral-200 text-neutral-900"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            }`}
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [baseUrl, setBaseUrl] = useState(FALLBACK_URL);
  const [hasToken, setHasToken] = useState(false);
  const [deviceFlow, setDeviceFlow] = useState<DeviceStartResponse | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [showSourceStatsPublicly, setShowSourceStatsPublicly] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [localRows, setLocalRows] = useState<DailyMetricRow[]>([]);
  const [localLineMode, setLocalLineMode] = useState<LocalLineMode>("cursor");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const pollTimer = useRef<number | null>(null);

  const fetchUserStats = useCallback(async (url: string) => {
    setIsStatsLoading(true);
    try {
      const stats = await getUserStats(url);
      setUserStats(stats);
    } catch (err) {
      console.error("Failed to fetch user stats:", err);
      setError(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Failed to load profile stats."
      );
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  const fetchLocalStats = useCallback(async () => {
    try {
      const rows = await getLocalCursorStats();
      setLocalRows(rows);
    } catch (err) {
      console.error("Failed to fetch local stats:", err);
    }
  }, []);

  const localData = useMemo<DailyDataPoint[]>(() => {
    return localRows.map((row) => {
      const tabAcceptedLines = row.metrics.tabAcceptedLines ?? 0;
      const composerAcceptedLines = row.metrics.composerAcceptedLines ?? 0;
      const acceptedLines = row.metrics.acceptedLines ?? tabAcceptedLines + composerAcceptedLines;

      const linesEdited =
        localLineMode === "tab"
          ? tabAcceptedLines
          : localLineMode === "cursor"
            ? composerAcceptedLines
            : acceptedLines;

      return {
        date: dateToUtcEpochMs(row.date),
        human: 0,
        ai: 0,
        humanAdditions: 0,
        aiAdditions: 0,
        linesEdited,
        aiLineEdits: linesEdited,
        tabAcceptedLines,
        composerAcceptedLines,
      };
    });
  }, [localRows, localLineMode]);

  const localStats = useMemo(() => {
    if (localData.length === 0) return null;

    const totalLinesEdited = localData.reduce((acc, p) => acc + (p.linesEdited || 0), 0);
    const totalAiLineEdits = localData.reduce((acc, p) => acc + (p.aiLineEdits || 0), 0);

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const yesterdayMs = todayMs - 86400000;

    // Calculate streaks
    const activeDates = new Set(
      localData.filter((p) => (p.linesEdited || 0) > 0).map((p) => p.date)
    );

    // Current Streak
    let checkDate = activeDates.has(todayMs) ? todayMs : yesterdayMs;
    while (activeDates.has(checkDate)) {
      currentStreak++;
      checkDate -= 86400000;
    }

    // Longest Streak
    const sortedDates = Array.from(activeDates).sort((a, b) => a - b);
    if (sortedDates.length > 0) {
      tempStreak = 1;
      longestStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        if (sortedDates[i] === sortedDates[i - 1] + 86400000) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    return {
      totalLinesEdited,
      totalAiLineEdits,
      currentStreak,
      longestStreak,
      activeDays: activeDates.size,
    };
  }, [localData]);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      // Fetch local data regardless of connection status
      void fetchLocalStats();

      try {
        const [url, token] = await Promise.all([getDefaultBaseUrl(), getSavedDesktopToken()]);
        const resolvedUrl = url || FALLBACK_URL;
        setBaseUrl(resolvedUrl);
        const connected = !!token;
        setHasToken(connected);
        if (connected) {
          // Fetch stats and visibility in parallel, but don't let one failure block the other
          void fetchUserStats(resolvedUrl.trim());
          try {
            const visibility = await getSourceVisibility(resolvedUrl.trim());
            setShowSourceStatsPublicly(visibility);
          } catch (vErr) {
            console.error("Failed to fetch visibility:", vErr);
            setShowSourceStatsPublicly(false);
          }
        }
      } catch {
        setBaseUrl(FALLBACK_URL);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [fetchUserStats, fetchLocalStats]);

  useEffect(() => {
    return () => {
      if (pollTimer.current != null) {
        window.clearInterval(pollTimer.current);
      }
    };
  }, []);

  const canSync = useMemo(
    () => hasToken && !isSyncing && !isConnecting,
    [hasToken, isSyncing, isConnecting]
  );

  const canEditSourceVisibility = useMemo(
    () => hasToken && !isSyncing && !isConnecting && !isSavingVisibility,
    [hasToken, isConnecting, isSavingVisibility, isSyncing]
  );

  const handleOpenUrl = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      setError("Failed to open browser. Please use the link below.");
    }
  };

  async function beginConnect() {
    setError("");
    setMessage("");
    setIsConnecting(true);
    try {
      const flow = await startDeviceLink(baseUrl.trim());
      setDeviceFlow(flow);

      // Explicitly open using our Rust command which is more robust
      void handleOpenUrl(flow.verificationUrl);

      setMessage(
        "Complete authorization in your browser, then this app will connect automatically."
      );

      if (pollTimer.current != null) window.clearInterval(pollTimer.current);
      pollTimer.current = window.setInterval(async () => {
        try {
          const poll = await pollDeviceLink(baseUrl.trim(), flow.deviceCode);
          if (poll.status === "approved") {
            if (pollTimer.current != null) window.clearInterval(pollTimer.current);
            pollTimer.current = null;
            setHasToken(true);
            setDeviceFlow(null);
            setIsConnecting(false);

            // Fetch stats and visibility in parallel
            void fetchUserStats(baseUrl.trim());
            try {
              const visibility = await getSourceVisibility(baseUrl.trim());
              setShowSourceStatsPublicly(visibility);
            } catch {
              setShowSourceStatsPublicly(false);
            }
            setMessage("Desktop connected successfully.");
          } else if (poll.status === "expired") {
            if (pollTimer.current != null) window.clearInterval(pollTimer.current);
            pollTimer.current = null;
            setDeviceFlow(null);
            setIsConnecting(false);
            setError("Device link expired. Start a new connect flow.");
          }
        } catch (pollError) {
          if (pollTimer.current != null) window.clearInterval(pollTimer.current);
          pollTimer.current = null;
          setIsConnecting(false);
          setError(
            pollError instanceof Error
              ? pollError.message
              : typeof pollError === "string"
                ? pollError
                : "Polling failed."
          );
        }
      }, Math.max(flow.pollIntervalSec, 2) * 1000);
    } catch (connectError) {
      setError(
        connectError instanceof Error ? connectError.message : "Failed to start connect flow."
      );
      setIsConnecting(false);
    }
  }

  async function runSync() {
    setError("");
    setMessage("");
    setIsSyncing(true);
    try {
      const result = await syncNow(baseUrl.trim());
      setMessage(
        `Uploaded ${(result?.rowCount || 0).toLocaleString()} daily rows for source '${result?.sourceId || "unknown"}'.`
      );
      // Refresh both remote and local stats after sync
      void fetchUserStats(baseUrl.trim());
      void fetchLocalStats();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function disconnect() {
    setError("");
    setMessage("");
    try {
      await clearSavedDesktopToken();
      setHasToken(false);
      setShowSourceStatsPublicly(false);
      setUserStats(null);
      setMessage("Desktop token cleared.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error ? disconnectError.message : "Failed to clear token."
      );
    }
  }

  async function updateSourceVisibility(checked: boolean) {
    setError("");
    setMessage("");
    setIsSavingVisibility(true);
    try {
      const updated = await setSourceVisibility(baseUrl.trim(), checked);
      setShowSourceStatsPublicly(updated);
      setMessage(
        updated
          ? "Cursor overlay is now public on your web profile."
          : "Cursor overlay is now private to you."
      );
    } catch (visibilityError) {
      setError(
        visibilityError instanceof Error ? visibilityError.message : "Failed to update visibility."
      );
    } finally {
      setIsSavingVisibility(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center text-center">
        <p className="animate-pulse text-neutral-400">Loading AI vs Human...</p>
      </main>
    );
  }

  if (!hasToken) {
    return (
      <main className="mx-auto flex max-w-lg min-h-[90vh] flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          AI vs Human
        </h1>
        <p className="mb-8 text-lg leading-relaxed text-neutral-400">
          Connect your GitHub account to sync your Cursor daily stats and see your human vs. AI
          contribution balance.
        </p>

        <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/30 p-8 shadow-xl mb-12">
          <button
            type="button"
            className="primary-button w-full"
            onClick={beginConnect}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect with GitHub"}
          </button>

          {deviceFlow && (
            <div className="mt-6 border-t border-neutral-800 pt-6 text-left">
              <p className="text-sm text-neutral-400">
                If your browser did not open, please click:
                <br />
                <button
                  type="button"
                  className="mt-2 text-blue-400 underline hover:text-blue-300 transition-colors"
                  onClick={() => handleOpenUrl(deviceFlow.verificationUrl)}
                >
                  Authorize in Browser
                </button>
              </p>
            </div>
          )}

          {message && <p className="mt-4 text-sm text-green-400 font-medium">{message}</p>}
          {error && <p className="mt-4 text-sm text-red-400 font-medium">{error}</p>}
        </div>

        {localData.length > 0 && (
          <div className="w-full text-left">
            <div className="mb-4 flex items-center justify-between gap-3 px-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Detected Local Activity (Cursor)
              </h2>
              <LocalLineModeToggle mode={localLineMode} onChange={setLocalLineMode} />
            </div>
            <ContributionHeatmap
              data={localData}
              viewMode="linesEdited"
              lineEditMode={localLineMode}
            />
            <p className="mt-2 px-2 text-xs text-neutral-500">
              Cursor matches Cursor heatmap. Combined includes Cursor + Tab accepts.
            </p>
            <p className="mt-4 text-center text-sm text-neutral-500">
              Connect to see how this local activity balances with your overall GitHub history.
            </p>
          </div>
        )}

        <p className="mt-12 max-w-xs text-sm leading-relaxed text-neutral-500">
          This app securely links your local Cursor database to your aivshuman.dev profile.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">AI vs Human</h1>
        <button
          type="button"
          className="secondary-button px-4 py-2 text-xs"
          onClick={disconnect}
          disabled={isSyncing}
        >
          Disconnect
        </button>
      </header>

      <section className="mb-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-6 px-2">
          Aggregated Profile Activity
        </h2>
        {isStatsLoading ? (
          <div className="card text-center py-12">
            <p className="animate-pulse text-neutral-500">Loading profile data...</p>
          </div>
        ) : userStats ? (
          <>
            <SummaryStats
              totalCommits={userStats.totalCommits}
              aiPercentage={userStats.aiPercentage}
              humanPercentage={userStats.humanPercentage}
              automationPercentage={userStats.automationPercentage}
            />
            {userStats?.dailyData && (
              <div className="mt-6">
                <ContributionHeatmap
                  data={userStats.dailyData}
                  viewMode="commits"
                  isSyncing={isSyncing}
                />
              </div>
            )}
          </>
        ) : (
          <div className="card text-center py-12">
            <p className="text-neutral-500">
              No profile data found. Sync your stats to get started.
            </p>
          </div>
        )}
      </section>

      {localData.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between gap-3 px-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Local Cursor Activity (Lines Edited)
            </h2>
            <LocalLineModeToggle mode={localLineMode} onChange={setLocalLineMode} />
          </div>
          {localStats && (
            <div className="mb-6">
              <SummaryStats
                variant="cursor"
                totalCommits={localStats.activeDays}
                aiPercentage="0"
                humanPercentage="0"
                automationPercentage="0"
                currentStreak={localStats.currentStreak}
                longestStreak={localStats.longestStreak}
                totalLinesEdited={localStats.totalLinesEdited}
                aiLineEdits={localStats.totalAiLineEdits}
              />
            </div>
          )}
          <ContributionHeatmap
            data={localData}
            viewMode="linesEdited"
            lineEditMode={localLineMode}
            isSyncing={isSyncing}
          />
          <p className="mt-2 px-2 text-xs text-neutral-500">
            Cursor matches Cursor heatmap. Combined includes Cursor + Tab accepts.
          </p>
        </section>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Sync Status
            </h2>
            <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
              Connected
            </span>
          </div>

          <div className="mt-6">
            <button
              type="button"
              className="primary-button w-full"
              onClick={runSync}
              disabled={!canSync}
            >
              {isSyncing ? "Syncing..." : "Sync Daily Stats"}
            </button>
          </div>

          {message && <p className="mt-4 text-sm text-green-400 font-medium">{message}</p>}
          {error && <p className="mt-4 text-sm text-red-400 font-medium">{error}</p>}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Profile Visibility
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Control whether visitors can see your Cursor overlay in Code Volume view.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <input
              id="visibility-toggle"
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-800 bg-neutral-950 text-blue-600 focus:ring-blue-500 focus:ring-offset-neutral-900"
              checked={showSourceStatsPublicly}
              disabled={!canEditSourceVisibility}
              onChange={(event) => void updateSourceVisibility(event.target.checked)}
            />
            <label htmlFor="visibility-toggle" className="cursor-pointer text-sm text-neutral-300">
              Show Cursor overlay publicly
            </label>
          </div>
        </section>
      </div>
    </main>
  );
}
