"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { siteConfig } from "@/lib/constants";

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  const jsonLd = useMemo(
    () =>
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.label,
          item: `${siteConfig.url}${item.href}`,
        })),
      }),
    [items]
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <li key={`${item.href}-${item.label}`} className="flex items-center gap-1.5">
                {isLast ? (
                  <span
                    aria-current="page"
                    className="font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    {item.label}
                  </Link>
                )}
                {!isLast && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
      <script type="application/ld+json">{jsonLd}</script>
    </>
  );
}
