import { describe, expect, it } from "vitest";
import {
  type Classification,
  type CommitPayload,
  classificationToField,
  classifyCommit,
} from "../botDetector";
import {
  classifyAiCoAuthor,
  classifyAiMessageMarker,
  extractCoAuthors,
  extractPRNumber,
  hasAiAuthorName,
  hasAiCoAuthor,
  hasAiMessageMarker,
  matchBotPattern,
} from "../knownBots";

// ─── Test helpers ──────────────────────────────────────────────────────

/** Builds a minimal CommitPayload with sensible defaults. */
function makeCommit(
  overrides: Partial<{
    message: string;
    authorLogin: string;
    authorType: string;
    authorEmail: string;
    authorName: string;
    committerEmail: string;
    committerName: string;
  }>
): CommitPayload {
  return {
    sha: "abc123",
    commit: {
      message: overrides.message ?? "fix: update readme",
      author: {
        name: overrides.authorName ?? "Jane Doe",
        email: overrides.authorEmail ?? "jane@example.com",
        date: "2025-01-01T00:00:00Z",
      },
      committer: {
        name: overrides.committerName ?? "Jane Doe",
        email: overrides.committerEmail ?? "jane@example.com",
        date: "2025-01-01T00:00:00Z",
      },
    },
    author: {
      login: overrides.authorLogin ?? "janedoe",
      id: 1,
      type: overrides.authorType ?? "User",
    },
    committer: {
      login: "janedoe",
      id: 1,
      type: "User",
    },
  };
}

// ─── classifyCommit — full 8-level cascade ─────────────────────────────

