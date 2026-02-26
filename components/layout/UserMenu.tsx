"use client";

import { useQuery } from "convex/react";
import { LogOut, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

/**
 * Dropdown menu shown for authenticated users in the header.
 * Displays the user's GitHub avatar and a sign-out option.
 *
 * Uses `getMyGitHubLogin` to resolve the GitHub login for the
 * "My Profile" link. Falls back to matching the session avatar URL
 * against the profiles table for legacy users where `username` is unset.
 */
export function UserMenu() {
  const { data: session } = authClient.useSession();
  const myGitHubLogin = useQuery(api.auth.getMyGitHubLogin, session?.user ? {} : "skip");
  // Fallback: look up profile by avatar URL to get the owner (GitHub login).
  // This handles legacy users whose `username` field is unset.
  const profileByAvatar = useQuery(
    api.queries.users.getProfileOwnerByAvatarUrl,
    session?.user?.image && !myGitHubLogin ? { avatarUrl: session.user.image } : "skip"
  );
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  if (!session?.user) return null;

  const { name, image } = session.user;
  // Use the resolved GitHub login for profile links; fall back to avatar lookup, then name
  const profileOwner = myGitHubLogin ?? profileByAvatar ?? name ?? "";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-neutral-700 p-0.5 transition-colors hover:border-neutral-500"
        aria-label="User menu"
      >
        {image ? (
          <Image
            src={image}
            alt={name || "User avatar"}
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-700 text-xs font-bold text-white">
            {name?.charAt(0).toUpperCase() || "?"}
          </div>
        )}
      </button>

      {open && (
        <>
          {/* Invisible backdrop to close the menu */}
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl">
            <div className="border-b border-neutral-800 px-4 py-3">
              <p className="truncate text-sm font-medium text-white">{name}</p>
            </div>
            <Link
              href={`/${encodeURIComponent(profileOwner)}`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              <User className="h-4 w-4" />
              My Profile
            </Link>
            <button
              type="button"
              onClick={async () => {
                await authClient.signOut();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
