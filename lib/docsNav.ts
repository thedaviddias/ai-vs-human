export interface DocsNavItem {
  label: string;
  href: string;
  description?: string;
}

export const DOCS_NAV: DocsNavItem[] = [
  {
    label: "About",
    href: "/docs",
    description: "How AI vs Human classifies commits and calculates contribution metrics.",
  },
  {
    label: "Ranks",
    href: "/docs/ranks",
    description: "How developer tiers are assigned from human vs AI contribution.",
  },
  {
    label: "Attribution",
    href: "/docs/attribution",
    description: "How to ensure your AI-generated code is correctly detected.",
  },
];
