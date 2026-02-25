import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

export function getWeekStart(epochMs: number): number {
  const date = new Date(epochMs);
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

/**
 * Returns an ISO 8601 week label (e.g. "2025-W01") for a given timestamp.
 *
 * Uses the ISO week-numbering year, which can differ from the calendar year
 * at year boundaries. For example, Dec 30 2024 (Monday) is ISO 2025-W01
 * because that week contains January 4.
 *
 * Algorithm: The ISO week containing January 4 is always week 1.
 * The ISO year of a date is the year of the Thursday in the same ISO week.
 */
export function formatWeekLabel(weekStartMs: number): string {
  const date = new Date(weekStartMs);

  // Find the Thursday of this ISO week (ISO weeks are defined by their Thursday)
  const day = date.getUTCDay();
  const thursdayOffset = day === 0 ? -3 : 4 - day; // Sunday = go back 3 days
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + thursdayOffset);

  // The ISO year is the year of that Thursday
  const isoYear = thursday.getUTCFullYear();

  // ISO week 1 contains January 4 of the ISO year
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay();
  // Monday of the week containing Jan 4
  const startOfIsoYear = new Date(jan4);
  startOfIsoYear.setUTCDate(jan4.getUTCDate() - (jan4Day === 0 ? 6 : jan4Day - 1));

  // Week number = days since start of ISO year / 7 + 1
  const diffMs = thursday.getTime() - startOfIsoYear.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * Formats a percentage value (0-100) to a string.
 * - If 0, returns "0"
 * - If > 0 and < 0.1, returns with up to 2 decimal places (e.g. 0.04)
 * - Otherwise, returns with 1 decimal place (e.g. 85.5)
 */
export function formatPercentage(value: number): string {
  if (value === 0) return "0";
  if (value < 0.1) {
    // For very small numbers, show up to 2 decimals but avoid trailing zeros
    const formatted = value.toFixed(2);
    return formatted.endsWith("0") ? value.toFixed(1) : formatted;
  }
  return value.toFixed(1);
}