describe("classifyCommit", () => {
  // Level 1: GitHub API "Bot" type
  describe("Level 1: Bot account type", () => {
    it('classifies dependabot[bot] with type "Bot" as dependabot', () => {
      const result = classifyCommit(
        makeCommit({ authorLogin: "dependabot[bot]", authorType: "Bot" })
      );
      expect(result.classification).toBe("dependabot");
    });

    it('classifies copilot-swe-agent with type "Bot" as copilot', () => {
      const result = classifyCommit(
        makeCommit({ authorLogin: "copilot-swe-agent", authorType: "Bot" })
      );
      expect(result.classification).toBe("copilot");
    });

    it('classifies unknown bot with type "Bot" as other-bot', () => {
      const result = classifyCommit(
        makeCommit({ authorLogin: "some-unknown-bot", authorType: "Bot" })
      );
      expect(result.classification).toBe("other-bot");
    });

    it('classifies coderabbitai with type "Bot" as ai-assisted', () => {
      const result = classifyCommit(
        makeCommit({ authorLogin: "coderabbitai[bot]", authorType: "Bot" })
      );
      expect(result.classification).toBe("ai-assisted");
    });

    it('classifies seer-by-sentry with type "Bot" as ai-assisted', () => {
      const result = classifyCommit(
        makeCommit({ authorLogin: "seer-by-sentry[bot]", authorType: "Bot" })
      );
      expect(result.classification).toBe("ai-assisted");
    });
  });

  // Level 2: Email patterns
  describe("Level 2: Email patterns", () => {
    it("classifies dependabot email", () => {
      const result = classifyCommit(
        makeCommit({ authorEmail: "49699333+dependabot[bot]@users.noreply.github.com" })
      );
      expect(result.classification).toBe("dependabot");
    });

    it("classifies renovate email", () => {
      const result = classifyCommit(makeCommit({ authorEmail: "bot@renovateapp.com" }));
      expect(result.classification).toBe("renovate");
    });

    it("classifies generic [bot] email as other-bot", () => {
      const result = classifyCommit(
        makeCommit({ authorEmail: "something[bot]@users.noreply.github.com" })
      );
      expect(result.classification).toBe("other-bot");
    });

    it("classifies github-actions email (noreply@github.com + name=github)", () => {
      const result = classifyCommit(
        makeCommit({
          authorEmail: "noreply@github.com",
          authorName: "GitHub",
        })
      );
      expect(result.classification).toBe("github-actions");
    });

    it("classifies cursor agent by email domain", () => {
      const result = classifyCommit(makeCommit({ authorEmail: "cursoragent@cursor.com" }));
      expect(result.classification).toBe("cursor");
    });
  });

  // Level 3: Author login/name patterns
  describe("Level 3: Author login/name patterns", () => {
    it("classifies copilot by login", () => {
      const result = classifyCommit(makeCommit({ authorLogin: "copilot" }));
      expect(result.classification).toBe("copilot");
    });

    it("classifies devin-ai-integration by login", () => {
      const result = classifyCommit(makeCommit({ authorLogin: "devin-ai-integration" }));
      expect(result.classification).toBe("devin");
    });

    it("classifies github-actions by name pattern", () => {
      const result = classifyCommit(makeCommit({ authorName: "github-actions" }));
      expect(result.classification).toBe("github-actions");
    });

    it("classifies bare 'actions' login as github-actions", () => {
      const result = classifyCommit(makeCommit({ authorLogin: "actions" }));
      expect(result.classification).toBe("github-actions");
    });

    it("classifies qodo merge bot by login", () => {
      const result = classifyCommit(makeCommit({ authorLogin: "qodo-merge-pro[bot]" }));
      expect(result.classification).toBe("ai-assisted");
    });
  });

  // Level 4: Committer-based detection
  describe("Level 4: Committer-based bot detection", () => {
    it("classifies when committer is bot and message matches", () => {
      const result = classifyCommit(
        makeCommit({
          committerEmail: "something[bot]@users.noreply.github.com",
          message: "dependabot: bump lodash from 4.17.20 to 4.17.21",
        })
      );
      expect(result.classification).toBe("dependabot");
    });

    it("classifies when committer is GitHub noreply and message matches", () => {
      const result = classifyCommit(
        makeCommit({
          committerEmail: "noreply@github.com",
          committerName: "GitHub",
          message: "copilot-swe-agent: fix issue #42",
        })
      );
      expect(result.classification).toBe("copilot");
    });
  });

  // Level 5: Co-Authored-By trailers
  describe("Level 5: Co-Authored-By AI detection", () => {
    it("classifies Claude co-author as claude", () => {
      const result = classifyCommit(
        makeCommit({
          message: "fix: update handler\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
        })
      );
      expect(result.classification).toBe("claude");
    });

    it("classifies Cursor co-author as cursor", () => {
      const result = classifyCommit(
        makeCommit({
          message: "feat: add new route\n\nCo-authored-by: Cursor <cursoragent@cursor.com>",
        })
      );
      expect(result.classification).toBe("cursor");
    });

    it("classifies Copilot co-author as copilot", () => {
      const result = classifyCommit(
        makeCommit({
          message: "refactor: simplify logic\n\nCo-Authored-By: Copilot <copilot@github.com>",
        })
      );
      expect(result.classification).toBe("copilot");
    });

    it("classifies aider co-author as aider", () => {
      const result = classifyCommit(
        makeCommit({
          message: "fix: update tests\n\nCo-Authored-By: aider (gpt-4) <noreply@aider.chat>",
        })
      );
      expect(result.classification).toBe("aider");
    });

    it("extracts co-authors into result", () => {
      const result = classifyCommit(
        makeCommit({
          message: "feat: add feature\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
        })
      );
      expect(result.coAuthors).toEqual(["Claude <noreply@anthropic.com>"]);
    });
  });

  // Level 6: Commit message AI markers
  describe("Level 6: Commit message AI markers", () => {
    it('classifies "Generated with Claude Code" as claude', () => {
      const result = classifyCommit(
        makeCommit({
          message: "feat: add search\n\n🤖 Generated with Claude Code",
        })
      );
      expect(result.classification).toBe("claude");
    });

    it('classifies "Generated with Cursor" as cursor', () => {
      const result = classifyCommit(
        makeCommit({
          message: "fix: resolve bug\n\nGenerated with Cursor",
        })
      );
      expect(result.classification).toBe("cursor");
    });

    it('classifies "Generated by GitHub Copilot" as copilot', () => {
      const result = classifyCommit(
        makeCommit({
          message: "docs: update readme\n\nGenerated by GitHub Copilot",
        })
      );
      expect(result.classification).toBe("copilot");
    });

    it('classifies "aider:" prefix as aider', () => {
      const result = classifyCommit(
        makeCommit({
          message: "aider: refactored the error handling",
        })
      );
      expect(result.classification).toBe("aider");
    });

    it('classifies "AI-generated" as ai-assisted', () => {
      const result = classifyCommit(makeCommit({ message: "chore: AI-generated test stubs" }));
      expect(result.classification).toBe("ai-assisted");
    });
  });

  // Level 7: Author name AI suffixes
  describe("Level 7: Author name AI suffix", () => {
    it('classifies author name ending in "(aider)" as ai-assisted', () => {
      const result = classifyCommit(makeCommit({ authorName: "John Doe (aider)" }));
      expect(result.classification).toBe("ai-assisted");
    });
  });

  // Default: human
  describe("Default: human classification", () => {
    it("classifies regular commit as human", () => {
      const result = classifyCommit(makeCommit({}));
      expect(result.classification).toBe("human");
    });

    it("returns empty co-authors for human commit", () => {
      const result = classifyCommit(makeCommit({}));
      expect(result.coAuthors).toEqual([]);
    });

    it("classifies commit with non-AI co-author as human", () => {
      const result = classifyCommit(
        makeCommit({
          message: "feat: add feature\n\nCo-Authored-By: Bob <bob@example.com>",
        })
      );
      expect(result.classification).toBe("human");
      expect(result.coAuthors).toEqual(["Bob <bob@example.com>"]);
    });
  });

  // Priority ordering
  describe("Priority ordering", () => {
    it("Bot type wins over co-author trailer", () => {
      const result = classifyCommit(
        makeCommit({
          authorLogin: "dependabot[bot]",
          authorType: "Bot",
          message: "bump lodash\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
        })
      );
      expect(result.classification).toBe("dependabot");
    });

    it("Email pattern wins over message marker", () => {
      const result = classifyCommit(
        makeCommit({
          authorEmail: "cursoragent@cursor.com",
          message: "fix: thing\n\nGenerated by GitHub Copilot",
        })
      );
      expect(result.classification).toBe("cursor");
    });

    it("Co-author wins over message marker", () => {
      const result = classifyCommit(
        makeCommit({
          message:
            "fix: thing\n\nCo-Authored-By: Cursor <cursoragent@cursor.com>\n\nGenerated by GitHub Copilot",
        })
      );
      expect(result.classification).toBe("cursor");
    });
  });

  // Edge cases
  describe("Edge cases", () => {
    it("handles null author gracefully", () => {
      const commit: CommitPayload = {
        sha: "abc123",
        commit: {
          message: "fix: something",
          author: null,
          committer: null,
        },
        author: null,
        committer: null,
      };
      const result = classifyCommit(commit);
      expect(result.classification).toBe("human");
    });

    it("handles empty message", () => {
      const result = classifyCommit(makeCommit({ message: "" }));
      expect(result.classification).toBe("human");
    });

    it("classification does not depend on LOC", () => {
      // classifyCommit doesn't receive additions/deletions — it's purely
      // about authorship signals. LOC is aggregated separately.
      const result = classifyCommit(makeCommit({}));
      expect(result.classification).toBe("human");
    });
  });
});

