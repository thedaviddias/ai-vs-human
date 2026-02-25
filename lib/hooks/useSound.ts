"use client";

import { useCallback } from "react";
import { soundEngine } from "../sounds";

export function useSound() {
  const playClick = useCallback(() => {
    soundEngine?.playClick();
  }, []);

  const playSuccess = useCallback(() => {
    soundEngine?.playSuccess();
  }, []);

  const playError = useCallback(() => {
    soundEngine?.playError();
  }, []);

  const playToggle = useCallback((isOpen: boolean) => {
    soundEngine?.playToggle(isOpen);
  }, []);

  return {
    playClick,
    playSuccess,
    playError,
    playToggle,
  };
}
