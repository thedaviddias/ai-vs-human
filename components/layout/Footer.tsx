import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50/50 py-12 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-neutral-900 text-[10px] text-white dark:bg-white dark:text-neutral-900">
                AH
              </div>
              <span>AI vs Human</span>
            </div>
            <p className="text-sm text-neutral-500">Visualizing the rise of AI in open source.</p>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-neutral-500">
            <Link
              href="/leaderboard"
              className="transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              Leaderboard
            </Link>
            <Link
              href="/docs/ranks"
              className="transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              Ranks
            </Link>
            <Link
              href="/docs"
              className="transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              Docs
            </Link>
            <a
              href="https://github.com/thedaviddias/ai-vs-human"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              GitHub
            </a>
          </div>
        </div>
        <div className="mt-8 border-t border-neutral-200 pt-8 dark:border-neutral-800">
          <p className="text-center text-xs text-neutral-400">
            © {new Date().getFullYear()} AI vs Human. Build by{" "}
            <a
              href="https://thedaviddias.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4 transition-colors hover:text-neutral-900 dark:hover:text-white"
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
