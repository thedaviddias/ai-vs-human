"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEADERBOARD_NAV } from "@/lib/leaderboardNav";

interface LeaderboardNavProps {
  mode: "sidebar" | "tabs";
}

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/leaderboard") {
    return pathname === "/leaderboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LeaderboardNav({ mode }: LeaderboardNavProps) {
  const pathname = usePathname();

  if (mode === "tabs") {
    return (
      <nav aria-label="Leaderboard sections">
        <div className="inline-flex w-full rounded-lg border border-neutral-800 bg-black p-1">
          {LEADERBOARD_NAV.map((item) => {
            const active = isActiveRoute(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 rounded-md px-2 py-2 text-center text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
                  active ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Leaderboard navigation"
      className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-2"
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Leaderboards
      </div>
      <ul className="space-y-1">
        {LEADERBOARD_NAV.map((item) => {
          const active = isActiveRoute(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-lg px-3 py-2 transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
                }`}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                {item.description && (
                  <div className="mt-0.5 text-xs text-neutral-500">{item.description}</div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
