import { describe, expect, it } from "vitest";
import { shouldShowPrivateData } from "../privateVisibility";

describe("shouldShowPrivateData", () => {
  // ── No private data ──────────────────────────────────────
  it("returns false when hasPrivateData is false (regardless of other flags)", () => {
    expect(
      shouldShowPrivateData({
        isOwnProfile: true,
        hasPrivateData: false,
        showPrivateDataPublicly: true,
      })
    ).toBe(false);
  });

  it("returns false for visitor when no private data exists, even if toggle is true", () => {
    expect(
      shouldShowPrivateData({
        isOwnProfile: false,
        hasPrivateData: false,
        showPrivateDataPublicly: true,
      })
    ).toBe(false);
  });

  // ── Owner always sees their data ─────────────────────────
  it("returns true when owner views own profile with toggle ON", () => {
    expect(
      shouldShowPrivateData({
        isOwnProfile: true,
        hasPrivateData: true,
        showPrivateDataPublicly: true,
      })
    ).toBe(true);
  });

  it("returns true when owner views own profile with toggle OFF", () => {
    expect(
      shouldShowPrivateData({
        isOwnProfile: true,
        hasPrivateData: true,
        showPrivateDataPublicly: false,
      })
    ).toBe(true);
  });

  it("returns true when owner views own profile with toggle undefined (default)", () => {
    expect(
      shouldShowPrivateData({
        isOwnProfile: true,
        hasPrivateData: true,
        showPrivateDataPublicly: undefined,
      })
    ).toBe(true);
  });

  // ── Visitor: toggle controls visibility ──────────────────
  it("returns true when visitor views profile and toggle is true", () => {
    expect(
      shouldShowPrivateData({
        isOwnProfile: false,
        hasPrivateData: true,
        showPrivateDataPublicly: true,
      })
    ).toBe(true);
  });

  it("returns true when visitor views profile and toggle is undefined (default = show)", () => {
    expect(
      shouldShowPrivateData({
        isOwnProfile: false,
        hasPrivateData: true,
        showPrivateDataPublicly: undefined,
      })
    ).toBe(true);
  });

  it("returns false when visitor views profile and toggle is false", () => {
    expect(
      shouldShowPrivateData({
        isOwnProfile: false,
        hasPrivateData: true,
        showPrivateDataPublicly: false,
      })
    ).toBe(false);
  });
});
