/**
 * Falcon user-facing chrome — retired (Wave F).
 * Orbix is the sole assistant (EKhataLauncher → /orbix).
 * Shortcuts that used to open Falcon now open Orbix.
 */
import React, { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { useFalconStore } from "../../store/falconStore";
import { isNiosPlatformEnabled } from "../../nios/session";

export const FalconProvider: React.FC = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const isDbReady = useStore((s) => s.isDbReady);
  const closePanel = useFalconStore((s) => s.closePanel);

  useEffect(() => {
    closePanel();
  }, [closePanel]);

  useEffect(() => {
    if (!isAuthenticated || !isDbReady || isNiosPlatformEnabled()) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "/" || (e.shiftKey && e.key.toLowerCase() === "f"))
      ) {
        e.preventDefault();
        setCurrentPage("orbix");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAuthenticated, isDbReady, setCurrentPage]);

  return null;
};

export default FalconProvider;
