import type { AttributionClassification } from "./attributionMappings";
import {
  AI_REVIEW_COAUTHOR_CLASSIFICATION_PATTERNS,
  AI_REVIEW_LOGIN_CLASSIFICATION_PATTERNS,
  AI_REVIEW_MESSAGE_CLASSIFICATION_PATTERNS,
} from "./attributionMappings";

// Matched against author login, author name, and email.
// Order matters: more specific patterns first to avoid false positives.
export const KNOWN_BOT_PATTERNS: Array<{
  pattern: RegExp;
  classification: AttributionClassification;
}> = [
  // Dependency management bots
  { pattern: /dependabot/i, classification: "dependabot" },
  { pattern: /renovate/i, classification: "renovate" },
  { pattern: /greenkeeper/i, classification: "other-bot" },
  { pattern: /snyk-bot/i, classification: "other-bot" },

  // Community / org bots
  { pattern: /clawdhub/i, classification: "other-bot" },
  { pattern: /blog-post-bot/i, classification: "other-bot" },
  { pattern: /smithery/i, classification: "other-bot" },
  { pattern: /expo-bot|expo\[bot\]/i, classification: "other-bot" },

  // AI coding agents
  { pattern: /^cursoragent$/i, classification: "cursor" },
  { pattern: /cursoragent@cursor\.com/i, classification: "cursor" },
  { pattern: /^cursor[- ]?agent$/i, classification: "cursor" },
  { pattern: /copilot-swe-agent/i, classification: "copilot" },
  { pattern: /copilot/i, classification: "copilot" },
  { pattern: /devin-ai-integration/i, classification: "devin" },
  { pattern: /devin-ai/i, classification: "devin" },
  { pattern: /^devin$/i, classification: "devin" },
  { pattern: /chatgpt-codex-connector/i, classification: "openai-codex" },
  { pattern: /^codex$/i, classification: "openai-codex" },
  { pattern: /gemini-code-assist/i, classification: "gemini" },
  { pattern: /amazon-q-developer/i, classification: "ai-assisted" },
  { pattern: /sweep\[bot\]/i, classification: "ai-assisted" },

  // AI review agents (shared mapping)
  ...AI_REVIEW_LOGIN_CLASSIFICATION_PATTERNS,

  // Sentry automation bots (non-AI review signals)
  { pattern: /sentry-bot/i, classification: "other-bot" },
  { pattern: /sentry\[bot\]/i, classification: "other-bot" },

  // AI coding tools that may register as bot accounts
  { pattern: /codeium/i, classification: "ai-assisted" },
  { pattern: /windsurf/i, classification: "ai-assisted" },
  { pattern: /\bcody\b/i, classification: "ai-assisted" },
  { pattern: /tabnine/i, classification: "ai-assisted" },
  { pattern: /continue-dev/i, classification: "ai-assisted" },
  { pattern: /replit-agent/i, classification: "ai-assisted" },
  { pattern: /^replit$/i, classification: "ai-assisted" },
  { pattern: /bolt-agent/i, classification: "ai-assisted" },
  { pattern: /^v0$/i, classification: "ai-assisted" },
  { pattern: /v0-bot/i, classification: "ai-assisted" },
  { pattern: /blackbox-ai/i, classification: "ai-assisted" },

  // CI/CD bots
  { pattern: /github-actions/i, classification: "github-actions" },
  { pattern: /^actions$/i, classification: "github-actions" },

  // Other common bots
  { pattern: /imgbot/i, classification: "other-bot" },
  { pattern: /codecov/i, classification: "other-bot" },
  { pattern: /sonarcloud/i, classification: "other-bot" },
  { pattern: /allcontributors/i, classification: "other-bot" },
  { pattern: /semantic-release-bot/i, classification: "other-bot" },
  { pattern: /release-please/i, classification: "other-bot" },
  { pattern: /mergify/i, classification: "other-bot" },
  { pattern: /stale\[bot\]/i, classification: "other-bot" },
  { pattern: /vercel\[bot\]/i, classification: "other-bot" },
  { pattern: /netlify\[bot\]/i, classification: "other-bot" },
  { pattern: /changeset-bot/i, classification: "other-bot" },
  { pattern: /kodiakhq/i, classification: "other-bot" },
  { pattern: /auto-merge/i, classification: "other-bot" },

  // Generic bot catch-alls (keep last)
  { pattern: /\[bot\]$/i, classification: "other-bot" },
  { pattern: /^bot-/i, classification: "other-bot" },
  { pattern: /-bot$/i, classification: "other-bot" },
  { pattern: /-bot\b/i, classification: "other-bot" },
];

