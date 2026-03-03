"use client";

import { Bot, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type BotMappingSuggestion,
  createBotMappingSuggestionFromEntry,
} from "@/lib/botMappingSuggestions";
import { type BotBreakdownEntry, extractActionableUnknownBotIdentities } from "@/lib/unknownBots";

interface UnknownBotIdentitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  bots: BotBreakdownEntry[];
  initialSelectedBotKey?: string | null;
  onSelectBot?: (bot: BotBreakdownEntry) => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

type SnippetSection = "detailed" | "known" | "visuals";

function getCopyButtonLabel(copiedSection: SnippetSection | null, section: SnippetSection): string {
  return copiedSection === section ? "Copied" : "Copy";
}

export function getUnknownBotModalBots(bots: BotBreakdownEntry[]): BotBreakdownEntry[] {
  return extractActionableUnknownBotIdentities(bots);
}

export function getUnknownBotMappingSuggestion(
  bots: BotBreakdownEntry[],
  selectedBotKey: string | null
): BotMappingSuggestion | null {
  if (!selectedBotKey) return null;
  const selectedBot = bots.find((bot) => bot.key === selectedBotKey);
  return selectedBot ? createBotMappingSuggestionFromEntry(selectedBot) : null;
}

export function UnknownBotIdentitiesModal({
  isOpen,
  onClose,
  bots,
  initialSelectedBotKey = null,
  onSelectBot,
}: UnknownBotIdentitiesModalProps) {
  const actionableBots = useMemo(() => getUnknownBotModalBots(bots), [bots]);
  const [selectedBotKey, setSelectedBotKey] = useState<string | null>(initialSelectedBotKey);
  const [copiedSection, setCopiedSection] = useState<SnippetSection | null>(null);

  const selectedSuggestion = useMemo(
    () => getUnknownBotMappingSuggestion(actionableBots, selectedBotKey),
    [actionableBots, selectedBotKey]
  );

  useEffect(() => {
    if (!isOpen) return;

    const preferredSelection =
      initialSelectedBotKey && actionableBots.some((bot) => bot.key === initialSelectedBotKey)
        ? initialSelectedBotKey
        : (actionableBots[0]?.key ?? null);
    setSelectedBotKey(preferredSelection);
    setCopiedSection(null);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, initialSelectedBotKey, actionableBots]);

  const handleCopy = useCallback(async (text: string, section: SnippetSection) => {
    if (!navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      window.setTimeout(() => {
        setCopiedSection((current) => (current === section ? null : current));
      }, 1200);
    } catch {
      // Clipboard access can fail in restricted contexts (e.g. insecure origins).
    }
  }, []);

  const handleSelectBot = useCallback(
    (bot: BotBreakdownEntry) => {
      setSelectedBotKey(bot.key);
      onSelectBot?.(bot);
    },
    [onSelectBot]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 text-neutral-500 transition-colors hover:text-white"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Bot className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white">Unknown Bot Identities</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Select an unmapped identity to generate ready-to-add classifier snippets.
            </p>
          </div>
        </div>

        <div className="mt-6 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {actionableBots.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-black/30 px-4 py-3 text-sm text-neutral-400">
              No actionable unknown bot identities found.
            </div>
          ) : (
            <div className="space-y-2">
              {actionableBots.map((bot) => (
                <button
                  type="button"
                  key={`${bot.key}-${bot.label}`}
                  onClick={() => handleSelectBot(bot)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedBotKey === bot.key
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-neutral-800 bg-black/30 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-neutral-200">
                        {bot.label}
                      </div>
                      <div className="mt-0.5 break-all font-mono text-[11px] text-neutral-500">
                        {bot.key}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-bold text-white">
                        {formatNumber(bot.commits)}
                      </div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                        Commits
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedSuggestion && (
            <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-amber-300">
                  Mapping Suggestion
                </div>
                <div className="mt-1 text-sm font-semibold text-amber-100">
                  {selectedSuggestion.inputLabel} ({selectedSuggestion.inputKey})
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-medium text-amber-100">
                    Add to `convex/classification/detailedBreakdown.ts`
                  </div>
                  <button
                    type="button"
                    className="rounded border border-amber-500/30 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:border-amber-400/40"
                    onClick={() =>
                      handleCopy(selectedSuggestion.detailedBreakdownSnippet, "detailed")
                    }
                  >
                    {getCopyButtonLabel(copiedSection, "detailed")}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded bg-black/40 p-3 font-mono text-[11px] text-amber-100">
                  {selectedSuggestion.detailedBreakdownSnippet}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-medium text-amber-100">
                    Add to `convex/classification/knownBots.ts`
                  </div>
                  <button
                    type="button"
                    className="rounded border border-amber-500/30 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:border-amber-400/40"
                    onClick={() => handleCopy(selectedSuggestion.knownBotsSnippet, "known")}
                  >
                    {getCopyButtonLabel(copiedSection, "known")}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded bg-black/40 p-3 font-mono text-[11px] text-amber-100">
                  {selectedSuggestion.knownBotsSnippet}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-medium text-amber-100">
                    Optional metadata in `components/charts/BotToolBreakdown.tsx`
                  </div>
                  <button
                    type="button"
                    className="rounded border border-amber-500/30 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:border-amber-400/40"
                    onClick={() => handleCopy(selectedSuggestion.botVisualsSnippet, "visuals")}
                  >
                    {getCopyButtonLabel(copiedSection, "visuals")}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded bg-black/40 p-3 font-mono text-[11px] text-amber-100">
                  {selectedSuggestion.botVisualsSnippet}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
