import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";
import { LoginContent } from "./LoginContent";

export const metadata: Metadata = createMetadata({
  title: "Sign in with GitHub",
  description:
    "Sign in to enrich your heatmap with private repo activity. Only aggregate stats are stored — no repo names, code, or commit messages.",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return <LoginContent />;
}
