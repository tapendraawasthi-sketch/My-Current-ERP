import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/** True only on narrow, touch-first viewports (phones). Desktop + Cursor preview stay on desktop layout. */
function computeIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  const narrow = window.innerWidth < MOBILE_BREAKPOINT;
  if (!narrow) return false;
  const touchFirst =
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches;
  return touchFirst;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const update = () => setIsMobile(computeIsMobile());
    update();
    const widthMq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    widthMq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      widthMq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return isMobile;
}
