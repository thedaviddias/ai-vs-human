/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as classification_botDetector from "../classification/botDetector.js";
import type * as classification_detailedBreakdown from "../classification/detailedBreakdown.js";
import type * as classification_knownBots from "../classification/knownBots.js";
import type * as crons from "../crons.js";
import type * as github_classifyPRs from "../github/classifyPRs.js";
import type * as github_classifyPRsHelpers from "../github/classifyPRsHelpers.js";
import type * as github_fetchCommitStats from "../github/fetchCommitStats.js";
import type * as github_fetchCommits from "../github/fetchCommits.js";
import type * as github_fetchRepo from "../github/fetchRepo.js";
import type * as github_ingestCommits from "../github/ingestCommits.js";
import type * as github_ingestRepo from "../github/ingestRepo.js";
import type * as github_recoverStuckRepos from "../github/recoverStuckRepos.js";
import type * as github_resyncStaleRepos from "../github/resyncStaleRepos.js";
import type * as github_statsComputation from "../github/statsComputation.js";
import type * as lib_analyzeApiKey from "../lib/analyzeApiKey.js";
import type * as lib_resyncThrottle from "../lib/resyncThrottle.js";
import type * as lib_validators from "../lib/validators.js";
import type * as mutations_cleanupRateLimits from "../mutations/cleanupRateLimits.js";
import type * as mutations_profiles from "../mutations/profiles.js";
import type * as mutations_recomputeGlobalStats from "../mutations/recomputeGlobalStats.js";
import type * as mutations_requestRepo from "../mutations/requestRepo.js";
import type * as mutations_requestUserAnalysis from "../mutations/requestUserAnalysis.js";
import type * as mutations_resetStuckRepo from "../mutations/resetStuckRepo.js";
import type * as mutations_resyncRepo from "../mutations/resyncRepo.js";
import type * as mutations_resyncUser from "../mutations/resyncUser.js";
import type * as queries_contributors from "../queries/contributors.js";
import type * as queries_globalStats from "../queries/globalStats.js";
import type * as queries_repos from "../queries/repos.js";
import type * as queries_stats from "../queries/stats.js";
import type * as queries_users from "../queries/users.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "classification/botDetector": typeof classification_botDetector;
  "classification/detailedBreakdown": typeof classification_detailedBreakdown;
  "classification/knownBots": typeof classification_knownBots;
  crons: typeof crons;
  "github/classifyPRs": typeof github_classifyPRs;
  "github/classifyPRsHelpers": typeof github_classifyPRsHelpers;
  "github/fetchCommitStats": typeof github_fetchCommitStats;
  "github/fetchCommits": typeof github_fetchCommits;
  "github/fetchRepo": typeof github_fetchRepo;
  "github/ingestCommits": typeof github_ingestCommits;
  "github/ingestRepo": typeof github_ingestRepo;
  "github/recoverStuckRepos": typeof github_recoverStuckRepos;
  "github/resyncStaleRepos": typeof github_resyncStaleRepos;
  "github/statsComputation": typeof github_statsComputation;
  "lib/analyzeApiKey": typeof lib_analyzeApiKey;
  "lib/resyncThrottle": typeof lib_resyncThrottle;
  "lib/validators": typeof lib_validators;
  "mutations/cleanupRateLimits": typeof mutations_cleanupRateLimits;
  "mutations/profiles": typeof mutations_profiles;
  "mutations/recomputeGlobalStats": typeof mutations_recomputeGlobalStats;
  "mutations/requestRepo": typeof mutations_requestRepo;
  "mutations/requestUserAnalysis": typeof mutations_requestUserAnalysis;
  "mutations/resetStuckRepo": typeof mutations_resetStuckRepo;
  "mutations/resyncRepo": typeof mutations_resyncRepo;
  "mutations/resyncUser": typeof mutations_resyncUser;
  "queries/contributors": typeof queries_contributors;
  "queries/globalStats": typeof queries_globalStats;
  "queries/repos": typeof queries_repos;
  "queries/stats": typeof queries_stats;
  "queries/users": typeof queries_users;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
