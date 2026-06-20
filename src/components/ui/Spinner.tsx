import React from "react";

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  color?: string;
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  color = "text-current",
  className = "",
}) => {
  const sizeClasses = {
    xs: "h-3 w-3 border",
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-3",
  };

  return (
    <div
      className={`animate-spin rounded-full border-t-transparent ${sizeClasses[size]} ${color} ${className}`}
      style={{ borderLeftColor: "transparent" }}
      role="status"
      aria-label="loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default React.memo(Spinner);
