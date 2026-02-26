"use client";

import { useQuery } from "convex/react";
import { Eye, EyeOff, Hash, Lock, Shield, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { buildProfileRedirectUrl } from "@/lib/loginRedirect";

/**
 * Login page content with privacy explanation.
 *
 * This page is the entry point for GitHub OAuth. It explains exactly
 * what data we access, how we process it, and what we store — because
 * the `repo` scope is a sensitive permission and users deserve full
 * transparency.
 */
export function LoginContent() {
  const { data: session, isPending } = authClient.useSession();
  const myGitHubLogin = useQuery(api.auth.getMyGitHubLogin, session?.user ? {} : "skip");
  // Fallback: look up profile by avatar URL when getMyGitHubLogin returns null
  const profileOwnerByAvatar = useQuery(
    api.queries.users.getProfileOwnerByAvatarUrl,
    session?.user?.image && !myGitHubLogin ? { avatarUrl: session.user.image } : "skip"
  );
  const router = useRouter();

  // If already signed in, redirect to the user's profile page.
  // Use resolved GitHub login (not session.user.name which is the display name).
  const resolvedLogin = myGitHubLogin ?? profileOwnerByAvatar;
  useEffect(() => {
    if (session?.user && !isPending && resolvedLogin) {
      router.replace(buildProfileRedirectUrl(resolvedLogin));
    }
  }, [session, isPending, resolvedLogin, router]);

  const handleSignIn = () => {
    authClient.signIn.social({ provider: "github" });
  };

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-16 sm:py-24">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-white"
            role="img"
            aria-label="GitHub"
          >
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Sign in with GitHub
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-neutral-400">
          Enrich your profile heatmap with private repository activity.
        </p>
      </div>

      {/* Sign in button — placed high so it's visible without scrolling */}
      <div className="mt-10 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={handleSignIn}
          className="flex items-center gap-3 rounded-xl bg-white px-8 py-4 text-base font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-hidden="true"
          >
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          Continue with GitHub
        </button>
        <p className="text-xs text-neutral-600">
          By signing in, you grant read-only access to your private repositories.
        </p>
      </div>

      {/* Privacy explanation — below the CTA for users who want details */}
      <div className="mt-14 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          How it works
        </h2>

        <div className="space-y-3">
          <PrivacyItem
            icon={<Eye className="h-5 w-5" />}
            title="What we access"
            description="We read your private repo commit metadata (author, date, co-authors) to classify activity as human, AI-assisted, or automated."
          />
          <PrivacyItem
            icon={<Hash className="h-5 w-5" />}
            title="What we store"
            description="Only aggregate numbers — daily and weekly counts of human vs AI vs automation commits. That's it."
          />
          <PrivacyItem
            icon={<EyeOff className="h-5 w-5" />}
            title="What we never store"
            description="No repository names, no code, no commit messages, no file paths, no PR content. Private means private."
          />
          <PrivacyItem
            icon={<Lock className="h-5 w-5" />}
            title="Processing"
            description="Commits are classified entirely in memory during the sync. Raw data is discarded immediately after counting — nothing is written to the database."
          />
          <PrivacyItem
            icon={<Shield className="h-5 w-5" />}
            title="Visibility"
            description="Your heatmap will show combined public + private activity. Visitors see a badge indicating private data is included, but no private details are exposed."
          />
          <PrivacyItem
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Full control"
            description="You can unlink your private data at any time. This permanently deletes all stored aggregate stats from our database."
          />
        </div>
      </div>
    </div>
  );
}

function PrivacyItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neutral-400">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-neutral-400">{description}</p>
      </div>
    </div>
  );
}
