"use client";

import { Bot, User } from "lucide-react";

interface Contributor {
  login?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  classification: string;
  commitCount: number;
  additions?: number;
  deletions?: number;
}

function formatAdditions(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `+${n}`;
}

const CLASSIFICATION_BADGE_COLORS: Record<string, string> = {
  human: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "ai-assisted": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  copilot: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  claude: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  cursor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  aider: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  devin: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  "openai-codex": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  gemini: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  dependabot: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  renovate: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  "github-actions": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  "other-bot": "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  human: "Human",
  "ai-assisted": "AI-Assisted",
  copilot: "Copilot",
  claude: "Claude Code",
  cursor: "Cursor",
  aider: "Aider",
  devin: "Devin",
  "openai-codex": "Codex",
  gemini: "Gemini",
  dependabot: "Dependabot",
  renovate: "Renovate",
  "github-actions": "GitHub Actions",
  "other-bot": "Bot",
};

function isBot(classification: string) {
  return classification !== "human";
}

export function ContributorBreakdown({ contributors }: { contributors: Contributor[] }) {
  if (contributors.length === 0) {
    return <div className="py-8 text-center text-neutral-500">No contributors found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900">
            <th className="px-4 py-3 font-medium">Contributor</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 text-right font-medium">Commits</th>
            <th className="px-4 py-3 text-right font-medium">Lines Added</th>
          </tr>
        </thead>
        <tbody>
          {contributors.slice(0, 50).map((contributor, i) => (
            <tr
              key={contributor.login ?? contributor.email ?? i}
              className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/50"
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {isBot(contributor.classification) ? (
                    <Bot className="h-4 w-4 text-neutral-400" />
                  ) : (
                    <User className="h-4 w-4 text-neutral-400" />
                  )}
                  <span className="font-medium">
                    {contributor.login ?? contributor.name ?? contributor.email ?? "Unknown"}
                  </span>
                </div>
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    CLASSIFICATION_BADGE_COLORS[contributor.classification] ??
                    CLASSIFICATION_BADGE_COLORS["other-bot"]
                  }`}
                >
                  {CLASSIFICATION_LABELS[contributor.classification] ?? contributor.classification}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {contributor.commitCount.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs text-neutral-500">
                {contributor.additions != null && contributor.additions > 0
                  ? formatAdditions(contributor.additions)
                  : "\u2014"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
