"use client";

import { FileCode, FolderSearch, Link as LinkIcon, Wand2 } from "lucide-react";

interface AiConfig {
  tool: string;
  type: string;
  name: string;
}

interface AiConfigStackProps {
  configs: AiConfig[];
}

export function AiConfigStack({ configs }: AiConfigStackProps) {
  if (!configs || configs.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">
          Detected AI Tools & Agents
        </h3>
        <div className="h-px flex-1 bg-neutral-800/50" />
      </div>

      <div className="flex flex-wrap gap-2">
        {configs.map((config, index) => {
          const isSkill = config.tool === "skills.sh" || config.type === "Skill";
          const skillUrl = isSkill ? `https://skills.sh/skill/${config.name}` : null;

          const content = (
            <>
              {isSkill ? (
                <Wand2 className="h-3 w-3 text-purple-400" />
              ) : config.type === "Rule File" || config.type === "Rule" ? (
                <FileCode className="h-3 w-3 text-blue-400" />
              ) : (
                <FolderSearch className="h-3 w-3 text-neutral-400" />
              )}
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-neutral-100">{config.name}</span>
                <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-tighter">
                  {config.tool}
                </span>
              </div>
              {isSkill && (
                <LinkIcon className="h-2.5 w-2.5 text-neutral-600 group-hover:text-purple-400 transition-colors" />
              )}
            </>
          );

          const className = `group flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-xs transition-all hover:border-neutral-700 hover:bg-neutral-900 ${isSkill ? "hover:ring-1 hover:ring-purple-500/30" : ""}`;

          if (skillUrl) {
            return (
              <a
                key={`${config.tool}-${config.name}-${index}`}
                href={skillUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {content}
              </a>
            );
          }

          return (
            <div key={`${config.tool}-${config.name}-${index}`} className={className}>
              {content}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-neutral-600 font-medium italic">
        Detected via repository configuration files and agent skill directories.
      </p>
    </div>
  );
}
