import type { Metadata } from "next";
import { UserDashboardContent } from "@/components/pages/UserDashboardContent";
import { createMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string }>;
}): Promise<Metadata> {
  const { owner } = await params;
  const encodedOwner = encodeURIComponent(owner);

  return createMetadata({
    title: `@${owner}`,
    noSuffix: true,
    socialTitle: "",
    socialDescription: "",
    description: `Analyze ${owner}'s open-source contribution mix across top repositories, with human vs AI commit and code volume breakdowns.`,
    path: `/${encodedOwner}`,
    ogImage: `/api/og/user?owner=${encodedOwner}`,
    keywords: [
      `${owner} GitHub AI analysis`,
      `${owner} commit attribution`,
      `${owner} human vs AI contributions`,
    ],
  });
}

export default async function UserPage({ params }: { params: Promise<{ owner: string }> }) {
  const { owner } = await params;
  return <UserDashboardContent owner={owner} />;
}
