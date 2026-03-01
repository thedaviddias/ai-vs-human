"use client";

import { Bot, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

interface AttributionGuidanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLearnMore: () => void;
}

export function AttributionGuidanceModal({
  isOpen,
  onClose,
  onLearnMore,
}: AttributionGuidanceModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 text-neutral-500 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
            <Bot className="h-8 w-8" />
          </div>

          <h3 className="mb-2 text-xl font-bold text-white">Understanding Your AI Score</h3>
          <p className="mb-4 text-sm leading-relaxed text-neutral-400">
            Your AI score reflects{" "}
            <span className="text-neutral-200">detected attribution markers</span> in commits — not
            total AI usage. Tools like GitHub Copilot autocomplete don&apos;t add markers by
            default, so your actual AI usage may be higher than shown.
          </p>

          <div className="mb-6 w-full rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
              Enable attribution in
            </p>
            <ul className="space-y-1.5 text-sm text-neutral-300">
              <li>
                <span className="text-purple-400">Copilot</span> — add Co-Authored-By trailers
              </li>
              <li>
                <span className="text-purple-400">Cursor</span> — enabled by default in Agent mode
              </li>
              <li>
                <span className="text-purple-400">Claude Code</span> — enabled by default
              </li>
            </ul>
          </div>

          <div className="flex w-full flex-col gap-3">
            <Link
              href="/docs/attribution"
              onClick={onLearnMore}
              className="w-full rounded-xl bg-white py-3.5 text-center text-sm font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98]"
            >
              Learn How to Enable Attribution
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
