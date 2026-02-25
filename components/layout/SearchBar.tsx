"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSound } from "@/lib/hooks/useSound";
import { parseRepoInput } from "@/lib/parseRepoInput";
import { trackEvent } from "@/lib/tracking";

export function SearchBar() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { playSuccess, playError } = useSound();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = parseRepoInput(input);
    if (!parsed) {
      setError("Enter a GitHub username or owner/repo (e.g., thedaviddias or facebook/react)");
      playError();
      return;
    }

    trackEvent("search", { query: input.trim() });
    playSuccess();

    if (parsed.type === "user") {
      router.push(`/${parsed.owner}`);
    } else {
      router.push(`/${parsed.owner}/${parsed.name}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl px-4 sm:px-0">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          placeholder="Search username or repo..."
          className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-4 pl-12 pr-32 text-base transition-all focus:border-neutral-600 focus:outline-none focus:ring-0 text-neutral-100"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black transition-all hover:bg-neutral-200 active:scale-95 disabled:opacity-50"
          >
            Analyze
          </button>
        </div>
      </div>
      {error && <p className="mt-3 text-center text-sm font-medium text-red-500">{error}</p>}
    </form>
  );
}
