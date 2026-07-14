import * as React from "react";
import { cn } from "@/lib/utils";
import type { SpaceToken, SurfaceTone } from "../../foundations/types";

const gapClass: Record<SpaceToken, string> = {
  0: "gap-0",
  0.5: "gap-0.5",
  1: "gap-1",
  1.5: "gap-1.5",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  8: "gap-8",
  10: "gap-10",
  12: "gap-12",
  16: "gap-16",
};

const surfaceClass: Record<SurfaceTone, string> = {
  canvas: "bg-[var(--ds-canvas)]",
  surface: "bg-[var(--ds-surface)]",
  subtle: "bg-[var(--ds-surface-subtle)]",
  raised: "bg-[var(--ds-surface-raised)]",
  muted: "bg-[var(--ds-surface-muted)]",
  inverse: "bg-[var(--ds-surface-inverse)] text-[var(--ds-text-inverse)]",
  selected: "bg-[var(--ds-surface-selected)]",
};

export function Surface({
  tone = "surface",
  elevation = 0,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: SurfaceTone;
  elevation?: 0 | 1 | 2 | 3;
}) {
  const shadows = {
    0: "shadow-none",
    1: "shadow-[var(--ds-shadow-1)]",
    2: "shadow-[var(--ds-shadow-2)]",
    3: "shadow-[var(--ds-shadow-3)]",
  };
  return (
    <div
      className={cn(
        "rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subtle)]",
        surfaceClass[tone],
        shadows[elevation],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Stack({
  gap = 3,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { gap?: SpaceToken }) {
  return (
    <div className={cn("flex flex-col", gapClass[gap], className)} {...rest}>
      {children}
    </div>
  );
}

export function Inline({
  gap = 2,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { gap?: SpaceToken }) {
  return (
    <div className={cn("flex flex-row flex-wrap items-center", gapClass[gap], className)} {...rest}>
      {children}
    </div>
  );
}

export function Container({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1200px] px-[var(--ds-page-padding)]", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
