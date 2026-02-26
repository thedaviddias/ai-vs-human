#!/usr/bin/env npx tsx
/**
 * Diagnostic script: finds all repos with "Unspecified AI Assistant" entries
 * and identifies which repos need re-syncing.
 *
 * Usage:
 *   npx tsx scripts/find-unspecified-ai.ts          # query production
 *   npx tsx scripts/find-unspecified-ai.ts --local   # query local dev
 */

import { execSync } from "node:child_process";

const isLocal = process.argv.includes("--local");
const envFlag = isLocal ? "" : "--prod";

function convexRun(fnPath: string, args: string): string {
  const cmd = `npx convex run ${envFlag} '${fnPath}' '${args}'`;
  return execSync(cmd, {
    cwd: process.env.PROJECT_ROOT ?? ".",
    encoding: "utf-8",
    timeout: 30_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

interface BreakdownEntry {
  key: string;
  label: string;
  commits: number;
  additions?: number;
}

interface RepoDoc {
  _id: string;
  owner: string;
  name: string;
  fullName?: string;
  syncStatus?: string;
  toolBreakdown?: BreakdownEntry[];
  botBreakdown?: BreakdownEntry[];
}

async function main() {
  console.log(
    `\n🔍 Scanning ${isLocal ? "LOCAL" : "PRODUCTION"} for unspecified AI/bot entries...\n`
  );

  // getIndexedRepos is a public query that returns all synced repos with full fields
  const raw = convexRun("queries/repos:getIndexedRepos", "{}");
  const repos: RepoDoc[] = JSON.parse(raw);

  const unspecifiedAi: Array<{
    fullName: string;
    commits: number;
    additions: number;
  }> = [];

  const unspecifiedBot: Array<{
    fullName: string;
    commits: number;
  }> = [];

  const missingBreakdown: string[] = [];

  for (const repo of repos) {
    const fullName = repo.fullName ?? `${repo.owner}/${repo.name}`;
    const tb = repo.toolBreakdown ?? [];
    const bb = repo.botBreakdown ?? [];

    for (const t of tb) {
      if (t.key === "ai-unspecified") {
        unspecifiedAi.push({
          fullName,
          commits: t.commits,
          additions: t.additions ?? 0,
        });
      }
    }

    for (const b of bb) {
      if (b.key === "bot-unspecified") {
        unspecifiedBot.push({
          fullName,
          commits: b.commits,
        });
      }
    }

    if (tb.length === 0 && bb.length === 0) {
      missingBreakdown.push(fullName);
    }
  }

  // ── Unspecified AI Assistant ──
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  🤖 Unspecified AI Assistant (ai-unspecified)");
  console.log("═══════════════════════════════════════════════════════════");

  if (unspecifiedAi.length === 0) {
    console.log("  ✅ None found!\n");
  } else {
    const totalCommits = unspecifiedAi.reduce((s, r) => s + r.commits, 0);
    const totalAdditions = unspecifiedAi.reduce((s, r) => s + r.additions, 0);
    console.log(
      `  ${unspecifiedAi.length} repo(s), ${totalCommits} commit(s), ${totalAdditions} additions\n`
    );
    for (const r of unspecifiedAi.sort((a, b) => b.commits - a.commits)) {
      console.log(`  • ${r.fullName} — ${r.commits} commit(s), ${r.additions} additions`);
    }
    console.log();
  }

  // ── Unspecified Bot ──
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  🤖 Unspecified Bot (bot-unspecified)");
  console.log("═══════════════════════════════════════════════════════════");

  if (unspecifiedBot.length === 0) {
    console.log("  ✅ None found!\n");
  } else {
    const totalCommits = unspecifiedBot.reduce((s, r) => s + r.commits, 0);
    console.log(`  ${unspecifiedBot.length} repo(s), ${totalCommits} commit(s)\n`);
    for (const r of unspecifiedBot.sort((a, b) => b.commits - a.commits)) {
      console.log(`  • ${r.fullName} — ${r.commits} commit(s)`);
    }
    console.log();
  }

  // ── Repos with no breakdown (need re-sync) ──
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  🔄 Synced repos with NO toolBreakdown (need re-sync)");
  console.log("═══════════════════════════════════════════════════════════");

  if (missingBreakdown.length === 0) {
    console.log("  ✅ All synced repos have breakdowns!\n");
  } else {
    console.log(`  ${missingBreakdown.length} repo(s)\n`);
    for (const name of missingBreakdown.sort()) {
      console.log(`  • ${name}`);
    }
    console.log();
  }

  // ── Summary ──
  const toResync = new Set<string>([
    ...unspecifiedAi.map((r) => r.fullName),
    ...unspecifiedBot.map((r) => r.fullName),
    ...missingBreakdown,
  ]);

  if (toResync.size > 0) {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  📋 Repos to re-sync (all categories combined)");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  Total: ${toResync.size} repo(s)\n`);
    for (const fullName of [...toResync].sort()) {
      console.log(`  ${fullName}`);
    }
    console.log();
  }

  console.log(`Scanned ${repos.length} synced repos.`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