// ─── Helper function tests ─────────────────────────────────────────────

describe("extractCoAuthors", () => {
  it("extracts single co-author", () => {
    const msg = "fix: thing\n\nCo-Authored-By: Claude <noreply@anthropic.com>";
    expect(extractCoAuthors(msg)).toEqual(["Claude <noreply@anthropic.com>"]);
  });

  it("extracts multiple co-authors", () => {
    const msg =
      "fix: thing\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nCo-authored-by: Bob <bob@example.com>";
    expect(extractCoAuthors(msg)).toEqual([
      "Claude <noreply@anthropic.com>",
      "Bob <bob@example.com>",
    ]);
  });

  it("is case-insensitive", () => {
    const msg = "fix\n\nco-authored-by: Someone <a@b.com>";
    expect(extractCoAuthors(msg)).toEqual(["Someone <a@b.com>"]);
  });

  it("returns empty array when no co-authors", () => {
    expect(extractCoAuthors("just a regular commit message")).toEqual([]);
  });
});

describe("extractPRNumber", () => {
  it('extracts PR number from squash merge "Title (#123)"', () => {
    expect(extractPRNumber("Fix the login bug (#456)")).toBe(456);
  });

  it('extracts PR number from merge commit "Merge pull request #123 from ..."', () => {
    expect(extractPRNumber("Merge pull request #789 from user/feature-branch")).toBe(789);
  });

  it("returns null for regular commit", () => {
    expect(extractPRNumber("fix: update readme")).toBeNull();
  });

  it("handles PR number with multi-line message", () => {
    expect(extractPRNumber("Add feature (#42)\n\nLong description here")).toBe(42);
  });
});

