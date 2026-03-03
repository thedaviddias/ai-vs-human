"use client";

import { Toaster } from "sonner";

export function SonnerToaster() {
  return (
    <Toaster
      position="bottom-right"
      theme="dark"
      closeButton
      toastOptions={{
        className: "border border-neutral-800 bg-neutral-900 text-neutral-100",
      }}
    />
  );
}
