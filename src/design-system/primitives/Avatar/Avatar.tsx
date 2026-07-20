import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export type AvatarProps = {
  /** Display name — used for initials + stable colour hash */
  name?: string | null;
  src?: string | null;
  alt?: string;
  size?: AvatarSize;
  className?: string;
  /** Override hash seed (e.g. user id) */
  seed?: string | null;
};

export type SuccessAvatarProps = {
  name?: string | null;
  seed?: string | null;
  size?: AvatarSize;
  className?: string;
};

/** Professional palette — blues / teals / slate / green (no purple/violet). */
const AVATAR_PALETTE = [
  { bg: "#e8f0fb", fg: "#0f4a96" },
  { bg: "#ecfdf5", fg: "#047857" },
  { bg: "#e0f2fe", fg: "#0369a1" },
  { bg: "#f0fdf4", fg: "#15803d" },
  { bg: "#f1f5f9", fg: "#334155" },
  { bg: "#ecfeff", fg: "#0e7490" },
  { bg: "#eff6ff", fg: "#1d4ed8" },
  { bg: "#f8fafc", fg: "#475569" },
] as const;

const SIZE_CLS: Record<AvatarSize, string> = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-[12px]",
  lg: "h-10 w-10 text-[13px]",
  xl: "h-16 w-16 text-[16px]",
};

const BADGE_CLS: Record<AvatarSize, string> = {
  xs: "h-3 w-3 -bottom-0.5 -right-0.5",
  sm: "h-3.5 w-3.5 -bottom-0.5 -right-0.5",
  md: "h-4 w-4 -bottom-0.5 -right-0.5",
  lg: "h-5 w-5 -bottom-0.5 -right-0.5",
  xl: "h-6 w-6 bottom-0 right-0",
};

const BADGE_ICON_CLS: Record<AvatarSize, string> = {
  xs: "h-2 w-2",
  sm: "h-2.5 w-2.5",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-3.5 w-3.5",
};

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function avatarInitials(name?: string | null): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function avatarTone(seed: string): (typeof AVATAR_PALETTE)[number] {
  return AVATAR_PALETTE[hashSeed(seed || "?") % AVATAR_PALETTE.length];
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ name, src, alt, size = "sm", className, seed }, ref) => {
    const label = String(name || alt || "").trim() || "User";
    const tone = avatarTone(seed || label);
    const initials = avatarInitials(label);

    if (src) {
      return (
        <span
          ref={ref}
          className={cn(
            "inline-flex shrink-0 overflow-hidden rounded-full border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)]",
            SIZE_CLS[size],
            className,
          )}
          title={label}
        >
          <img src={src} alt={alt || label} className="h-full w-full object-cover" />
        </span>
      );
    }

    return (
      <span
        ref={ref}
        role="img"
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
          SIZE_CLS[size],
          className,
        )}
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {initials}
      </span>
    );
  },
);
Avatar.displayName = "Avatar";

/** Avatar + success check badge — replaces hardcoded green circles (STEP 7.2). */
export function SuccessAvatar({ name, seed, size = "xl", className }: SuccessAvatarProps) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <Avatar name={name || "Saved"} seed={seed || name || "saved"} size={size} />
      <span
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-[var(--ds-status-success)] text-white ring-2 ring-[var(--ds-surface)]",
          BADGE_CLS[size],
        )}
        aria-hidden
      >
        <CheckCircle2 className={BADGE_ICON_CLS[size]} strokeWidth={2.5} />
      </span>
    </span>
  );
}
