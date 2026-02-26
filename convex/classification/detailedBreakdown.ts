import type { Doc } from "../_generated/dataModel";
import type { Classification } from "./botDetector";
import { CO_AUTHOR_AI_PATTERNS } from "./knownBots";

type CommitDoc = Doc<"commits">;

export interface DetailedAiToolStat {
  key: string;
  label: string;
  commits: number;
  additions: number;
}

export interface DetailedBotToolStat {
  key: string;
  label: string;
  commits: number;
}

type DetailedMatch = { key: string; label: string };

const FIXED_AI_CLASSIFICATIONS: Partial<Record<Classification, DetailedMatch>> = {
  copilot: { key: "github-copilot", label: "GitHub Copilot" },
  claude: { key: "claude-code", label: "Claude Code" },
  cursor: { key: "cursor", label: "Cursor" },
  aider: { key: "aider", label: "Aider" },
  devin: { key: "devin", label: "Devin" },
  "openai-codex": { key: "openai-codex", label: "OpenAI Codex" },
  gemini: { key: "gemini", label: "Gemini" },
};

const FIXED_AUTOMATION_CLASSIFICATIONS: Partial<Record<Classification, DetailedMatch>> = {
  dependabot: { key: "dependabot", label: "Dependabot" },
  renovate: { key: "renovate", label: "Renovate" },
  "github-actions": { key: "github-actions", label: "GitHub Actions" },
};

const DETAILED_AI_PATTERNS: Array<{ pattern: RegExp; match: DetailedMatch }> = [
  {
    pattern: /amazon-q(?:-developer)?/i,
    match: { key: "amazon-q-developer", label: "Amazon Q Developer" },
  },
  { pattern: /sweep(?:\[bot\])?/i, match: { key: "sweep", label: "Sweep" } },
  { pattern: /coderabbit(?:ai)?(?:\[bot\])?/i, match: { key: "coderabbit", label: "CodeRabbit" } },
  {
    pattern: /seer-by-sentry(?:\[bot\])?/i,
    match: { key: "seer-by-sentry", label: "Seer by Sentry" },
  },
  {
    pattern: /sentry-ai-review(?:er)?(?:\[bot\])?/i,
    match: { key: "sentry-ai-reviewer", label: "Sentry AI Reviewer" },
  },
  {
    pattern: /qodo(?:-merge(?:-pro)?)?(?:\[bot\])?/i,
    match: { key: "qodo-merge", label: "Qodo Merge" },
  },
  { pattern: /greptile(?:-apps)?(?:\[bot\])?/i, match: { key: "greptile", label: "Greptile" } },
  { pattern: /korbit-ai(?:\[bot\])?/i, match: { key: "korbit-ai", label: "Korbit AI" } },
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
  { pattern: /\bclawd\b/i, match: { key: "clawd", label: "Clawd" } },
];

