// src/hooks/useStickyHeader.ts
/**
 * useStickyHeader
 *
 * Adds box-shadow to a <thead> element once the containing scrollable
 * div has been scrolled past the top. Uses IntersectionObserver on a
 * 1px sentinel element placed above the table, which is the most
 * reliable cross-browser approach without scroll event listeners.
 *
 * Usage:
 *   const { sentinelRef, theadRef } = useStickyHeader();
 *   <div className="overflow-auto">
 *     <div ref={sentinelRef} />          // invisible sentinel
 *     <table>
 *       <thead ref={theadRef}>...</thead>
 *     </table>
 *   </div>
 */

import { useEffect, useRef } from "react";

export function useStickyHeader() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const theadRef    = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const thead    = theadRef.current;
    if (!sentinel || !thead) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When sentinel is NOT intersecting, the table has been scrolled
        // and the header is now sticky.
        if (!entry.isIntersecting) {
          thead.classList.add("is-sticky");
          thead.style.boxShadow = "0 1px 2px rgba(0,0,0,0.06)";
        } else {
          thead.classList.remove("is-sticky");
          thead.style.boxShadow = "none";
        }
      },
      {
        // rootMargin: "-1px" detects the exact moment the sentinel
        // passes out of the viewport (i.e., when the header goes sticky)
        threshold: 0,
        rootMargin: "-1px 0px 0px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, theadRef };
}

export default useStickyHeader;
