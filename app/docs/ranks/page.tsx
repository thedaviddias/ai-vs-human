import type { Metadata } from "next";
import { RANKS } from "@/lib/ranks";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Developer Ranks",
  description:
    "Understand how AI vs Human assigns developer tiers based on human and AI contribution percentages.",
  path: "/docs/ranks",
  keywords: ["developer rank model", "human vs AI rank tiers", "AI contribution levels"],
});

export default function DocsRanksPage() {
  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Developer Ranks</h1>
        <p className="max-w-3xl text-sm text-neutral-400 sm:text-base">
          Ranks are derived from the human contribution percentage shown in summary cards. Higher
          tiers mean more human-authored work relative to AI-tool-authored work.
        </p>
      </div>

      <div className="space-y-3">
        {RANKS.map((rank, index) => (
          <article
            key={rank.title}
            className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5 transition-colors hover:border-neutral-700"
          >
            <div
              className="absolute -right-8 -top-8 h-20 w-20 opacity-10 blur-2xl"
              style={{ backgroundColor: rank.hex }}
            />

            <div className="relative flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 text-3xl">
                {rank.icon}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={`text-lg font-bold ${rank.color}`}>{rank.title}</h2>
                  <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Tier {index + 1}
                  </span>
                  <span className="rounded-full border border-neutral-700 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                    {getHumanRange(index)} Human
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-neutral-300">{rank.description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function getHumanRange(index: number) {
  switch (index) {
    case 0:
      return "95% - 100%";
    case 1:
      return "80% - 95%";
    case 2:
      return "50% - 80%";
    case 3:
      return "20% - 50%";
    case 4:
      return "0% - 20%";
    default:
      return "";
  }
}
