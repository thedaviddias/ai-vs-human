"use client";

import { Check, Copy, Download, Image as ImageIcon, MoreHorizontal, Share } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/tracking";

interface ShareButtonsProps {
  label: string;
  type: "user" | "repo";
  botPercentage: string;
  targetId?: string;
}

const XLogo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" role="img">
    <title>X (formerly Twitter)</title>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export function ShareButtons({ label, type, botPercentage }: ShareButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyImageLoading, setCopyImageLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const url = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getOgImageUrl = () => {
    const baseUrl = `/api/og/${type}`;
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

  const getShareText = () => {
    const aiVal = Number.parseFloat(botPercentage);
    const humanVal = (100 - aiVal).toFixed(1);

    if (aiVal < 2) {
      return `100% Organic Code. 🌿 My open source contributions are purely human-made. Check my breakdown:`;
    }
    if (aiVal < 10) {
      return `Proof of Human: ${humanVal}% of my code is handcrafted. ✍️ Still keeping it real in the age of AI:`;
    }
    if (aiVal < 40) {
      return `Turns out I'm ${aiVal}% Cyborg. 🦾 AI is my co-pilot in open source. Check the breakdown:`;
    }
    return `The future of coding is collaborative. 🤖 ${aiVal}% of my commits are AI-assisted. Am I more bot than you?`;
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}&url=${encodeURIComponent(url)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      trackEvent("copy_link", { label, type });
      setCopied(true);
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
      } catch (err) {
        logger.error("Share failed", err);
      }
    }
  };

  const handleCopyImage = async () => {
    const ogImageUrl = getOgImageUrl();
    setCopyImageLoading(true);
    try {
      const clipboardPromise = fetch(ogImageUrl).then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
        return await res.blob();
      });
      const item = new ClipboardItem({ "image/png": clipboardPromise });
      await navigator.clipboard.write([item]);
      trackEvent("copy_card", { label, type });
      alert("Custom card copied to clipboard!");
    } catch (err) {
      logger.error("Failed to copy image", err);
      alert("Failed to copy card. Try downloading it instead.");
    } finally {
      setCopyImageLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    const ogImageUrl = getOgImageUrl();
    setDownloadLoading(true);
    try {
      const res = await fetch(ogImageUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.body.appendChild(document.createElement("a"));
      link.href = blobUrl;
      link.download = `${label.replace("/", "-")}-aivshuman.png`;
      link.click();
      trackEvent("download_png", { label, type });
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
    <div className="flex flex-wrap items-center gap-2">
      {/* Primary: Copy Card */}
      <button
        type="button"
        onClick={handleCopyImage}
        disabled={copyImageLoading}
        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black transition-all hover:bg-neutral-200 active:scale-95 shadow-lg shadow-white/5 disabled:opacity-50"
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
        onClick={() => trackEvent("post_to_x", { label, type })}
        className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm font-semibold text-neutral-400 transition-all hover:bg-neutral-900 hover:text-white hover:border-neutral-700 active:scale-95"
      >
        <XLogo />
        Post on X
      </a>

      {/* Copy Link */}
      <button
        type="button"
        onClick={handleCopyLink}
        className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm font-semibold transition-all hover:bg-neutral-800 active:scale-95 min-w-[110px]"
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
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 ${
            isOpen
              ? "border-white bg-white text-black"
              : "border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800"
          }`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 origin-top-right overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-1.5 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={downloadLoading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-900 disabled:opacity-50"
            >
              {downloadLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
              ) : (
                <Download className="h-4 w-4 text-green-400" />
              )}
              Download PNG
            </button>

            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-900"
              >
                <Share className="h-4 w-4 text-blue-400" />
                System Share
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
