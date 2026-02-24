import { describe, expect, it } from "vitest";
import type { DocsNavItem } from "../docsNav";
import { DOCS_NAV } from "../docsNav";

describe("DOCS_NAV", () => {
  it("is a non-empty array", () => {
    expect(DOCS_NAV.length).toBeGreaterThan(0);
  });

  it("each item has label and href", () => {
    for (const item of DOCS_NAV) {
      expect(item.label).toBeTruthy();
      expect(item.href).toBeTruthy();
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("first item is About with /docs href", () => {
    expect(DOCS_NAV[0].label).toBe("About");
    expect(DOCS_NAV[0].href).toBe("/docs");
  });

  it("all hrefs are unique", () => {
    const hrefs = DOCS_NAV.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("exported type DocsNavItem is compatible", () => {
    const item: DocsNavItem = { label: "Test", href: "/test" };
    expect(item).toBeDefined();
  });
});