describe("matchBotPattern", () => {
  it("matches dependabot", () => {
    expect(matchBotPattern("dependabot[bot]")).toBe("dependabot");
  });

  it("matches renovate", () => {
    expect(matchBotPattern("renovate[bot]")).toBe("renovate");
  });

  it("matches copilot", () => {
    expect(matchBotPattern("copilot")).toBe("copilot");
  });

  it("matches cursoragent", () => {
    expect(matchBotPattern("cursoragent")).toBe("cursor");
  });

  it("matches cursoragent email", () => {
    expect(matchBotPattern("cursoragent@cursor.com")).toBe("cursor");
  });

  it("matches coderabbitai bot login", () => {
    expect(matchBotPattern("coderabbitai[bot]")).toBe("ai-assisted");
  });

  it("matches seer-by-sentry bot login", () => {
    expect(matchBotPattern("seer-by-sentry[bot]")).toBe("ai-assisted");
  });

  it("returns null for regular user", () => {
    expect(matchBotPattern("janedoe")).toBeNull();
  });
});

describe("hasAiCoAuthor", () => {
  it("returns true for Claude co-author", () => {
    expect(hasAiCoAuthor(["Claude <noreply@anthropic.com>"])).toBe(true);
  });

  it("returns true for Cursor co-author", () => {
    expect(hasAiCoAuthor(["Cursor <cursoragent@cursor.com>"])).toBe(true);
  });

  it("returns false for human co-author", () => {
    expect(hasAiCoAuthor(["Bob <bob@example.com>"])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasAiCoAuthor([])).toBe(false);
  });
});

describe("classifyAiCoAuthor", () => {
  it("identifies cursor from cursoragent email", () => {
    expect(classifyAiCoAuthor(["Cursor <cursoragent@cursor.com>"])).toBe("cursor");
  });

  it("identifies claude from anthropic email", () => {
    expect(classifyAiCoAuthor(["Claude <noreply@anthropic.com>"])).toBe("claude");
  });

  it("identifies copilot", () => {
    expect(classifyAiCoAuthor(["Copilot <copilot@github.com>"])).toBe("copilot");
  });

  it("identifies aider from aider.chat email", () => {
    expect(classifyAiCoAuthor(["aider (gpt-4) <noreply@aider.chat>"])).toBe("aider");
  });

  it("identifies coderabbit as ai-assisted", () => {
    expect(classifyAiCoAuthor(["CodeRabbit <bot@coderabbit.ai>"])).toBe("ai-assisted");
  });
});

describe("classifyAiMessageMarker", () => {
  it("identifies cursor from message", () => {
    expect(classifyAiMessageMarker("Generated with Cursor")).toBe("cursor");
  });

  it("identifies claude from message", () => {
    expect(classifyAiMessageMarker("Generated with Claude Code")).toBe("claude");
  });

  it("identifies copilot from message", () => {
    expect(classifyAiMessageMarker("Generated by GitHub Copilot")).toBe("copilot");
  });

  it("identifies coderabbit from message", () => {
    expect(classifyAiMessageMarker("Generated by CodeRabbit")).toBe("ai-assisted");
  });

  it("identifies seer from message", () => {
    expect(classifyAiMessageMarker("Generated by Seer")).toBe("ai-assisted");
  });

  it("returns null for non-AI message", () => {
    expect(classifyAiMessageMarker("fix: update readme")).toBeNull();
  });
});

describe("hasAiMessageMarker", () => {
  it("detects Generated with Claude Code", () => {
    expect(hasAiMessageMarker("feat: thing\n\nGenerated with Claude Code")).toBe(true);
  });

  it("detects aider: prefix", () => {
    expect(hasAiMessageMarker("aider: refactored error handling")).toBe(true);
  });

  it("detects AI-generated", () => {
    expect(hasAiMessageMarker("chore: AI-generated stubs")).toBe(true);
  });

  it("returns false for normal message", () => {
    expect(hasAiMessageMarker("fix: update readme")).toBe(false);
  });
});

describe("hasAiAuthorName", () => {
  it('detects "(aider)" suffix', () => {
    expect(hasAiAuthorName("John Doe (aider)")).toBe(true);
  });

  it("returns false for normal name", () => {
    expect(hasAiAuthorName("John Doe")).toBe(false);
  });
});

// ─── classificationToField ─────────────────────────────────────────────

describe("classificationToField", () => {
  it("maps all classifications correctly", () => {
    const expected: Record<Classification, string> = {
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

    for (const [classification, field] of Object.entries(expected)) {
      expect(classificationToField(classification as Classification)).toBe(field);
    }
  });
});
