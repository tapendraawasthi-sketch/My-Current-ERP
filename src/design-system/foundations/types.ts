/** Design-system typed tokens */

export type Density = "comfortable" | "productive" | "compact";

export type DsTheme = "light" | "dark";

export type SpaceToken =
  | 0
  | 0.5
  | 1
  | 1.5
  | 2
  | 3
  | 4
  | 5
  | 6
  | 8
  | 10
  | 12
  | 16;

export const SPACE_CSS: Record<SpaceToken, string> = {
  0: "var(--ds-space-0)",
  0.5: "var(--ds-space-0-5)",
  1: "var(--ds-space-1)",
  1.5: "var(--ds-space-1-5)",
  2: "var(--ds-space-2)",
  3: "var(--ds-space-3)",
  4: "var(--ds-space-4)",
  5: "var(--ds-space-5)",
  6: "var(--ds-space-6)",
  8: "var(--ds-space-8)",
  10: "var(--ds-space-10)",
  12: "var(--ds-space-12)",
  16: "var(--ds-space-16)",
};

export type SurfaceTone =
  | "canvas"
  | "surface"
  | "subtle"
  | "raised"
  | "muted"
  | "inverse"
  | "selected";

export const SURFACE_CSS: Record<SurfaceTone, string> = {
  canvas: "var(--ds-canvas)",
  surface: "var(--ds-surface)",
  subtle: "var(--ds-surface-subtle)",
  raised: "var(--ds-surface-raised)",
  muted: "var(--ds-surface-muted)",
  inverse: "var(--ds-surface-inverse)",
  selected: "var(--ds-surface-selected)",
};

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export function applyDensity(density: Density, root: HTMLElement = document.documentElement): void {
  root.setAttribute("data-density", density);
}

export function applyDsTheme(theme: DsTheme, root: HTMLElement = document.documentElement): void {
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-ds-theme", theme);
}
