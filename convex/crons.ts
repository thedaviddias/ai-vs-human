import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "resync-stale-repos",
  { hourUTC: 3, minuteUTC: 0 },
  internal.github.resyncStaleRepos.resyncStaleRepos
);

crons.daily(
  "cleanup-rate-limits",
  { hourUTC: 4, minuteUTC: 0 },
  internal.mutations.cleanupRateLimits.cleanupRateLimits
);

export default crons;
