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

crons.hourly(
  "recover-stuck-pending-repos",
  { minuteUTC: 15 },
  internal.github.recoverStuckRepos.recoverStuckRepos
);

export default crons;
