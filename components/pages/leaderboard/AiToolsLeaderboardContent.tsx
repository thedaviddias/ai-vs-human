"use client";

import { useQuery } from "convex/react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/tracking";
import { AiToolLogo } from "./toolVisuals";
import { formatCompactNumber } from "./utils";

interface AiToolEntry {
  key: string;
  label: string;
  commits: number;
  additions: number;
  repoCount: number;
  ownerCount: number;
}

interface ToolLeaderboardsData {
  aiTools: AiToolEntry[];
  bots: Array<{
    key: string;
    label: string;
    commits: number;
    repoCount: number;
    ownerCount: number;
  }>;
}

const metrics = ["commits", "loc"] as const;

export function AiToolsLeaderboardContent({ initialData }: { initialData: ToolLeaderboardsData }) {
  const data = useQuery(api.queries.stats.getGlobalToolLeaderboards) ?? initialData;
  const [metric, setMetric] = useQueryState(
    "metric",
    parseAsStringLiteral(metrics).withDefault("commits")
  );
  const hasTrackedInitialMetric = useRef(false);

  useEffect(() => {
    if (!hasTrackedInitialMetric.current) {
      hasTrackedInitialMetric.current = true;
      return;
    }
    trackEvent("leaderboard_metric_toggle", { section: "ai-tools", metric });
  }, [metric]);

  const rows = useMemo(() => {
    const base = [...data.aiTools];
    return base.sort((a, b) => {
      if (metric === "loc") {
        return (
          b.additions - a.additions ||
          b.commits - a.commits ||
          b.repoCount - a.repoCount ||
          b.ownerCount - a.ownerCount ||
          a.label.localeCompare(b.label)
        );
      }

      return (
        b.commits - a.commits ||
        b.additions - a.additions ||
        b.repoCount - a.repoCount ||
        b.ownerCount - a.ownerCount ||
        a.label.localeCompare(b.label)
      );
    });
  }, [data.aiTools, metric]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">AI Tools</h2>
        <div className="inline-flex rounded-lg border border-neutral-800 bg-black p-1">
          {metrics.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMetric(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                metric === value ? "bg-white text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              {value === "loc" ? "Code Volume" : "Commits"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/70 text-left text-xs uppercase tracking-widest text-neutral-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Tool</th>
              <th className="px-4 py-3">Commits</th>
              <th className="px-4 py-3">Code Volume</th>
              <th className="px-4 py-3">Repos</th>
              <th className="px-4 py-3">Owners</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tool, index) => (
              <tr key={tool.key} className="border-t border-neutral-800/80 hover:bg-neutral-900/40">
                <td className="px-4 py-3 font-semibold text-neutral-400">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <AiToolLogo toolKey={tool.key} label={tool.label} />
                    <span className="font-semibold text-white">{tool.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-200">{formatCompactNumber(tool.commits)}</td>
                <td className="px-4 py-3 text-neutral-300">
                  {formatCompactNumber(tool.additions)}
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {formatCompactNumber(tool.repoCount)}
                </td>
                <td className="px-4 py-3 text-neutral-300">
                  {formatCompactNumber(tool.ownerCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
