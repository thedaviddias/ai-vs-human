import type { AttributionClassification } from "./attributionMappings";
import {
  AI_REVIEW_DETAILED_PATTERNS,
  UNKNOWN_AI_KEY,
  UNKNOWN_AI_LABEL,
  UNKNOWN_AUTOMATION_KEY,
  UNKNOWN_AUTOMATION_LABEL,
} from "./attributionMappings";

export type PrAttributionLane = "ai" | "automation";

export interface PrAttributionMatch {
  key: string;
  label: string;
  lane: PrAttributionLane;
}

export interface PrAttributionBreakdownItem extends PrAttributionMatch {
  commits: number;
}

export interface PrAttributionSummary {
  totalCommits: number;
  aiCommits: number;
  automationCommits: number;
  breakdown: PrAttributionBreakdownItem[];
  computedAt: number;
}

export interface PrAttributionSignal {
  classification: AttributionClassification;
  login?: string | null;
  body?: string | null;
  branch?: string | null;
  labels?: string[];
}

export interface PrAttributionAggregateInput extends PrAttributionSignal {
  commitCount: number;
}

const FIXED_CLASSIFICATION_MATCH: Partial<Record<AttributionClassification, PrAttributionMatch>> = {
  copilot: { key: "github-copilot", label: "GitHub Copilot", lane: "ai" },
  claude: { key: "claude-code", label: "Claude Code", lane: "ai" },
  cursor: { key: "cursor", label: "Cursor", lane: "ai" },
  aider: { key: "aider", label: "Aider", lane: "ai" },
  devin: { key: "devin", label: "Devin", lane: "ai" },
  "openai-codex": { key: "openai-codex", label: "OpenAI Codex", lane: "ai" },
  gemini: { key: "gemini", label: "Gemini", lane: "ai" },
  dependabot: { key: "dependabot", label: "Dependabot", lane: "automation" },
  renovate: { key: "renovate", label: "Renovate", lane: "automation" },
  "github-actions": { key: "github-actions", label: "GitHub Actions", lane: "automation" },
};

const AI_ASSISTED_PATTERNS: Array<{
  pattern: RegExp;
  match: { key: string; label: string };
}> = [
  ...AI_REVIEW_DETAILED_PATTERNS,
  {
    pattern: /amazon-q(?:-developer)?/i,
    match: { key: "amazon-q-developer", label: "Amazon Q Developer" },
  },
  { pattern: /sweep(?:\[bot\])?/i, match: { key: "sweep", label: "Sweep" } },
  { pattern: /codeium/i, match: { key: "codeium", label: "Codeium" } },
  { pattern: /windsurf/i, match: { key: "windsurf", label: "Windsurf" } },
  {
    pattern: /sourcegraph|\bcody\b/i,
    match: { key: "sourcegraph-cody", label: "Sourcegraph Cody" },
  },
  { pattern: /tabnine/i, match: { key: "tabnine", label: "Tabnine" } },
  { pattern: /continue(?:-dev|\.dev)/i, match: { key: "continue-dev", label: "Continue.dev" } },
  { pattern: /replit(?:-agent)?/i, match: { key: "replit-agent", label: "Replit Agent" } },
  { pattern: /bolt(?:-agent)?/i, match: { key: "bolt", label: "Bolt" } },
  { pattern: /\bv0(?:-bot)?\b/i, match: { key: "v0", label: "v0" } },
  { pattern: /blackbox-ai/i, match: { key: "blackbox-ai", label: "Blackbox AI" } },
];

