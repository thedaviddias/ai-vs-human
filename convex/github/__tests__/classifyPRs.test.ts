import { describe, expect, it } from "vitest";
import { classifyPRAuthor, type PRData } from "../classifyPRs";

// ─── Test helpers ──────────────────────────────────────────────────────

/** Builds a minimal PRData with sensible defaults. */
function makePR(
  overrides: Partial<{
    login: string;
    userType: string;
    body: string | null;
    labels: string[];
    branch: string;
  }>
): PRData {
  return {
    number: 1,
    user: {
      login: overrides.login ?? "janedoe",
      type: overrides.userType ?? "User",
    },
    body: overrides.body ?? null,
    labels: (overrides.labels ?? []).map((name) => ({ name })),
    head: {
      ref: overrides.branch ?? "main",
    },
  };
}

// ─── classifyPRAuthor ──────────────────────────────────────────────────

describe("classifyPRAuthor", () => {
  // Level 1: Bot account type + known login
  describe("Bot account type with known login", () => {
    it('classifies copilot bot (type "Bot")', () => {
      expect(classifyPRAuthor(makePR({ login: "copilot", userType: "Bot" }))).toBe("copilot");
    });

    it('classifies copilot-swe-agent (type "Bot")', () => {
      expect(classifyPRAuthor(makePR({ login: "copilot-swe-agent", userType: "Bot" }))).toBe(
        "copilot"
      );
    });

    it('classifies cursor-agent (type "Bot")', () => {
      expect(classifyPRAuthor(makePR({ login: "cursor-agent", userType: "Bot" }))).toBe("cursor");
    });

    it('classifies devin-ai-integration (type "Bot")', () => {
      expect(classifyPRAuthor(makePR({ login: "devin-ai-integration", userType: "Bot" }))).toBe(
        "devin"
      );
    });

    it('classifies unknown bot with type "Bot" as ai-assisted fallback', () => {
      expect(classifyPRAuthor(makePR({ login: "some-new-ai-bot", userType: "Bot" }))).toBe(
        "ai-assisted"
      );
    });

    it('classifies coderabbit (type "Bot") as other-bot', () => {
      expect(classifyPRAuthor(makePR({ login: "coderabbit", userType: "Bot" }))).toBe("other-bot");
    });

    it('classifies sentry (type "Bot") as other-bot', () => {
      expect(classifyPRAuthor(makePR({ login: "sentry", userType: "Bot" }))).toBe("other-bot");
    });
  });

  // Level 2: User type + known login pattern
  describe("User type with known login pattern", () => {
    it('classifies copilot login even with type "User"', () => {
      expect(classifyPRAuthor(makePR({ login: "copilot", userType: "User" }))).toBe("copilot");
    });

    it("classifies [bot] suffix login", () => {
      expect(classifyPRAuthor(makePR({ login: "something[bot]" }))).toBe("ai-assisted");
    });

    it("classifies gemini-code-assist login", () => {
      expect(classifyPRAuthor(makePR({ login: "gemini-code-assist" }))).toBe("gemini");
    });

    it("classifies amazon-q-developer login", () => {
      expect(classifyPRAuthor(makePR({ login: "amazon-q-developer" }))).toBe("ai-assisted");
    });
  });

  // Level 3: Branch name patterns
  describe("Branch name patterns", () => {
    it("classifies cursor/ branch as cursor", () => {
      expect(classifyPRAuthor(makePR({ branch: "cursor/fix-bug" }))).toBe("cursor");
    });

    it("classifies copilot/ branch as copilot", () => {
      expect(classifyPRAuthor(makePR({ branch: "copilot/add-feature" }))).toBe("copilot");
    });

    it("classifies devin/ branch as devin", () => {
      expect(classifyPRAuthor(makePR({ branch: "devin/implement-search" }))).toBe("devin");
    });

    it("classifies codex/ branch as openai-codex", () => {
      expect(classifyPRAuthor(makePR({ branch: "codex/refactor-auth" }))).toBe("openai-codex");
    });

    it("classifies sweep/ branch as ai-assisted", () => {
      expect(classifyPRAuthor(makePR({ branch: "sweep/update-deps" }))).toBe("ai-assisted");
    });

    it("classifies windsurf/ branch as ai-assisted", () => {
      expect(classifyPRAuthor(makePR({ branch: "windsurf/new-feature" }))).toBe("ai-assisted");
    });

    it("classifies ai-/ branch as ai-assisted", () => {
      expect(classifyPRAuthor(makePR({ branch: "ai-generated-fix" }))).toBe("ai-assisted");
    });

    it("classifies ai/ branch as ai-assisted", () => {
      expect(classifyPRAuthor(makePR({ branch: "ai/refactor" }))).toBe("ai-assisted");
    });

    it("classifies coderabbit/ branch as other-bot", () => {
      expect(classifyPRAuthor(makePR({ branch: "coderabbit/review" }))).toBe("other-bot");
    });
  });

  // Level 4: PR body patterns
  describe("PR body AI markers", () => {
    it('detects "Generated with Cursor"', () => {
      expect(classifyPRAuthor(makePR({ body: "This PR was\n\nGenerated with Cursor" }))).toBe(
        "cursor"
      );
    });

    it('detects "[Cursor]"', () => {
      expect(classifyPRAuthor(makePR({ body: "[Cursor] Fixed the bug" }))).toBe("cursor");
    });

    it('detects "Generated with Claude Code"', () => {
      expect(classifyPRAuthor(makePR({ body: "🤖 Generated with Claude Code" }))).toBe("claude");
    });

    it('detects "Generated with Claude"', () => {
      expect(classifyPRAuthor(makePR({ body: "Generated with Claude" }))).toBe("claude");
    });

    it('detects "Generated by GitHub Copilot"', () => {
      expect(classifyPRAuthor(makePR({ body: "Generated by GitHub Copilot" }))).toBe("copilot");
    });

    it('detects "Generated by Copilot"', () => {
      expect(classifyPRAuthor(makePR({ body: "Generated by Copilot" }))).toBe("copilot");
    });

    it('detects "Created by Devin"', () => {
      expect(classifyPRAuthor(makePR({ body: "Created by Devin" }))).toBe("devin");
    });

    it('detects "AI-generated"', () => {
      expect(classifyPRAuthor(makePR({ body: "This is an AI-generated PR" }))).toBe("ai-assisted");
    });

    it("detects Co-authored-by with AI tool name", () => {
      expect(
        classifyPRAuthor(makePR({ body: "Co-authored-by: Claude <noreply@anthropic.com>" }))
      ).toBe("ai-assisted");
    });

    it('detects "🤖 Generated with" pattern', () => {
      expect(classifyPRAuthor(makePR({ body: "🤖 Generated with some-tool" }))).toBe("ai-assisted");
    });
  });

  // Level 5: PR labels
  describe("PR label patterns", () => {
    it('detects "ai-generated" label', () => {
      expect(classifyPRAuthor(makePR({ labels: ["ai-generated"] }))).toBe("ai-assisted");
    });

    it('detects "copilot" label', () => {
      expect(classifyPRAuthor(makePR({ labels: ["copilot"] }))).toBe("ai-assisted");
    });

    it('detects "automated" label', () => {
      expect(classifyPRAuthor(makePR({ labels: ["automated"] }))).toBe("ai-assisted");
    });

    it("ignores non-AI labels", () => {
      expect(classifyPRAuthor(makePR({ labels: ["bug", "enhancement", "v2"] }))).toBeNull();
    });
  });

  // Priority ordering
  describe("Priority ordering", () => {
    it("author type wins over branch name", () => {
      expect(
        classifyPRAuthor(makePR({ login: "copilot", userType: "Bot", branch: "cursor/fix" }))
      ).toBe("copilot");
    });

    it("login pattern wins over body marker", () => {
      expect(classifyPRAuthor(makePR({ login: "copilot", body: "Generated with Cursor" }))).toBe(
        "copilot"
      );
    });

    it("branch wins over body", () => {
      expect(classifyPRAuthor(makePR({ branch: "cursor/fix", body: "Generated by Copilot" }))).toBe(
        "cursor"
      );
    });

    it("body wins over label", () => {
      expect(
        classifyPRAuthor(
          makePR({
            body: "Generated with Cursor",
            labels: ["automated"],
          })
        )
      ).toBe("cursor");
    });
  });

  // No match
  describe("No match", () => {
    it("returns null for regular human PR", () => {
      expect(classifyPRAuthor(makePR({}))).toBeNull();
    });

    it("returns null with regular branch and body", () => {
      expect(
        classifyPRAuthor(
          makePR({
            branch: "feature/add-login",
            body: "Implemented login feature with tests",
          })
        )
      ).toBeNull();
    });

    it("returns null with non-AI labels", () => {
      expect(classifyPRAuthor(makePR({ labels: ["bug", "priority-high"] }))).toBeNull();
    });
  });
});
