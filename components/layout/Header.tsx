"use client";

import Link from "next/link";
import { GithubStars } from "./GithubStars";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-black">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-white sm:text-xl"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white text-black shadow transition-transform group-hover:scale-105">
            <span className="text-xs font-black">AH</span>
          </div>
          <span>AI vs Human</span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-6">
          <GithubStars />
          <a
            href="https://x.com/thedaviddias"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 transition-colors hover:text-white"
            aria-label="Follow on X"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              role="img"
              aria-label="X (formerly Twitter)"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <Link
            href="/leaderboard"
            className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            Leaderboard
          </Link>
          <Link
            href="/docs"
            className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            Docs
          </Link>
        </div>
      </div>
    </header>
  );
}
