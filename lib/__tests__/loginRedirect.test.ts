import { describe, expect, it } from "vitest";
import { buildProfileRedirectUrl } from "../loginRedirect";

describe("buildProfileRedirectUrl", () => {
  it("returns '/' when username is null", () => {
    expect(buildProfileRedirectUrl(null)).toBe("/");
  });

  it("returns '/' when username is undefined", () => {
    expect(buildProfileRedirectUrl(undefined)).toBe("/");
  });

  it("returns '/' when username is empty string", () => {
    expect(buildProfileRedirectUrl("")).toBe("/");
  });

  it("returns '/username' for a normal GitHub login", () => {
    expect(buildProfileRedirectUrl("thedaviddias")).toBe("/thedaviddias");
  });

  it("handles hyphens correctly (common in GitHub logins)", () => {
    expect(buildProfileRedirectUrl("my-cool-user")).toBe("/my-cool-user");
  });

  it("encodes special characters defensively", () => {
    expect(buildProfileRedirectUrl("user name")).toBe("/user%20name");
  });
});
