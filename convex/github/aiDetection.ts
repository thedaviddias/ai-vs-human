export interface AiConfig {
  tool: string;
  type: string;
  name: string;
}

export interface GitHubTreeItem {
  path: string;
  type: string;
  url: string;
}

export async function detectAiConfigs(
  rootItems: GitHubTreeItem[],
  fetchSubTree: (url: string) => Promise<GitHubTreeItem[] | null>
): Promise<AiConfig[]> {
  const aiConfigs: AiConfig[] = [];

  // 1. Direct file detection
  const fileMappings: Record<string, { tool: string; type: string }> = {
    ".cursorrules": { tool: "Cursor", type: "Rule File" },
    ".windsurfrules": { tool: "Windsurf", type: "Rule File" },
    "CLAUDE.md": { tool: "Claude Code", type: "Rule File" },
    "CLAUDE.local.md": { tool: "Claude Code", type: "Rule File" },
    "copilot-instructions.md": { tool: "Copilot", type: "Rule File" },
    ".aider.conf.yml": { tool: "Aider", type: "Config" },
    ".aider.chat.history.md": { tool: "Aider", type: "Chat History" },
    ".roomd": { tool: "Roo Code", type: "Rule File" },
    "sweep.yaml": { tool: "Sweep", type: "Config" },
    ".coderabbit.yaml": { tool: "CodeRabbit", type: "Config" },
    ".mutable.yaml": { tool: "MutableAI", type: "Config" },
  };

  for (const item of rootItems) {
    if (fileMappings[item.path]) {
      aiConfigs.push({
        tool: fileMappings[item.path].tool,
        type: fileMappings[item.path].type,
        name: item.path,
      });
    }
  }

  // 2. Folder-based detection (Skills/Rules)
  const folderMappings: Record<string, { tool: string; type: string; subPath: string }> = {
    ".agents": { tool: "skills.sh", type: "Skill", subPath: "skills" },
    ".claude": { tool: "skills.sh", type: "Skill", subPath: "skills" },
    ".codex": { tool: "skills.sh", type: "Skill", subPath: "skills" },
    ".cursor": { tool: "Cursor", type: "Rule", subPath: "rules" },
    ".windsurf": { tool: "Windsurf", type: "Rule", subPath: "rules" },
    ".roo": { tool: "Roo Code", type: "Rule", subPath: "rules" },
    ".github": { tool: "Copilot", type: "Rule File", subPath: "copilot-instructions.md" },
  };

  for (const [folderName, config] of Object.entries(folderMappings)) {
    const folderItem = rootItems.find((i) => i.path === folderName && i.type === "tree");
    if (folderItem) {
      const subItems = await fetchSubTree(folderItem.url);
      if (subItems) {
        const target = subItems.find((i) => i.path === config.subPath);

        if (target && target.type === "tree") {
          const targetItems = await fetchSubTree(target.url);
          if (targetItems) {
            for (const ti of targetItems) {
              if (ti.type === "tree" || (ti.type === "blob" && ti.path.endsWith(".md"))) {
                if (!ti.path.startsWith(".") && ti.path !== "README.md") {
                  aiConfigs.push({
                    tool: config.tool,
                    type: config.type,
                    name: ti.path.replace(".md", ""),
                  });
                }
              }
            }
          }
        } else if (target && target.type === "blob" && config.tool === "Copilot") {
          aiConfigs.push({
            tool: "Copilot",
            type: "Rule File",
            name: ".github/copilot-instructions.md",
          });
        }
      }
    }
  }

  return aiConfigs;
}
