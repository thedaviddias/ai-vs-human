"use client";

import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { postJson } from "@/lib/postJson";

type LinkStatus = "idle" | "loading" | "success" | "error";

interface CompleteResponse {
  status: "approved";
}

export default function DesktopLinkPage() {
  const searchParams = useSearchParams();
  const code = useMemo(() => searchParams.get("code")?.trim() ?? "", [searchParams]);

  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<LinkStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setMessage("Missing device code. Open this page from the desktop app.");
      return;
    }

    if (!session?.user || isPending || hasSubmittedRef.current) {
      return;
    }

    hasSubmittedRef.current = true;
    setStatus("loading");

    void postJson<CompleteResponse>("/api/desktop/device/complete", { deviceCode: code })
      .then(() => {
        setStatus("success");
        setMessage("Desktop authorization complete. You can return to the desktop app.");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Failed to authorize desktop app.");
      });
  }, [code, isPending, session?.user]);

  return (
    <main className="mx-auto max-w-lg px-4 py-20">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-8 text-center">
        <h1 className="text-2xl font-bold text-white">Desktop Link</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Authorize your AI vs Human desktop app to sync local Cursor stats.
        </p>

        {!session?.user && !isPending && (
          <button
            type="button"
            onClick={() =>
              authClient.signIn.social({
                provider: "github",
                callbackURL: window.location.href,
              })
            }
            className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200"
          >
            Sign in with GitHub to continue
          </button>
        )}

        {isPending && (
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking session...
          </div>
        )}

        {status === "loading" && (
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Authorizing device...
          </div>
        )}

        {status === "success" && (
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-red-400">
            <ShieldAlert className="h-4 w-4" />
            {message || "Authorization failed."}
          </div>
        )}
      </div>
    </main>
  );
}
