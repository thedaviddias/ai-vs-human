import { SearchBar } from "./SearchBar";

export function Hero() {
  return (
    <div className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl">AI vs Human</h1>
        <p className="mt-6 text-lg leading-8 text-neutral-400">
          Unveiling the ghost in the machine. Analyze any GitHub repository to see the real
          breakdown of commits by humans, AI assistants, and automated bots.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-y-6">
          <SearchBar />
          <div className="flex items-center gap-x-3 text-sm text-neutral-500">
            <span className="flex items-center gap-x-1">
              <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-sans text-xs dark:border-neutral-700 dark:bg-neutral-800">
                ⌘
              </kbd>
              <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-sans text-xs dark:border-neutral-700 dark:bg-neutral-800">
                K
              </kbd>
            </span>
            <span>to focus search</span>
          </div>
        </div>
      </div>
    </div>
  );
}
