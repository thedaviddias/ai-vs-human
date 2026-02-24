"use client";

import Link from "next/link";
import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function ErrorPage({
  error,
  reset,
}: {
  error: globalThis.Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("[RootError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
      <p className="mt-3 max-w-md text-sm text-neutral-400">
        An unexpected error occurred. You can try again or go back to the homepage.
      </p>
      {process.env.NODE_ENV === "development" && (
        <p className="mt-4 max-w-lg rounded-lg border border-red-800 bg-red-900/20 px-4 py-2 text-xs text-red-400 font-mono break-all">
          {error.message}
        </p>
      )}
      <div className="mt-8 flex gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-neutral-700 bg-neutral-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-neutral-800 px-6 py-2.5 text-sm font-semibold text-neutral-400 transition-colors hover:text-white"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
