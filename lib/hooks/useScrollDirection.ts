"use client";

import { useEffect, useRef, useState } from "react";

/** Ignore scroll deltas smaller than this to avoid trackpad jitter. */
const SCROLL_THRESHOLD = 10;

/**
 * Returns `true` when the header should be visible:
 * - always visible near the top of the page (< 80 px)
 * - visible when scrolling **up**
 * - hidden when scrolling **down**
 */
export function useScrollDirection() {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      if (currentY < 80) {
        setIsVisible(true);
      } else if (Math.abs(delta) > SCROLL_THRESHOLD) {
        setIsVisible(delta < 0);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return isVisible;
}
