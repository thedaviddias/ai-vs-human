import { Search } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-green-400/20 to-purple-500/20 text-white shadow-lg mb-8">
        <span className="text-3xl font-bold bg-gradient-to-br from-green-400 to-purple-500 bg-clip-text text-transparent">
          404
        </span>
      </div>

      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-4">Page not found</h1>

      <p className="max-w-md text-lg text-neutral-400 mb-10">
        The repository or user you are looking for doesn't exist or hasn't been analyzed yet.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="rounded-xl bg-white px-8 py-3 text-sm font-semibold text-neutral-950 transition-all hover:bg-neutral-200 active:scale-95"
        >
          Back to Home
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-8 py-3 text-sm font-semibold transition-all hover:bg-neutral-800 active:scale-95"
        >
          <Search className="h-4 w-4" />
          Search Again
        </Link>
      </div>
    </div>
  );
}
