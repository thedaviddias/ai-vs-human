import type { Classification } from "./botDetector";

// ─── Bot author patterns ──────────────────────────────────────────────
// Matched against author login, author name, and email.
// Order matters: more specific patterns first to avoid false positives.
export const KNOWN_BOT_PATTERNS: Array<{
  pattern: RegExp;
  classification: Classification;
}> = [
  // Dependency management bots
  { pattern: /dependabot/i, classification: "dependabot" },
  { pattern: /renovate/i, classification: "renovate" },
  { pattern: /greenkeeper/i, classification: "other-bot" },
  { pattern: /snyk-bot/i, classification: "other-bot" },

  // AI coding agents — some register as "User" (not "Bot") on GitHub!
  // These patterns match author login, author name, and author email.
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

  // AI PR review bots (GitHub Apps / assistants)
  // Sources:
  // - https://github.com/apps/coderabbitai
  // - https://github.com/apps/seer-by-sentry
  // - https://github.com/apps/qodo-merge-pro
  // - https://github.com/apps/greptile-apps
  // - https://github.com/apps/korbit-ai
  { pattern: /coderabbitai/i, classification: "ai-assisted" },
  { pattern: /coderabbit(?:\[bot\])?/i, classification: "ai-assisted" },
  { pattern: /seer-by-sentry(?:\[bot\])?/i, classification: "ai-assisted" },
  { pattern: /sentry-ai-review(?:er)?(?:\[bot\])?/i, classification: "ai-assisted" },
  { pattern: /qodo-merge(?:-pro)?(?:\[bot\])?/i, classification: "ai-assisted" },
  { pattern: /greptile(?:-apps)?(?:\[bot\])?/i, classification: "ai-assisted" },
  { pattern: /korbit-ai(?:\[bot\])?/i, classification: "ai-assisted" },

  // Sentry automation bots (non-AI review signals)
  { pattern: /sentry-bot/i, classification: "other-bot" },
  { pattern: /sentry\[bot\]/i, classification: "other-bot" },

  // AI coding tools that may register as bot accounts
  { pattern: /codeium/i, classification: "ai-assisted" },
  { pattern: /windsurf/i, classification: "ai-assisted" },
  { pattern: /sourcegraph/i, classification: "ai-assisted" },
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
];

// ─── Co-authored-by AI patterns ───────────────────────────────────────
// Matched against Co-authored-by trailer values in commit messages.
// These catch AI tools that add themselves as co-authors on human commits.
export const CO_AUTHOR_AI_PATTERNS: RegExp[] = [
  // Claude Code: "Co-Authored-By: Claude <noreply@anthropic.com>"
  /noreply@anthropic\.com/i,
  /claude/i,
  /anthropic/i,

  // Cursor: "Co-authored-by: Cursor <cursoragent@cursor.com>"
  /cursoragent@cursor\.com/i,
  /cursor/i,

  // OpenAI Codex: "Co-authored-by: <Model> <codex@openai.com>"
  /codex@openai\.com/i,
  /openai/i,
  /codex/i,

  // GitHub Copilot (when used via agent or configured)
  /copilot/i,

  // Aider: "Co-authored-by: aider (model) <noreply@aider.chat>"
  /noreply@aider\.chat/i,
  /\baider\b/i,

  // Codeium / Windsurf
  /codeium/i,
  /windsurf/i,

  // Gemini Code Assist
  /gemini-code-assist/i,
  /gemini/i,

  // Amazon Q Developer
  /amazon-q/i,

  // Devin
  /devin-ai/i,
  /devin/i,

  // Tabnine
  /tabnine/i,

  // Sourcegraph Cody
  /sourcegraph/i,
  /\bcody\b/i,

  // Continue.dev
  /continue\.dev/i,

  // Sweep AI
  /sweep/i,

  // AI PR review assistants
  /coderabbitai/i,
  /coderabbit/i,
  /seer-by-sentry/i,
  /qodo-merge/i,
  /greptile/i,
  /korbit-ai/i,

  // Generic AI patterns
  /github-actions/i,
];

// ─── Co-author → specific classification ─────────────────────────────
// When a co-author trailer matches an AI tool, these patterns map it
// to a *specific* classification instead of the generic "ai-assisted".
// More specific patterns first to avoid false positives.
const CO_AUTHOR_CLASSIFICATION_PATTERNS: Array<{
  pattern: RegExp;
  classification: Classification;
}> = [
  // Cursor: "Co-authored-by: Cursor <cursoragent@cursor.com>"
  { pattern: /cursoragent@cursor\.com/i, classification: "cursor" },
  { pattern: /\bcursor\b/i, classification: "cursor" },

  // Claude Code: "Co-Authored-By: Claude <noreply@anthropic.com>"
  { pattern: /noreply@anthropic\.com/i, classification: "claude" },
  { pattern: /\bclaude\b/i, classification: "claude" },

  // GitHub Copilot
  { pattern: /\bcopilot\b/i, classification: "copilot" },

  // OpenAI Codex
  { pattern: /codex@openai\.com/i, classification: "openai-codex" },
  { pattern: /\bcodex\b/i, classification: "openai-codex" },

  // Aider
  { pattern: /noreply@aider\.chat/i, classification: "aider" },
  { pattern: /\baider\b/i, classification: "aider" },

  // Gemini
  { pattern: /gemini-code-assist/i, classification: "gemini" },
  { pattern: /\bgemini\b/i, classification: "gemini" },

  // Devin
  { pattern: /devin-ai/i, classification: "devin" },
  { pattern: /\bdevin\b/i, classification: "devin" },

  // AI PR review assistants
  { pattern: /coderabbitai/i, classification: "ai-assisted" },
  { pattern: /coderabbit/i, classification: "ai-assisted" },
  { pattern: /seer-by-sentry/i, classification: "ai-assisted" },
  { pattern: /qodo-merge/i, classification: "ai-assisted" },
  { pattern: /greptile/i, classification: "ai-assisted" },
  { pattern: /korbit-ai/i, classification: "ai-assisted" },
];

