import React, { useEffect, useRef } from "react";
import { useIsMobile } from "../../hooks/use-mobile";

export type PageLayoutMode =
  | "standard"
  | "wide"
  | "full-width"
  | "document"
  | "report"
  | "immersive"
  | "mobile-task";

const MODE_CLASS: Record<PageLayoutMode, string> = {
  standard: "mx-auto min-h-full max-w-[1600px]",
  wide: "mx-auto min-h-full max-w-[1800px]",
  "full-width": "min-h-full max-w-none",
  document: "mx-auto min-h-full max-w-[960px]",
  report: "mx-auto min-h-full max-w-none",
  immersive: "h-full max-w-none",
  "mobile-task": "min-h-full max-w-none",
};

export function resolvePageLayoutMode(page: string, isMobile: boolean): PageLayoutMode {
  if (page === "orbix") return "immersive";
  if (
    page.includes("balance") ||
    page.includes("trial") ||
    page.includes("profit") ||
    page.includes("ledger") ||
    page.includes("day-book") ||
    page.includes("report")
  ) {
    return "report";
  }
  if (isMobile) return "mobile-task";
  return "standard";
}

export const PageContentFrame: React.FC<{
  page: string;
  children: React.ReactNode;
}> = ({ page, children }) => {
  const isMobile = useIsMobile();
  const mode = resolvePageLayoutMode(page, isMobile);
  const ref = useRef<HTMLDivElement>(null);
  const immersive = mode === "immersive";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Route-change focus for screen readers — do not steal from dialogs
    if (!document.querySelector("[role='dialog']")) {
      el.focus({ preventScroll: true });
    }
  }, [page]);

  return (
    <div
      ref={ref}
      id="main-content"
      tabIndex={-1}
      data-page-layout={mode}
      data-testid="shell-page-content-frame"
      className={`page-enter w-full outline-none ${MODE_CLASS[mode]} ${
        immersive
          ? "h-full min-h-0"
          : isMobile
            ? "pb-[max(1rem,env(safe-area-inset-bottom))]"
            : ""
      }`}
    >
      {children}
    </div>
  );
};

export default PageContentFrame;
