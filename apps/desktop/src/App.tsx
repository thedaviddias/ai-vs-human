import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearSavedDesktopToken,
  type DeviceStartResponse,
  getDefaultBaseUrl,
  getSavedDesktopToken,
  getSourceVisibility,
  pollDeviceLink,
  setSourceVisibility,
  startDeviceLink,
  syncNow,
} from "./lib/tauri";

const FALLBACK_URL = "https://aivshuman.dev";

export function App() {
  const [baseUrl, setBaseUrl] = useState(FALLBACK_URL);
  const [hasToken, setHasToken] = useState(false);
  const [deviceFlow, setDeviceFlow] = useState<DeviceStartResponse | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [showSourceStatsPublicly, setShowSourceStatsPublicly] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [url, token] = await Promise.all([getDefaultBaseUrl(), getSavedDesktopToken()]);
        const resolvedUrl = url || FALLBACK_URL;
        setBaseUrl(resolvedUrl);
        const connected = !!token;
        setHasToken(connected);
        if (connected) {
          try {
            const visibility = await getSourceVisibility(resolvedUrl.trim());
            setShowSourceStatsPublicly(visibility);
          } catch {
            setShowSourceStatsPublicly(false);
          }
        }
      } catch {
        setBaseUrl(FALLBACK_URL);
      }
    })();
  }, []);

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

  async function beginConnect() {
    setError("");
    setMessage("");
    setIsConnecting(true);
    try {
      const flow = await startDeviceLink(baseUrl.trim());
      setDeviceFlow(flow);
      window.open(flow.verificationUrl, "_blank");
      setMessage(
        "Browser opened. Complete authorization, then this app will connect automatically."
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
          setError(pollError instanceof Error ? pollError.message : "Polling failed.");
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
        `Uploaded ${result.rowCount.toLocaleString()} daily rows for source '${result.sourceId}'.`
      );
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

  return (
    <main>
      <h1>AI vs Human Desktop Sync</h1>
      <p className="small">Connect once, then sync Cursor daily stats to your profile.</p>

      <section className="card">
        <label htmlFor="base-url">Backend URL</label>
        <input
          id="base-url"
          type="text"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://aivshuman.dev"
        />
        <p className="small">Default is production. You can override for local/staging.</p>
      </section>

      <section className="card">
        <div>
          <strong>Status:</strong>{" "}
          <span className={hasToken ? "success" : ""}>
            {hasToken ? "Connected" : "Not connected"}
          </span>
        </div>

        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={beginConnect}
            disabled={isConnecting || isSyncing}
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </button>
          <button type="button" className="primary" onClick={runSync} disabled={!canSync}>
            {isSyncing ? "Syncing..." : "Sync now"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={disconnect}
            disabled={isConnecting || isSyncing || !hasToken}
          >
            Disconnect
          </button>
        </div>

        {deviceFlow && (
          <p className="small">
            If your browser did not open, visit:{" "}
            <span className="mono">{deviceFlow.verificationUrl}</span>
          </p>
        )}

        {message && <p className="small success">{message}</p>}
        {error && <p className="small error">{error}</p>}
      </section>

      <section className="card">
        <div>
          <strong>Profile Overlay Visibility</strong>
          <p className="small">
            Controls whether visitors can see your Cursor accepted-line overlay in Code Volume view.
          </p>
        </div>
        <label className="small" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={showSourceStatsPublicly}
            disabled={!canEditSourceVisibility}
            onChange={(event) => void updateSourceVisibility(event.target.checked)}
          />
          Show Cursor overlay publicly
        </label>
      </section>
    </main>
  );
}