const DETAILED_BOT_PATTERNS: Array<{ pattern: RegExp; match: DetailedMatch }> = [
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

function findDetailedMatch(
  text: string,
  patterns: Array<{ pattern: RegExp; match: DetailedMatch }>
): DetailedMatch | null {
  for (const candidate of patterns) {
    if (candidate.pattern.test(text)) {
      return candidate.match;
    }
  }
  return null;
}

function normalizeIdentity(source: string): { slug: string; label: string } | null {
  const raw = source
    .trim()
    .replace(/\[bot\]/gi, "")
    .replace(/^@/, "")
    .replace(/<[^>]*>/g, "")
    .trim();
  if (!raw) return null;

  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return null;

  const label = raw
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  if (!label) return null;

  return { slug, label };
}

function extractPreferredIdentity(commit: CommitDoc): string | null {
  return (
    commit.authorLogin ?? commit.authorName ?? commit.authorEmail ?? commit.coAuthors?.[0] ?? null
  );
}

function buildHaystack(commit: CommitDoc): string {
  const parts = [
    commit.authorLogin,
    commit.authorName,
    commit.authorEmail,
    commit.message,
    commit.fullMessage,
    ...(commit.coAuthors ?? []),
  ].filter(Boolean);
  return parts.join("\n");
}

function classifyCommitForBreakdown(
  commit: CommitDoc
): { kind: "ai"; match: DetailedMatch } | { kind: "automation"; match: DetailedMatch } | null {
  const classification = commit.classification as Classification;
  if (classification === "human") {
    return null;
  }

  const fixedAi = FIXED_AI_CLASSIFICATIONS[classification];
  if (fixedAi) {
    return { kind: "ai", match: fixedAi };
  }

  const fixedAutomation = FIXED_AUTOMATION_CLASSIFICATIONS[classification];
  if (fixedAutomation) {
    return { kind: "automation", match: fixedAutomation };
  }

  const haystack = buildHaystack(commit);

  if (classification === "ai-assisted") {
    const explicitAiMatch = findDetailedMatch(haystack, DETAILED_AI_PATTERNS);
    if (explicitAiMatch) {
      return { kind: "ai", match: explicitAiMatch };
    }

    // For ai-assisted commits the author is the HUMAN who used an AI tool.
    // Extract identity from co-authors (where the AI identity lives), never
    // from authorLogin/authorName which would incorrectly show human names
    // as AI tools.
    for (const ca of commit.coAuthors ?? []) {
      const caMatch = findDetailedMatch(ca, DETAILED_AI_PATTERNS);
      if (caMatch) return { kind: "ai", match: caMatch };

      // Only normalize co-authors confirmed to be AI tools — never human names
      const isAiCoAuthor = CO_AUTHOR_AI_PATTERNS.some((p) => p.test(ca));
      if (isAiCoAuthor) {
        const normalized = normalizeIdentity(ca);
        if (normalized) {
          return {
            kind: "ai",
            match: { key: `ai-${normalized.slug}`, label: normalized.label },
          };
        }
      }
    }

    return { kind: "ai", match: { key: "ai-unspecified", label: "Unspecified AI Assistant" } };
  }

  if (classification === "other-bot") {
    const explicitBotMatch = findDetailedMatch(haystack, DETAILED_BOT_PATTERNS);
    if (explicitBotMatch) {
      return { kind: "automation", match: explicitBotMatch };
    }

    const identity = extractPreferredIdentity(commit);
    const normalized = identity ? normalizeIdentity(identity) : null;
    if (normalized) {
      return {
        kind: "automation",
        match: { key: `bot-${normalized.slug}`, label: normalized.label },
      };
    }

    return { kind: "automation", match: { key: "bot-unspecified", label: "Unspecified Bot" } };
  }

  return null;
}

export function buildDetailedBreakdowns(commits: CommitDoc[]): {
  toolBreakdown: DetailedAiToolStat[];
  botBreakdown: DetailedBotToolStat[];
} {
  const aiMap = new Map<string, DetailedAiToolStat>();
  const botMap = new Map<string, DetailedBotToolStat>();

  for (const commit of commits) {
    const classification = classifyCommitForBreakdown(commit);
    if (!classification) continue;

    if (classification.kind === "ai") {
      const existing = aiMap.get(classification.match.key);
      if (existing) {
        existing.commits += 1;
        existing.additions += commit.additions ?? 0;
      } else {
        aiMap.set(classification.match.key, {
          key: classification.match.key,
          label: classification.match.label,
          commits: 1,
          additions: commit.additions ?? 0,
        });
      }
      continue;
    }

    const existing = botMap.get(classification.match.key);
    if (existing) {
      existing.commits += 1;
    } else {
      botMap.set(classification.match.key, {
        key: classification.match.key,
        label: classification.match.label,
        commits: 1,
      });
    }
  }

  const toolBreakdown = Array.from(aiMap.values()).sort(
    (a, b) => b.commits - a.commits || b.additions - a.additions || a.label.localeCompare(b.label)
  );
  const botBreakdown = Array.from(botMap.values()).sort(
    (a, b) => b.commits - a.commits || a.label.localeCompare(b.label)
  );

  return { toolBreakdown, botBreakdown };
}

/**
 * Set of all known-valid AI tool keys produced by `buildDetailedBreakdowns`.
 * Used by query layer to filter out bad persisted entries (e.g. human
 * usernames that were incorrectly stored as AI tools before the fix).
 */
export const KNOWN_AI_TOOL_KEYS: ReadonlySet<string> = new Set([
  // From FIXED_AI_CLASSIFICATIONS
  ...Object.values(FIXED_AI_CLASSIFICATIONS).map((m) => m.key),
  // From DETAILED_AI_PATTERNS
  ...DETAILED_AI_PATTERNS.map((p) => p.match.key),
  // Generic fallback
  "ai-unspecified",
]);
