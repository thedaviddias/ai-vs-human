"use client";

import { AlertCircle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface AiConfig {
  tool: string;
  type: string;
  name: string;
}

interface AiConfigMismatchBannerProps {
  configs: AiConfig[];
}

export function AiConfigMismatchBanner({ configs }: AiConfigMismatchBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Deduplicate tool names
  const uniqueTools = [...new Set(configs.map((c) => c.tool))].filter((t) => t !== "skills.sh");

  if (uniqueTools.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-amber-800/30 bg-amber-950/20 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/80" />
        <div className="flex-1 text-sm leading-relaxed text-amber-200/80">
          <p>
            We detected{" "}
            <span className="font-semibold text-amber-200">{uniqueTools.join(", ")}</span>{" "}
            configuration in this repo, but no AI-attributed commits. This likely means attribution
            markers aren&apos;t enabled.
          </p>
          <Link
            href="/docs/attribution"
            className="mt-1 inline-block text-xs font-semibold text-amber-400/90 underline decoration-amber-400/30 underline-offset-2 transition-colors hover:text-amber-300"
          >
            Learn how to enable attribution
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-amber-500/50 transition-colors hover:text-amber-300"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
