import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

// Curated list of popular repos to pre-index
const CURATED_REPOS = [
  // JS/TS Frameworks
  "facebook/react",
  "vercel/next.js",
  "sveltejs/svelte",
  "vuejs/core",
  "angular/angular",
  "remix-run/remix",
  "withastro/astro",

  // Runtimes & Build Tools
  "denoland/deno",
  "oven-sh/bun",
  "nodejs/node",
  "vitejs/vite",
  "biomejs/biome",

  // AI & Developer Tools
  "anthropics/anthropic-sdk-python",
  "continuedev/continue",
  "langchain-ai/langchain",
  "huggingface/transformers",
  "openai/openai-python",

  // Infrastructure & Systems
  "torvalds/linux",
  "golang/go",
  "rust-lang/rust",
  "python/cpython",
  "ziglang/zig",

  // Popular Apps & Tools
  "microsoft/vscode",
  "microsoft/TypeScript",
  "tailwindlabs/tailwindcss",
  "shadcn-ui/ui",
  "prisma/prisma",
  "drizzle-team/drizzle-orm",
  "trpc/trpc",
  "tanstack/query",

  // Cloud & DevOps
  "kubernetes/kubernetes",
  "docker/compose",
  "hashicorp/terraform",
  "vercel/turbo",

  // Web Standards & Utilities
  "tc39/ecma262",
  "lodash/lodash",
  "date-fns/date-fns",
  "zod/zod",

  // Databases
  "supabase/supabase",
  "convex-dev/convex-backend",

  // Mobile & Cross-platform
  "flutter/flutter",
  "facebook/react-native",
  "expo/expo",

  // Testing
  "vitest-dev/vitest",
  "jestjs/jest",
  "playwright-community/playwright",
];

export const seedRepos = internalAction({
  args: {},
  handler: async (ctx) => {
    for (const repoStr of CURATED_REPOS) {
      const [owner, name] = repoStr.split("/");
      try {
        await ctx.runMutation(internal.mutations.requestRepo.seedRepo, {
          owner,
          name,
        });
      } catch (e) {
        console.error(`Failed to seed ${repoStr}:`, e);
      }
    }
  },
});
