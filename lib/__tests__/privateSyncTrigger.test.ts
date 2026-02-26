import { describe, expect, it } from "vitest";
import { shouldAutoTriggerPrivateSync } from "../privateSyncTrigger";

describe("shouldAutoTriggerPrivateSync", () => {
  // ── Use Case 1: Anonymous user ──────────────────────────────
  it("returns false when user is not authenticated", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: false,
        isAuthenticated: false,
        privateSyncStatus: null,
      })
    ).toBe(false);
  });

  // ── Use Case 2: Fresh user signs in (no prior data) ─────────
  it("returns true when authenticated user visits own profile for the first time (never synced)", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: true,
        isAuthenticated: true,
        privateSyncStatus: null, // no record exists — never attempted
      })
    ).toBe(true);
  });

  // ── Use Case 3: Returning user with public data signs in ────
  it("returns true for returning user who has never linked private data", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: true,
        isAuthenticated: true,
        privateSyncStatus: null, // public data exists but never tried private
      })
    ).toBe(true);
  });

  // ── Use Case 4: Logged-in user submits own username via SearchBar ──
  it("returns true when logged-in user navigates to own profile via search", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: true,
        isAuthenticated: true,
        privateSyncStatus: null,
      })
    ).toBe(true);
  });

  // ── Use Case 5: User explicitly unlinked ────────────────────
  it("returns false when user has explicitly unlinked (record exists with idle status)", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: true,
        isAuthenticated: true,
        privateSyncStatus: {
          syncStatus: "idle",
          includesPrivateData: false,
        },
      })
    ).toBe(false);
  });

  // ── Use Case 6: Previous sync errored ───────────────────────
  it("returns false when previous sync errored (let user manually retry)", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: true,
        isAuthenticated: true,
        privateSyncStatus: {
          syncStatus: "error",
          includesPrivateData: false,
        },
      })
    ).toBe(false);
  });

  // ── Edge Cases ──────────────────────────────────────────────

  it("returns false when visiting someone else's profile (even if authenticated)", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: false,
        isAuthenticated: true,
        privateSyncStatus: null,
      })
    ).toBe(false);
  });

  it("returns false when private sync is currently in progress", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: true,
        isAuthenticated: true,
        privateSyncStatus: {
          syncStatus: "syncing",
          includesPrivateData: false,
        },
      })
    ).toBe(false);
  });

  it("returns false when private data is already linked and synced", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: true,
        isAuthenticated: true,
        privateSyncStatus: {
          syncStatus: "synced",
          includesPrivateData: true,
        },
      })
    ).toBe(false);
  });

  it("returns false when privateSyncStatus is undefined (query still loading)", () => {
    expect(
      shouldAutoTriggerPrivateSync({
        isOwnProfile: true,
        isAuthenticated: true,
        privateSyncStatus: undefined,
      })
    ).toBe(false);
  });
});
