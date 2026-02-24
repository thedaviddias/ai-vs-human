import {
  classifyAiCoAuthor,
  classifyAiMessageMarker,
  extractCoAuthors,
  hasAiAuthorName,
  hasAiCoAuthor,
  hasAiMessageMarker,
  matchBotPattern,
} from "./knownBots";

export type Classification =
  | "human"
  | "dependabot"
  | "renovate"
  | "copilot"
  | "claude"
  | "cursor"
  | "aider"
  | "devin"
  | "openai-codex"
  | "gemini"
  | "github-actions"
  | "other-bot"
  | "ai-assisted";

export interface ClassificationResult {
  classification: Classification;
  coAuthors: string[];
}

export interface CommitPayload {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
    committer: { name: string; email: string; date: string } | null;
  };
  author: { login: string; id: number; type: string } | null;
  committer: { login: string; id: number; type: string } | null;
}

/**
 * Classifies a commit using an 8-level priority cascade:
 *
 * 1.  GitHub API `type` field ("Bot") — most authoritative
 * 2a. Author email patterns (dependabot, renovate, [bot] suffix)
 * 2b. Author email domain match (AI agents that register as "User", e.g. cursoragent@cursor.com)
 * 3.  Author name/login patterns (known bot names)
 * 4.  Committer-based bot detection (bot committer + bot-like message)
 * 5.  Co-Authored-By trailer detection (AI tool co-authors) — returns specific tool when possible
 * 6.  Commit message AI markers ("Generated with Claude Code", etc.) — returns specific tool when possible
 * 7.  Author name AI suffixes ("John Doe (aider)")
 *
 * If none match → "human"
 */
export function classifyCommit(commit: CommitPayload): ClassificationResult {
  const fullMessage = commit.commit.message;
  const coAuthors = extractCoAuthors(fullMessage);
  const authorLogin = commit.author?.login?.toLowerCase() ?? "";
  const authorType = commit.author?.type;
  const authorEmail = commit.commit.author?.email?.toLowerCase() ?? "";
  const authorName = commit.commit.author?.name?.toLowerCase() ?? "";
  const committerEmail = commit.commit.committer?.email?.toLowerCase() ?? "";

  // 1. GitHub API type field — most authoritative signal
  //    Catches: Copilot Agent, Devin, Sweep, Gemini Code Assist, etc.
  if (authorType === "Bot") {
    const botType = matchBotPattern(authorLogin);
    return { classification: botType ?? "other-bot", coAuthors };
  }

  // 2. Email patterns for known bots and AI agents
  if (authorEmail.includes("dependabot")) {
    return { classification: "dependabot", coAuthors };
  }
  if (authorEmail.includes("renovate")) {
    return { classification: "renovate", coAuthors };
  }
  if (authorEmail.endsWith("[bot]@users.noreply.github.com")) {
    const botType = matchBotPattern(authorEmail);
    return { classification: botType ?? "other-bot", coAuthors };
  }
  if (authorEmail === "noreply@github.com" && authorName === "github") {
    return { classification: "github-actions", coAuthors };
  }

  // 2b. AI agent email domains — these agents may register as "User" on GitHub
  //     so the type check in step 1 misses them
  const emailMatch = matchBotPattern(authorEmail);
  if (emailMatch) {
    return { classification: emailMatch, coAuthors };
  }

  // 3. Author name/login patterns
  //    Catches bots that don't use GitHub App accounts
  const nameMatch = matchBotPattern(authorLogin) ?? matchBotPattern(authorName);
  if (nameMatch) {
    return { classification: nameMatch, coAuthors };
  }

  // 4. Committer-based bot detection
  //    Some bots commit through GitHub's web interface (committer = GitHub)
  if (
    committerEmail.endsWith("[bot]@users.noreply.github.com") ||
    (committerEmail === "noreply@github.com" &&
      commit.commit.committer?.name?.toLowerCase() === "github")
  ) {
    const msgMatch = matchBotPattern(fullMessage.split("\n")[0].toLowerCase());
    if (msgMatch) {
      return { classification: msgMatch, coAuthors };
    }
  }

  // 5. Co-Authored-By trailer detection — human commit with AI assistance
  //    Catches: Claude Code, Cursor, Copilot, Codex CLI, Aider, Gemini CLI
  //    Returns specific tool classification when identifiable (cursor, claude, copilot)
  if (coAuthors.length > 0 && hasAiCoAuthor(coAuthors)) {
    const specific = classifyAiCoAuthor(coAuthors);
    return { classification: specific ?? "ai-assisted", coAuthors };
  }

  // 6. Commit message AI markers — no Co-authored-by but message reveals AI
  //    Catches: "Generated with Claude Code", "Generated with Cursor", "aider:" prefix, etc.
  //    Returns specific tool classification when identifiable
  if (hasAiMessageMarker(fullMessage)) {
    const specific = classifyAiMessageMarker(fullMessage);
    return { classification: specific ?? "ai-assisted", coAuthors };
  }

  // 7. Author name AI suffixes
  //    Catches: Aider appends "(aider)" to author name
  if (authorName && hasAiAuthorName(authorName)) {
    return { classification: "ai-assisted", coAuthors };
  }

  return { classification: "human", coAuthors };
}

// Maps a Classification to the corresponding field name in stats tables
export function classificationToField(classification: Classification): string {
  const mapping: Record<Classification, string> = {
    human: "human",
    dependabot: "dependabot",
    renovate: "renovate",
    copilot: "copilot",
    claude: "claude",
    cursor: "cursor",
    aider: "aider",
    devin: "devin",
    "openai-codex": "openaiCodex",
    gemini: "gemini",
    "github-actions": "githubActions",
    "other-bot": "otherBot",
    "ai-assisted": "aiAssisted",
  };
  return mapping[classification];
}