// ─── Commit message → specific classification ────────────────────────
// When a commit message contains AI markers, these patterns map it
// to a *specific* classification instead of the generic "ai-assisted".
const MESSAGE_MARKER_CLASSIFICATION_PATTERNS: Array<{
  pattern: RegExp;
  classification: Classification;
}> = [
  { pattern: /Generated with Cursor/i, classification: "cursor" },
  { pattern: /\[Cursor\]/i, classification: "cursor" },
  { pattern: /Generated with Claude/i, classification: "claude" },
  { pattern: /Generated by GitHub Copilot/i, classification: "copilot" },
  { pattern: /Generated by Copilot/i, classification: "copilot" },
  { pattern: /^aider:/im, classification: "aider" },
  { pattern: /Generated by Gemini/i, classification: "gemini" },
  { pattern: /Generated by CodeRabbit/i, classification: "ai-assisted" },
  { pattern: /Generated by Seer/i, classification: "ai-assisted" },
  { pattern: /Generated by Qodo/i, classification: "ai-assisted" },
  { pattern: /Generated by Greptile/i, classification: "ai-assisted" },
  { pattern: /Generated by Korbit/i, classification: "ai-assisted" },
];

// ─── Commit message AI markers ────────────────────────────────────────
// These patterns match text in the commit message body that indicates
// AI tool involvement, even without a Co-authored-by trailer.
export const COMMIT_MESSAGE_AI_MARKERS: RegExp[] = [
  // Claude Code appends this to commit messages
  /Generated with Claude Code/i,
  /Generated with Claude/i,

  // Cursor
  /Generated with Cursor/i,
  /\[Cursor\]/i,

  // Windsurf
  /Generated by Windsurf/i,

  // CodeRabbit
  /Generated by CodeRabbit/i,

  // Sentry Seer
  /Generated by Seer/i,
  /seer-by-sentry/i,

  // AI PR review bots
  /Generated by Qodo/i,
  /Generated by Greptile/i,
  /Generated by Korbit/i,

  // Generic AI generation markers
  /\bAI[- ]generated\b/i,
  /\bgenerated by AI\b/i,

  // Aider sometimes prefixes commit messages
  /^aider:/im,

  // Copilot commit message indicator (when generating messages)
  /Generated by GitHub Copilot/i,

  // Gemini
  /Generated by Gemini/i,
];

// ─── Author name AI suffixes ─────────────────────────────────────────
// Some tools modify the git author name (e.g., Aider appends "(aider)")
export const AUTHOR_NAME_AI_PATTERNS: RegExp[] = [/\(aider\)$/i];

// ─── Extraction helpers ───────────────────────────────────────────────

export function extractCoAuthors(message: string): string[] {
  // Match both "Co-authored-by" and "Co-Authored-By" (case insensitive)
  const regex = /Co-Authored-By:\s*(.+)/gi;
  return Array.from(message.matchAll(regex), (m) => m[1].trim());
}

export function matchBotPattern(value: string): Classification | null {
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

/**
 * Identifies the *specific* AI tool from co-author trailers.
 * Returns "cursor", "claude", "copilot" when identifiable,
 * or null to fall back to generic "ai-assisted".
 */
export function classifyAiCoAuthor(coAuthors: string[]): Classification | null {
  for (const ca of coAuthors) {
    for (const { pattern, classification } of CO_AUTHOR_CLASSIFICATION_PATTERNS) {
      if (pattern.test(ca)) {
        return classification;
      }
    }
  }
  return null;
}

/**
 * Identifies the *specific* AI tool from commit message markers.
 * Returns "cursor", "claude", "copilot" when identifiable,
 * or null to fall back to generic "ai-assisted".
 */
export function classifyAiMessageMarker(message: string): Classification | null {
  for (const { pattern, classification } of MESSAGE_MARKER_CLASSIFICATION_PATTERNS) {
    if (pattern.test(message)) {
      return classification;
    }
  }
  return null;
}

/**
 * Checks if the commit message body contains AI tool markers
 * (e.g., "Generated with Claude Code")
 */
export function hasAiMessageMarker(message: string): boolean {
  return COMMIT_MESSAGE_AI_MARKERS.some((pattern) => pattern.test(message));
}

/**
 * Checks if the author name indicates AI tool involvement
 * (e.g., "John Doe (aider)")
 */
export function hasAiAuthorName(authorName: string): boolean {
  return AUTHOR_NAME_AI_PATTERNS.some((pattern) => pattern.test(authorName));
}

/**
 * Extracts PR number from a squash/merge commit message.
 * GitHub squash merges: "Title (#123)"
 * GitHub merge commits: "Merge pull request #123 from ..."
 * Returns null if no PR reference found.
 */
export function extractPRNumber(message: string): number | null {
  // Squash merge: "Title (#123)" — PR number in parentheses at end of first line
  const firstLine = message.split("\n")[0];
  const squashMatch = firstLine.match(/\(#(\d+)\)\s*$/);
  if (squashMatch) return Number.parseInt(squashMatch[1], 10);

  // Merge commit: "Merge pull request #123 from ..."
  const mergeMatch = firstLine.match(/^Merge pull request #(\d+)/);
  if (mergeMatch) return Number.parseInt(mergeMatch[1], 10);

  return null;
}
