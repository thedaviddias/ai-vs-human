import { v } from "convex/values";

/**
 * Shared classification validator used across schema, mutations, and actions.
 *
 * Single source of truth — when adding a new AI tool classification,
 * update ONLY this file. Consumers import from here.
 */
export const classificationValidator = v.union(
  v.literal("human"),
  v.literal("dependabot"),
  v.literal("renovate"),
  v.literal("copilot"),
  v.literal("claude"),
  v.literal("cursor"),
  v.literal("aider"),
  v.literal("devin"),
  v.literal("openai-codex"),
  v.literal("gemini"),
  v.literal("github-actions"),
  v.literal("other-bot"),
  v.literal("ai-assisted")
);
