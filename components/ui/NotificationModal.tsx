"use client";

import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSound } from "@/lib/hooks/useSound";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function NotificationModal({ isOpen, onClose, onConfirm }: NotificationModalProps) {
  const { playClick, playToggle } = useSound();
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      playToggle(true);
    }
  }, [isOpen, playToggle]);

  if (!isOpen) return null;

  const handleClose = () => {
    playToggle(false);
    onClose();
  };

  const handleConfirm = async () => {
    playClick();
    if (Notification.permission !== "granted") {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        onConfirm();
        handleClose();
      }
    } else {
      onConfirm();
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Close modal"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-6 top-6 text-neutral-500 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
            <Bell className="h-8 w-8" />
          </div>

          <h3 className="mb-2 text-xl font-bold text-white">Get Notified</h3>
          <p className="mb-8 text-sm leading-relaxed text-neutral-400">
            Analysis can take a few minutes for larger accounts. Enable browser notifications to get
            an alert once it&apos;s ready!
          </p>

          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98]"
            >
              {permission === "denied"
                ? "Blocked (Check Browser Settings)"
                : "Enable Notifications"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
