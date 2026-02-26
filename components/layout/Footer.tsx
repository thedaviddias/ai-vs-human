import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50/50 py-10 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="flex flex-col items-center gap-2 text-center lg:items-start lg:text-left">
            <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-neutral-900 text-[10px] text-white dark:bg-white dark:text-neutral-900">
                AH
              </div>
              <span>AI vs Human</span>
            </div>
            <p className="max-w-[30ch] text-sm leading-relaxed text-neutral-500">
              Analyze GitHub activity to see what's written by humans, AI assistants, and bots.
            </p>
            <a
              href="https://x.com/intent/follow?screen_name=thedaviddias"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-neutral-500 outline-none transition-colors hover:text-neutral-900 focus-visible:text-neutral-900 focus-visible:underline focus-visible:underline-offset-4 dark:hover:text-white dark:focus-visible:text-white"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Follow on X</span>
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-neutral-500 lg:justify-end">
            <Link
              href="/leaderboard"
              className="rounded-sm outline-none transition-colors hover:text-neutral-900 focus-visible:text-neutral-900 focus-visible:underline focus-visible:underline-offset-4 dark:hover:text-white dark:focus-visible:text-white"
            >
              Leaderboard
            </Link>
            <Link
              href="/docs"
              className="rounded-sm outline-none transition-colors hover:text-neutral-900 focus-visible:text-neutral-900 focus-visible:underline focus-visible:underline-offset-4 dark:hover:text-white dark:focus-visible:text-white"
            >
              Docs
            </Link>
            <a
              href="https://github.com/thedaviddias/ai-vs-human"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm outline-none transition-colors hover:text-neutral-900 focus-visible:text-neutral-900 focus-visible:underline focus-visible:underline-offset-4 dark:hover:text-white dark:focus-visible:text-white"
            >
              GitHub
            </a>
          </div>
        </div>
        <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
          <p className="text-center text-xs text-neutral-500">
            © {new Date().getFullYear()} AI vs Human. Build by{" "}
            <a
              href="https://thedaviddias.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm font-medium text-neutral-400 underline underline-offset-4 outline-none transition-colors hover:text-neutral-900 focus-visible:text-neutral-900 dark:hover:text-white dark:focus-visible:text-white"
            >
              David Dias
            </a>{" "}
            for the open source community.
          </p>
        </div>
      </div>
    </footer>
  );
}
