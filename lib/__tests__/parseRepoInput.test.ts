import { describe, expect, it } from "vitest";
import { parseRepoInput } from "../parseRepoInput";

describe("parseRepoInput", () => {
  // ─── owner/repo format ────────────────────────────────────────────────
  describe("owner/repo format", () => {
    it("parses simple owner/repo", () => {
      expect(parseRepoInput("facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses owner/repo with dots and hyphens", () => {
      expect(parseRepoInput("some-org/my-lib.js")).toEqual({
        type: "repo",
        owner: "some-org",
        name: "my-lib.js",
      });
    });

    it("parses owner/repo with underscores", () => {
      expect(parseRepoInput("my_org/my_repo")).toEqual({
        type: "repo",
        owner: "my_org",
        name: "my_repo",
      });
    });

    it("trims leading/trailing whitespace", () => {
      expect(parseRepoInput("  facebook/react  ")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("strips trailing slashes", () => {
      expect(parseRepoInput("facebook/react/")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });
  });

  // ─── GitHub URL with repo ─────────────────────────────────────────────
  describe("GitHub URL with repo", () => {
    it("parses https URL", () => {
      expect(parseRepoInput("https://github.com/facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses http URL", () => {
      expect(parseRepoInput("http://github.com/facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses URL with www", () => {
      expect(parseRepoInput("https://www.github.com/facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses URL without protocol", () => {
      expect(parseRepoInput("github.com/facebook/react")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });

    it("parses URL with trailing slash", () => {
      expect(parseRepoInput("https://github.com/facebook/react/")).toEqual({
        type: "repo",
        owner: "facebook",
        name: "react",
      });
    });
  });

  // ─── GitHub URL with just username ────────────────────────────────────
  describe("GitHub URL with username only", () => {
    it("parses https URL with username", () => {
      expect(parseRepoInput("https://github.com/thedaviddias")).toEqual({
        type: "user",
        owner: "thedaviddias",
      });
    });

    it("parses URL with trailing slash", () => {
      expect(parseRepoInput("https://github.com/thedaviddias/")).toEqual({
        type: "user",
        owner: "thedaviddias",
      });
    });

    it("parses URL without protocol (ambiguous — treated as owner/repo)", () => {
      // Without a protocol prefix, "github.com/thedaviddias" matches
      // the owner/repo pattern first (github.com is a valid owner name).
      // Users should include https:// for URL parsing.
      expect(parseRepoInput("github.com/thedaviddias")).toEqual({
        type: "repo",
        owner: "github.com",
        name: "thedaviddias",
      });
    });
  });

  // ─── Plain username ───────────────────────────────────────────────────
  describe("plain username", () => {
    it("parses simple username", () => {
      expect(parseRepoInput("thedaviddias")).toEqual({
        type: "user",
        owner: "thedaviddias",
      });
    });

    it("parses username with hyphens", () => {
      expect(parseRepoInput("the-david-dias")).toEqual({
        type: "user",
        owner: "the-david-dias",
      });
    });

    it("parses single character username", () => {
      expect(parseRepoInput("a")).toEqual({
        type: "user",
        owner: "a",
      });
    });

    it("parses username with numbers", () => {
      expect(parseRepoInput("user123")).toEqual({
        type: "user",
        owner: "user123",
      });
    });
  });

  // ─── Invalid inputs ───────────────────────────────────────────────────
  describe("invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(parseRepoInput("")).toBeNull();
    });

    it("returns null for whitespace only", () => {
      expect(parseRepoInput("   ")).toBeNull();
    });

    it("returns null for username starting with hyphen", () => {
      expect(parseRepoInput("-invalid")).toBeNull();
    });

    it("returns null for username ending with hyphen", () => {
      expect(parseRepoInput("invalid-")).toBeNull();
    });

    it("returns null for input with spaces", () => {
      expect(parseRepoInput("invalid user")).toBeNull();
    });

    it("returns null for input with special characters", () => {
      expect(parseRepoInput("user@name")).toBeNull();
    });
  });
});
