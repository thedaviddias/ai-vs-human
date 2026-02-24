"use client";

import { Check, Copy, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { trackEvent } from "@/lib/tracking";

interface EmbedSnippetProps {
  repoFullName: string;
  onClose: () => void;
}

export function EmbedSnippet({ repoFullName, onClose }: EmbedSnippetProps) {
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://aivshuman.dev";

  const badgeUrl = `${baseUrl}/api/badge/${repoFullName}`;
  const repoUrl = `${baseUrl}/${repoFullName}`;

  const markdownSnippet = `[![AI vs Human](${badgeUrl})](${repoUrl})`;
  const htmlSnippet = `<a href="${repoUrl}"><img src="${badgeUrl}" alt="AI vs Human" /></a>`;

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Embed Badge</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="mt-4 flex justify-center rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <Image
            src={badgeUrl}
            alt="AI vs Human badge preview"
            width={200}
            height={20}
            unoptimized
          />
        </div>

        {/* Markdown */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Markdown</span>
            <button
              type="button"
              onClick={() => {
                trackEvent("copy_embed", { format: "markdown" });
                handleCopy(markdownSnippet);
              }}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy
            </button>
          </div>
          <pre className="mt-1 overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
            {markdownSnippet}
          </pre>
        </div>

        {/* HTML */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">HTML</span>
            <button
              type="button"
              onClick={() => {
                trackEvent("copy_embed", { format: "html" });
                handleCopy(htmlSnippet);
              }}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy
            </button>
          </div>
          <pre className="mt-1 overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
            {htmlSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}