const AUTOMATION_PATTERNS: Array<{
  pattern: RegExp;
  match: { key: string; label: string };
}> = [
  { pattern: /dependabot/i, match: { key: "dependabot", label: "Dependabot" } },
  { pattern: /renovate/i, match: { key: "renovate", label: "Renovate" } },
  {
    pattern: /github-actions|^actions$/i,
    match: { key: "github-actions", label: "GitHub Actions" },
  },
  { pattern: /greenkeeper/i, match: { key: "greenkeeper", label: "Greenkeeper" } },
  { pattern: /snyk-bot|snyk/i, match: { key: "snyk-bot", label: "Snyk Bot" } },
  { pattern: /sentry-bot|sentry\[bot\]/i, match: { key: "sentry-bot", label: "Sentry Bot" } },
  { pattern: /imgbot/i, match: { key: "imgbot", label: "Imgbot" } },
  { pattern: /codecov/i, match: { key: "codecov", label: "Codecov" } },
  { pattern: /sonarcloud/i, match: { key: "sonarcloud", label: "SonarCloud" } },
  { pattern: /allcontributors/i, match: { key: "all-contributors", label: "All Contributors" } },
  {
    pattern: /semantic-release-bot|semantic-release/i,
    match: { key: "semantic-release", label: "Semantic Release" },
  },
  { pattern: /release-please/i, match: { key: "release-please", label: "Release Please" } },
  { pattern: /mergify/i, match: { key: "mergify", label: "Mergify" } },
  { pattern: /stale\[bot\]/i, match: { key: "stale", label: "Stale" } },
  { pattern: /vercel\[bot\]/i, match: { key: "vercel", label: "Vercel Bot" } },
  { pattern: /netlify\[bot\]/i, match: { key: "netlify", label: "Netlify Bot" } },
  { pattern: /changeset-bot|changesets?/i, match: { key: "changesets", label: "Changesets" } },
  { pattern: /kodiakhq|kodiak/i, match: { key: "kodiak", label: "Kodiak" } },
  { pattern: /auto-merge/i, match: { key: "auto-merge", label: "Auto Merge" } },
  { pattern: /clawdhub/i, match: { key: "clawdhub", label: "ClawdHub" } },
  { pattern: /blog-post-bot/i, match: { key: "blog-post-bot", label: "Blog Post Bot" } },
  { pattern: /smithery/i, match: { key: "smithery", label: "Smithery" } },
  { pattern: /expo-bot|expo\[bot\]/i, match: { key: "expo-bot", label: "Expo Bot" } },
];

function findPatternMatch(
  candidates: Array<string | null | undefined>,
  patterns: Array<{ pattern: RegExp; match: { key: string; label: string } }>
): { key: string; label: string } | null {
  const haystack = candidates.filter(Boolean).join("\n");
  if (!haystack) return null;
  for (const candidate of patterns) {
    if (candidate.pattern.test(haystack)) {
      return candidate.match;
    }
  }
  return null;
}

export function mapPrAttributionSignal(signal: PrAttributionSignal): PrAttributionMatch | null {
  if (signal.classification === "human") return null;

  const fixedMatch = FIXED_CLASSIFICATION_MATCH[signal.classification];
  if (fixedMatch) return fixedMatch;

  if (signal.classification === "ai-assisted") {
    const match = findPatternMatch(
      [signal.login, signal.branch, signal.body, ...(signal.labels ?? [])],
      AI_ASSISTED_PATTERNS
    );
    if (match) {
      return { ...match, lane: "ai" };
    }
    return { key: UNKNOWN_AI_KEY, label: UNKNOWN_AI_LABEL, lane: "ai" };
  }

  if (signal.classification === "other-bot") {
    const match = findPatternMatch(
      [signal.login, signal.branch, signal.body, ...(signal.labels ?? [])],
      AUTOMATION_PATTERNS
    );
    if (match) {
      return { ...match, lane: "automation" };
    }
    return {
      key: UNKNOWN_AUTOMATION_KEY,
      label: UNKNOWN_AUTOMATION_LABEL,
      lane: "automation",
    };
  }

  return null;
}

export function aggregatePrAttribution(
  inputs: PrAttributionAggregateInput[],
  computedAt: number = Date.now()
): PrAttributionSummary {
  let totalCommits = 0;
  let aiCommits = 0;
  let automationCommits = 0;
  const breakdown = new Map<string, PrAttributionBreakdownItem>();

  for (const input of inputs) {
    if (!Number.isFinite(input.commitCount) || input.commitCount <= 0) continue;
    const match = mapPrAttributionSignal(input);
    if (!match) continue;

    totalCommits += input.commitCount;
    if (match.lane === "ai") {
      aiCommits += input.commitCount;
    } else {
      automationCommits += input.commitCount;
    }

    const existing = breakdown.get(match.key);
    if (existing) {
      existing.commits += input.commitCount;
    } else {
      breakdown.set(match.key, {
        ...match,
        commits: input.commitCount,
      });
    }
  }

  return {
    totalCommits,
    aiCommits,
    automationCommits,
    breakdown: Array.from(breakdown.values()).sort(
      (a, b) => b.commits - a.commits || a.label.localeCompare(b.label)
    ),
    computedAt,
  };
}
