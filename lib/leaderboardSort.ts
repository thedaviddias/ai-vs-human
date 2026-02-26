/**
 * Leaderboard sort-key helpers.
 *
 * The leaderboard must rank developers by their **public** commit/star
 * counts — not by the merged (public + private) totals. Private repo
 * data is unverifiable by other visitors, so using it for ranking
 * would undermine platform credibility.
 *
 * The Convex query already returns `publicTotalCommits` and
 * `publicTotalStars` alongside the merged values. These helpers
 * extract the correct sort key, falling back to the merged total
 * for users who have no private data (where the two values are equal).
 */

export function getPublicCommitCount(user: {
  totalCommits: number;
  publicTotalCommits?: number;
}): number {
  return user.publicTotalCommits ?? user.totalCommits;
}

export function getPublicStarCount(user: {
  totalStars: number;
  publicTotalStars?: number;
}): number {
  return user.publicTotalStars ?? user.totalStars;
}