// Matched against Co-authored-by trailer values in commit messages.
export const CO_AUTHOR_AI_PATTERNS: RegExp[] = [
  /noreply@anthropic\.com/i,
  /\bclaude\b/i,
  /cursoragent@cursor\.com/i,
  /\bcursor\b/i,
  /codex@openai\.com/i,
  /\bcodex\b/i,
  /\bcopilot\b/i,
  /noreply@aider\.chat/i,
  /\baider\b/i,
  /codeium/i,
  /windsurf/i,
  /gemini-code-assist/i,
  /\bgemini\b/i,
  /amazon-q-developer/i,
  /devin-ai/i,
  /\bdevin\b/i,
  /tabnine/i,
  /\bcody\b/i,
  /continue\.dev/i,
  /sweep/i,
  /\bclawd\b/i,
  ...AI_REVIEW_COAUTHOR_CLASSIFICATION_PATTERNS.map(({ pattern }) => pattern),
];

const CO_AUTHOR_CLASSIFICATION_PATTERNS: Array<{
  pattern: RegExp;
  classification: AttributionClassification;
}> = [
  { pattern: /cursoragent@cursor\.com/i, classification: "cursor" },
  { pattern: /\bcursor\b/i, classification: "cursor" },
  { pattern: /noreply@anthropic\.com/i, classification: "claude" },
  { pattern: /\bclaude\b/i, classification: "claude" },
  { pattern: /\bcopilot\b/i, classification: "copilot" },
  { pattern: /codex@openai\.com/i, classification: "openai-codex" },
  { pattern: /\bcodex\b/i, classification: "openai-codex" },
  { pattern: /noreply@aider\.chat/i, classification: "aider" },
  { pattern: /\baider\b/i, classification: "aider" },
  { pattern: /gemini-code-assist/i, classification: "gemini" },
  { pattern: /\bgemini\b/i, classification: "gemini" },
  { pattern: /devin-ai/i, classification: "devin" },
  { pattern: /\bdevin\b/i, classification: "devin" },
  ...AI_REVIEW_COAUTHOR_CLASSIFICATION_PATTERNS,
];

const MESSAGE_MARKER_CLASSIFICATION_PATTERNS: Array<{
  pattern: RegExp;
  classification: AttributionClassification;
}> = [
  { pattern: /Generated with Cursor/i, classification: "cursor" },
  { pattern: /\[Cursor\]/i, classification: "cursor" },
  { pattern: /Generated with Claude/i, classification: "claude" },
  { pattern: /Generated by GitHub Copilot/i, classification: "copilot" },
  { pattern: /Generated by Copilot/i, classification: "copilot" },
  { pattern: /^aider:/im, classification: "aider" },
  { pattern: /Generated by Gemini/i, classification: "gemini" },
  ...AI_REVIEW_MESSAGE_CLASSIFICATION_PATTERNS,
];

export const COMMIT_MESSAGE_AI_MARKERS: RegExp[] = [
  /Generated with Claude Code/i,
  /Generated with Claude/i,
  /Generated with Cursor/i,
  /\[Cursor\]/i,
  /Generated by Windsurf/i,
  /Generated by GitHub Copilot/i,
  /Generated by Gemini/i,
  /^aider:/im,
  /\bAI[- ]generated\b/i,
  /\bgenerated by AI\b/i,
  ...AI_REVIEW_MESSAGE_CLASSIFICATION_PATTERNS.map(({ pattern }) => pattern),
];

export const AUTHOR_NAME_AI_PATTERNS: RegExp[] = [/\(aider\)$/i];

export function extractCoAuthors(message: string): string[] {
  const regex = /Co-Authored-By:\s*(.+)/gi;
  return Array.from(message.matchAll(regex), (m) => m[1].trim());
}

export function matchBotPattern(value: string): AttributionClassification | null {
  for (const { pattern, classification } of KNOWN_BOT_PATTERNS) {
    if (pattern.test(value)) {
      return classification;
    }
  }
  return null;
}

export function hasAiCoAuthor(coAuthors: string[]): boolean {
  return coAuthors.some((ca) => CO_AUTHOR_AI_PATTERNS.some((pattern) => pattern.test(ca)));
}

export function classifyAiCoAuthor(coAuthors: string[]): AttributionClassification | null {
  for (const ca of coAuthors) {
    for (const { pattern, classification } of CO_AUTHOR_CLASSIFICATION_PATTERNS) {
      if (pattern.test(ca)) {
        return classification;
      }
    }
  }
  return null;
}

export function classifyAiMessageMarker(message: string): AttributionClassification | null {
  for (const { pattern, classification } of MESSAGE_MARKER_CLASSIFICATION_PATTERNS) {
    if (pattern.test(message)) {
      return classification;
    }
  }
  return null;
}

export function hasAiMessageMarker(message: string): boolean {
  return COMMIT_MESSAGE_AI_MARKERS.some((pattern) => pattern.test(message));
}

export function hasAiAuthorName(authorName: string): boolean {
  return AUTHOR_NAME_AI_PATTERNS.some((pattern) => pattern.test(authorName));
}

export function extractPRNumber(message: string): number | null {
  const firstLine = message.split("\n")[0];
  const squashMatch = firstLine.match(/\(#(\d+)\)\s*$/);
  if (squashMatch) return Number.parseInt(squashMatch[1], 10);

  const mergeMatch = firstLine.match(/^Merge pull request #(\d+)/);
  if (mergeMatch) return Number.parseInt(mergeMatch[1], 10);

  return null;
}
