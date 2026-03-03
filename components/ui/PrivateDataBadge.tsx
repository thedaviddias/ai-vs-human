import { Lock } from "lucide-react";

/**
 * Small badge indicating that private activity data is included
 * in the heatmap. Shown to ALL visitors — it does NOT expose
 * any private repo details, just signals that the data is enriched.
 */
export function PrivateDataBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-800/30 bg-blue-900/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
      <Lock className="h-2.5 w-2.5" />
      Includes private activity
    </span>
  );
}
