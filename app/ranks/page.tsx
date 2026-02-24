import type { Metadata } from "next";
import Link from "next/link";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Ranks (Legacy URL)",
  description: "Developer ranks documentation has moved to /docs/ranks.",
  path: "/docs/ranks",
  noIndex: true,
});

export default function RanksAliasPage() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-white">Docs Have Moved</h1>
      <p className="mt-4 text-neutral-400">
        Developer ranks are now documented in the Docs section.
      </p>
      <Link
        href="/docs/ranks"
        className="mt-8 inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-neutral-200 active:scale-95"
      >
        Open Developer Ranks
      </Link>
    </div>
  );
}
