import React, { ReactNode } from "react";
import Spinner from "./Spinner";
 
interface ButtonProps {
  variant?: "primary" | "secondary" | "danger" | "success" | "warning" | "ghost" | "outline" | "link";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  className?: string;
  id?: string;
}
 
const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  fullWidth = false,
  type = "button",
  onClick,
  children,
  className = "",
  id,
}) => {
  const base = "inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
 
  // BUSY flat bezel button style
  const variantStyle: React.CSSProperties =
    variant === "primary" ? { background: "#d4d0c8", border: "2px outset #ffffff", color: "#000", fontWeight: "bold" }
    : variant === "danger" ? { background: "#d4d0c8", border: "2px outset #ffffff", color: "#cc0000", fontWeight: "bold" }
    : variant === "success" ? { background: "#d4d0c8", border: "2px outset #ffffff", color: "#006600" }
    : variant === "link" ? { background: "transparent", border: "none", color: "#1557b0", textDecoration: "underline", padding: 0 }
    : { background: "#d4d0c8", border: "2px outset #ffffff", color: "#000" };
 
  const sizeStyle: React.CSSProperties =
    size === "xs" ? { height: 18, padding: "0 6px", fontSize: 11 }
    : size === "sm" ? { height: 22, padding: "0 8px", fontSize: 11 }
    : size === "lg" ? { height: 28, padding: "0 16px", fontSize: 13 }
    : { height: 24, padding: "0 12px", fontSize: 12 };
 
  return (
    <button
      id={id}
      type={type}
      className={`${base} ${className}`}
      style={{ ...variantStyle, ...sizeStyle, width: fullWidth ? "100%" : undefined }}
      disabled={disabled || loading}
      onClick={onClick}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.borderStyle = "inset"; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.borderStyle = "outset"; }}
    >
      {loading && <Spinner size={size === "xs" ? "xs" : "sm"} className="mr-1" color="text-gray-600" />}
      {!loading && icon && iconPosition === "left" && <span style={{ marginRight: 4 }}>{icon}</span>}
      <span>{children}</span>
      {!loading && icon && iconPosition === "right" && <span style={{ marginLeft: 4 }}>{icon}</span>}
    </button>
  );
};
 
export default Button;
