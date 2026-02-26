import { describe, expect, it } from "vitest";
import { classificationValidator } from "../validators";

describe("classificationValidator", () => {
  it("exports a validator object", () => {
    expect(classificationValidator).toBeDefined();
    // Convex validators expose a `kind` or internal structure
    expect(typeof classificationValidator).toBe("object");
  });

  it("has a union type (multiple members)", () => {
    // Convex v.union() creates a validator with `members` array
    const validator = classificationValidator as unknown as { members: unknown[] };
    expect(Array.isArray(validator.members)).toBe(true);
    expect(validator.members.length).toBeGreaterThan(5);
  });

  it("includes expected classification values", () => {
    // Each member of a v.union(v.literal("x"), ...) has a `value` property
    const validator = classificationValidator as unknown as {
      members: Array<{ value: string }>;
    };
    const values = validator.members.map((m) => m.value);

    expect(values).toContain("human");
    expect(values).toContain("copilot");
    expect(values).toContain("claude");
    expect(values).toContain("cursor");
    expect(values).toContain("dependabot");
    expect(values).toContain("renovate");
    expect(values).toContain("aider");
    expect(values).toContain("devin");
    expect(values).toContain("openai-codex");
    expect(values).toContain("gemini");
    expect(values).toContain("github-actions");
    expect(values).toContain("other-bot");
    expect(values).toContain("ai-assisted");
  });
});
