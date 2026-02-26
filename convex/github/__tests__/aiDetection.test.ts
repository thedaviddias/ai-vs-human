import { describe, expect, it, vi } from "vitest";
import { detectAiConfigs, type GitHubTreeItem } from "../aiDetection";

describe("detectAiConfigs", () => {
  it("detects direct root files", async () => {
    const rootItems: GitHubTreeItem[] = [
      { path: ".cursorrules", type: "blob", url: "url1" },
      { path: "CLAUDE.md", type: "blob", url: "url2" },
      { path: "README.md", type: "blob", url: "url3" },
    ];

    const fetchSubTree = vi.fn();

    const configs = await detectAiConfigs(rootItems, fetchSubTree);
    expect(configs).toHaveLength(2);
    expect(configs).toContainEqual({ tool: "Cursor", type: "Rule File", name: ".cursorrules" });
    expect(configs).toContainEqual({ tool: "Claude Code", type: "Rule File", name: "CLAUDE.md" });
    expect(fetchSubTree).not.toHaveBeenCalled();
  });

  it("detects skills.sh agents within folders", async () => {
    const rootItems: GitHubTreeItem[] = [{ path: ".agents", type: "tree", url: "agents_url" }];

    const fetchSubTree = vi.fn().mockImplementation(async (url) => {
      if (url === "agents_url") {
        return [{ path: "skills", type: "tree", url: "skills_url" }];
      }
      if (url === "skills_url") {
        return [
          { path: "geo-seo", type: "tree", url: "geo_url" },
          { path: "security.md", type: "blob", url: "sec_url" },
          { path: "README.md", type: "blob", url: "readme_url" },
          { path: ".hidden", type: "blob", url: "hidden_url" },
        ];
      }
      return null;
    });

    const configs = await detectAiConfigs(rootItems, fetchSubTree);
    expect(configs).toHaveLength(2);
    expect(configs).toContainEqual({ tool: "skills.sh", type: "Skill", name: "geo-seo" });
    expect(configs).toContainEqual({ tool: "skills.sh", type: "Skill", name: "security" });
  });

  it("detects github copilot nested instructions", async () => {
    const rootItems: GitHubTreeItem[] = [{ path: ".github", type: "tree", url: "github_url" }];

    const fetchSubTree = vi.fn().mockImplementation(async (url) => {
      if (url === "github_url") {
        return [{ path: "copilot-instructions.md", type: "blob", url: "copilot_url" }];
      }
      return null;
    });

    const configs = await detectAiConfigs(rootItems, fetchSubTree);
    expect(configs).toHaveLength(1);
    expect(configs).toContainEqual({
      tool: "Copilot",
      type: "Rule File",
      name: ".github/copilot-instructions.md",
    });
  });

  it("returns empty array when nothing is found", async () => {
    const rootItems: GitHubTreeItem[] = [
      { path: "src", type: "tree", url: "src_url" },
      { path: "package.json", type: "blob", url: "pkg_url" },
    ];

    const fetchSubTree = vi.fn();

    const configs = await detectAiConfigs(rootItems, fetchSubTree);
    expect(configs).toHaveLength(0);
  });
});
