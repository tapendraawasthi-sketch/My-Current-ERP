import React, { ReactNode } from "react";

interface BadgeProps {
  variant?: "positive" | "warning" | "negative" | "neutral" | "info" | "success" | "danger" | "primary" | "default" | string;
  size?: "sm" | "md";
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "md",
  children,
  dot = false,
  className = "",
}) => {
  const getBadgeClass = (v: string) => {
    switch (v) {
      case "positive":
      case "success":
        return "badge-posted";
      case "warning":
        return "badge-draft";
      case "negative":
      case "danger":
        return "badge-cancelled";
      case "info":
      case "primary":
        return "badge-info";
      case "neutral":
      case "default":
      default:
        return "badge-inactive";
    }
  };

  const getDotColorClass = (v: string) => {
    switch (v) {
      case "positive":
      case "success":
        return "bg-[var(--color-positive)]";
      case "warning":
        return "bg-[var(--color-warning)]";
      case "negative":
      case "danger":
        return "bg-[var(--color-negative)]";
      case "info":
      case "primary":
        return "bg-[var(--color-accent)]";
      case "neutral":
      case "default":
      default:
        return "bg-[var(--color-text-muted)]";
    }
  };

  const badgeClass = getBadgeClass(variant);

  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-[10px]",
  };

  return (
    <span className={`inline-flex items-center font-semibold uppercase rounded shrink-0 ${badgeClass} ${sizes[size as keyof typeof sizes] || sizes.md} ${className}`}>
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full mr-1.5 shrink-0 ${getDotColorClass(variant)}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};

export default React.memo(Badge);
