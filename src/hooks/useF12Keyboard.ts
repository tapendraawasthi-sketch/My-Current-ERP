import { useEffect } from "react";
import { useF12Config } from "./useF12Config";

/**
 * useF12Keyboard
 *
 * Global keyboard listener that intercepts the F12 key to open the
 * ERP Configuration Panel instead of the browser's DevTools.
 */
export function useF12Keyboard() {
  const { openF12, activeScreenId } = useF12Config();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept F12 key
      if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();

        // Only open the panel if a screen has registered itself
        if (activeScreenId) {
          openF12();
        } else {
          console.warn("F12 pressed, but no active screen is registered with the F12 system.");
        }
      }
    };

    // Use capture phase to ensure we catch it before other elements
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [openF12, activeScreenId]);
}
