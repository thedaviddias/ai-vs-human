"use client";

import { useMutation, useQuery } from "convex/react";
import { Bot, Check, Pencil, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/tracking";

const AI_TOOLS = [
  { key: "copilot", label: "GitHub Copilot" },
  { key: "cursor", label: "Cursor" },
  { key: "claude-code", label: "Claude Code" },
  { key: "aider", label: "Aider" },
  { key: "devin", label: "Devin" },
  { key: "gemini", label: "Gemini" },
  { key: "windsurf", label: "Windsurf" },
  { key: "cody", label: "Sourcegraph Cody" },
  { key: "tabnine", label: "Tabnine" },
  { key: "other", label: "Other" },
] as const;

interface SelfReportCardProps {
  githubLogin: string;
  isOwnProfile: boolean;
}

export function SelfReportCard({ githubLogin, isOwnProfile }: SelfReportCardProps) {
  const selfReport = useQuery(api.queries.selfReport.getSelfReport, { githubLogin });
  const saveSelfReport = useMutation(api.mutations.selfReport.saveSelfReport);
  const deleteSelfReport = useMutation(api.mutations.selfReport.deleteSelfReport);

  const [isEditing, setIsEditing] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [percentage, setPercentage] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = useCallback(() => {
    setSelectedTools(selfReport?.tools ?? []);
    setPercentage(selfReport?.estimatedPercentage ?? undefined);
    setIsEditing(true);
  }, [selfReport]);

  const handleToggleTool = useCallback((tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (selectedTools.length === 0) return;
    setIsSaving(true);
    try {
      await saveSelfReport({
        tools: selectedTools,
        estimatedPercentage: percentage,
      });
      trackEvent("self_report_submit", {
        toolCount: selectedTools.length,
        hasPercentage: percentage !== undefined,
      });
      setIsEditing(false);
    } catch {
      // Silent fail — mutation shows error in console
    } finally {
      setIsSaving(false);
    }
  }, [selectedTools, percentage, saveSelfReport]);

  const handleDelete = useCallback(async () => {
    setIsSaving(true);
    try {
      await deleteSelfReport({});
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [deleteSelfReport]);

  // Read-only display for visitors
  if (!isOwnProfile) {
    if (!selfReport) return null;
    return (
      <div className="rounded-xl border border-dashed border-purple-800/40 bg-purple-950/10 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-purple-400/70">
          <Bot className="h-3.5 w-3.5" />
          <span className="font-semibold uppercase tracking-widest">Self-Reported</span>
        </div>
        <p className="mt-1.5 text-sm text-neutral-300">
          Uses{" "}
          <span className="font-medium text-purple-300">
            {selfReport.tools
              .map((t: string) => AI_TOOLS.find((at) => at.key === t)?.label ?? t)
              .join(", ")}
          </span>
          {selfReport.estimatedPercentage != null && (
            <span className="text-neutral-500">
              {" "}
              (~{selfReport.estimatedPercentage}% AI-assisted)
            </span>
          )}
        </p>
      </div>
    );
  }

  // Owner view — editing mode
  if (isEditing) {
    return (
      <div className="rounded-xl border border-dashed border-purple-800/40 bg-purple-950/10 p-4">
        <div className="flex items-center gap-2 text-xs text-purple-400/70">
          <Bot className="h-3.5 w-3.5" />
          <span className="font-semibold uppercase tracking-widest">Self-Report AI Usage</span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Select the AI tools you use. This is displayed alongside your detected stats.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {AI_TOOLS.map((tool) => (
            <button
              key={tool.key}
              type="button"
              onClick={() => handleToggleTool(tool.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                selectedTools.includes(tool.key)
                  ? "border-purple-500/50 bg-purple-500/20 text-purple-300"
                  : "border-neutral-800 bg-neutral-900/50 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
              }`}
            >
              {tool.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <label className="text-xs text-neutral-500" htmlFor="self-report-pct">
            Estimated AI-assisted % (optional)
          </label>
          <input
            id="self-report-pct"
            type="number"
            min={0}
            max={100}
            value={percentage ?? ""}
            onChange={(e) =>
              setPercentage(e.target.value === "" ? undefined : Number(e.target.value))
            }
            placeholder="e.g. 40"
            className="mt-1 w-24 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:border-purple-500/50 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={selectedTools.length === 0 || isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-300"
          >
            Cancel
          </button>
          {selfReport && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-red-500/70 transition-colors hover:text-red-400 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          )}
        </div>
      </div>
    );
  }

  // Owner view — display mode (with edit button)
  if (selfReport) {
    return (
      <div className="rounded-xl border border-dashed border-purple-800/40 bg-purple-950/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-purple-400/70">
            <Bot className="h-3.5 w-3.5" />
            <span className="font-semibold uppercase tracking-widest">Self-Reported</span>
          </div>
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1 text-xs text-neutral-600 transition-colors hover:text-neutral-300"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        </div>
        <p className="mt-1.5 text-sm text-neutral-300">
          Uses{" "}
          <span className="font-medium text-purple-300">
            {selfReport.tools
              .map((t: string) => AI_TOOLS.find((at) => at.key === t)?.label ?? t)
              .join(", ")}
          </span>
          {selfReport.estimatedPercentage != null && (
            <span className="text-neutral-500">
              {" "}
              (~{selfReport.estimatedPercentage}% AI-assisted)
            </span>
          )}
        </p>
      </div>
    );
  }

  // Owner view — no report yet
  return (
    <button
      type="button"
      onClick={startEditing}
      className="w-full rounded-xl border border-dashed border-neutral-800 bg-neutral-900/20 px-4 py-3 text-left transition-colors hover:border-purple-800/40 hover:bg-purple-950/10"
    >
      <div className="flex items-center gap-2 text-xs text-neutral-600">
        <Bot className="h-3.5 w-3.5" />
        <span className="font-semibold uppercase tracking-widest">
          Using AI tools? Let others know
        </span>
      </div>
      <p className="mt-1 text-xs text-neutral-600">
        Self-report your AI tool usage. Shown alongside your detected stats.
      </p>
    </button>
  );
}
