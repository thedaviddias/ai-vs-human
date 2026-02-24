import type { ReactNode } from "react";
import { DocsNav } from "@/components/layout/DocsNav";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="py-8">
      <div className="lg:hidden">
        <DocsNav mode="tabs" />
      </div>

      <div className="mt-6 grid gap-8 lg:mt-0 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <DocsNav mode="sidebar" />
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
