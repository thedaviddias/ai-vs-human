"use client";

import {
  Check,
  Copy,
  Download,
  EyeOff,
  Image as ImageIcon,
  MoreHorizontal,
  Share,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSound } from "@/lib/hooks/useSound";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/tracking";

interface ShareButtonsProps {
  label: string;
  type: "user" | "repo";
  botPercentage: string;
  /** Actual human-only percentage (excludes both AI and automation) */
  humanPercentage: string;
  targetId?: string;
  /** Automation bot percentage (Dependabot, Renovate, GitHub Actions, etc.) */
  automationPercentage?: string;
  /** Whether the user has private data linked */
  includesPrivateData?: boolean;
  /** Whether the viewer is the profile owner */
  isOwnProfile?: boolean;
  /** Whether data is currently syncing */
  isSyncing?: boolean;
}

const XLogo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" role="img">
    <title>X (formerly Twitter)</title>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export function ShareButtons({
  label,
  type,
  botPercentage,
  humanPercentage,
  automationPercentage,
  includesPrivateData,
  isOwnProfile,
  isSyncing,
}: ShareButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyImageLoading, setCopyImageLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { playClick, playSuccess, playToggle } = useSound();

  const [url, setUrl] = useState("");
  const [hasNativeShare, setHasNativeShare] = useState(false);

  // Track sync transitions to trigger a pulse effect for the owner
  const [isPulsing, setIsPulsing] = useState(false);
  const prevIsSyncing = useRef(isSyncing);

  useEffect(() => {
    // If sync just finished and this is the owner's profile
    if (prevIsSyncing.current === true && isSyncing === false && isOwnProfile) {
      setIsPulsing(true);
      // Let it pulse for 5 seconds to grab attention
      const timeout = setTimeout(() => setIsPulsing(false), 5000);
      return () => clearTimeout(timeout);
    }
    prevIsSyncing.current = isSyncing;
  }, [isSyncing, isOwnProfile]);

  useEffect(() => {
    setUrl(window.location.href);
    setHasNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getOgImageUrl = (usePrivate = false) => {
    const usePrivateRoute = usePrivate && type === "user";
    const baseUrl = usePrivateRoute ? `/api/og/${type}/private` : `/api/og/${type}`;
    const params = new URLSearchParams();
    if (type === "user") {
      params.append("owner", label);
    } else {
      const parts = label.split("/");
      params.append("owner", parts[0]);
      params.append("name", parts[parts.length - 1]);
    }
    params.append("t", Date.now().toString());
    return `${baseUrl}?${params.toString()}`;
  };

  const canDownloadPrivate = isOwnProfile && includesPrivateData && type === "user";

  const getShareText = () => {
    const humanVal = Number.parseFloat(humanPercentage);
    const aiVal = Number.parseFloat(botPercentage);
    const autoVal = Number.parseFloat(automationPercentage ?? "0");
    const nonHumanVal = aiVal + autoVal;

    if (humanVal >= 98) {
      return "100% Organic Code. 🌿 My GitHub contributions are purely human-made. Check my breakdown:";
    }
    if (humanVal >= 90) {
      return `Proof of Human: ${humanVal.toFixed(1)}% of my code is handcrafted. ✍️ Still keeping it real in the age of AI:`;
    }
    if (humanVal >= 60) {
      return `Turns out ${nonHumanVal.toFixed(1)}% of my code involves AI or automation. 🦾 Check the breakdown:`;
    }
    return `The future of coding is collaborative. 🤖 ${nonHumanVal.toFixed(1)}% of my commits are AI-assisted or automated. Am I more bot than you?`;
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}&url=${encodeURIComponent(url)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      trackEvent("copy_link", { label, type });
      setCopied(true);
      playSuccess();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy link", err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "AI vs Human",
          text: getShareText(),
          url: url,
        });
        trackEvent("system_share", { label, type });
        setIsOpen(false);
        playSuccess();
      } catch (err) {
        logger.error("Share failed", err);
      }
    }
  };

  const handleCopyImage = async () => {
    const ogImageUrl = getOgImageUrl(false);
    setCopyImageLoading(true);
    playClick();
    try {
      const clipboardPromise = fetch(ogImageUrl).then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
        return await res.blob();
      });
      const item = new ClipboardItem({ "image/png": clipboardPromise });
      await navigator.clipboard.write([item]);
      trackEvent("copy_card", { label, type });
      playSuccess();
      alert("Custom card copied to clipboard!");
    } catch (err) {
      logger.error("Failed to copy image", err);
      alert("Failed to copy card. Try downloading it instead.");
    } finally {
      setCopyImageLoading(false);
    }
  };

  const handleDownloadImage = async (usePrivate = false) => {
    const ogImageUrl = getOgImageUrl(usePrivate);
    setDownloadLoading(true);
    playClick();
    try {
      const res = await fetch(ogImageUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.body.appendChild(document.createElement("a"));
      link.href = blobUrl;
      link.download = `${label.replace("/", "-")}${usePrivate ? "-private" : ""}-aivshuman.png`;
      link.click();
      trackEvent(usePrivate ? "download_private_png" : "download_png", { label, type });
      playSuccess();
      setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(blobUrl);
      }, 100);
      setIsOpen(false);
    } catch (err) {
      logger.error("Failed to download image", err);
      const link = document.body.appendChild(document.createElement("a"));
      link.href = ogImageUrl;
      link.download = `${label.replace("/", "-")}-aivshuman.png`;
      link.target = "_blank";
      link.click();
      setTimeout(() => link.remove(), 100);
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <>
      {/* Primary: Copy Card */}
      <button
        type="button"
        onClick={handleCopyImage}
        disabled={copyImageLoading}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-black transition-all hover:bg-neutral-200 active:scale-95 shadow-lg shadow-white/5 disabled:opacity-50 sm:gap-2 sm:px-4 sm:text-sm"
      >
        {copyImageLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
        Copy Card
      </button>

      {/* Post on X */}
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackEvent("post_to_x", { label, type });
          playClick();
          setIsPulsing(false); // Stop pulsing on click
        }}
        className={`flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-black px-3 py-2 text-xs font-semibold text-neutral-400 transition-all hover:bg-neutral-900 hover:text-white hover:border-neutral-700 active:scale-95 sm:gap-2 sm:px-4 sm:text-sm ${
          isPulsing
            ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-black animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite] text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            : ""
        }`}
      >
        <XLogo />
        Post on X
      </a>

      {/* Copy Link */}
      <button
        type="button"
        onClick={handleCopyLink}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold transition-all hover:bg-neutral-800 active:scale-95 sm:gap-2 sm:px-4 sm:text-sm"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy Link
          </>
        )}
      </button>

      {/* More Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            playToggle(!isOpen);
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 ${
            isOpen
              ? "border-white bg-white text-black"
              : "border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800"
          }`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-1.5 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => handleDownloadImage(false)}
              disabled={downloadLoading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-900 disabled:opacity-50 whitespace-nowrap"
            >
              {downloadLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
              ) : (
                <Download className="h-4 w-4 text-green-400" />
              )}
              Download PNG
            </button>

            {canDownloadPrivate && (
              <button
                type="button"
                onClick={() => handleDownloadImage(true)}
                disabled={downloadLoading}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-900 disabled:opacity-50 whitespace-nowrap"
              >
                <EyeOff className="h-4 w-4 text-purple-400" />
                Download with Private
              </button>
            )}

            {hasNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-900 whitespace-nowrap"
              >
                <Share className="h-4 w-4 text-blue-400" />
                System Share
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
