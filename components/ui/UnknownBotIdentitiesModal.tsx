"use client";

import { Bot, X } from "lucide-react";
import { useEffect } from "react";
import type { BotBreakdownEntry } from "@/lib/unknownBots";

interface UnknownBotIdentitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  bots: BotBreakdownEntry[];
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function UnknownBotIdentitiesModal({
  isOpen,
  onClose,
  bots,
}: UnknownBotIdentitiesModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
              These identities are grouped under unknown automation. Use this list to add explicit
              mappings.
            </p>
          </div>
        </div>

        <div className="mt-6 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {bots.map((bot) => (
            <div
              key={`${bot.key}-${bot.label}`}
              className="rounded-xl border border-neutral-800 bg-black/30 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-neutral-200">{bot.label}</div>
                  <div className="mt-0.5 break-all font-mono text-[11px] text-neutral-500">
                    {bot.key}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-bold text-white">{formatNumber(bot.commits)}</div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                    Commits
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
