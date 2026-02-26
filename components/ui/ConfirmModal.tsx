"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Modal title */
  title: string;
  /** Descriptive body text */
  description: string;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Whether the confirm action is destructive — renders the button in red */
  destructive?: boolean;
  /** Whether the confirm action is in progress */
  isLoading?: boolean;
}

/**
 * Reusable confirmation modal with backdrop blur, animated entry,
 * and support for destructive (red) confirm actions.
 *
 * Follows the same visual pattern as NotificationModal for consistency.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  isLoading = false,
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 text-neutral-500 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${
              destructive ? "bg-red-500/10 text-red-400" : "bg-purple-500/10 text-purple-400"
            }`}
          >
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
          <p className="mb-8 text-sm leading-relaxed text-neutral-400">{description}</p>

          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`w-full rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
                destructive
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-white text-black hover:bg-neutral-200"
              }`}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
