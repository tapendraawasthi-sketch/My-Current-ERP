import React, { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
 
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
}
 
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = "md",
  children,
  footer,
  closeOnOverlayClick = true,
  showCloseButton = true,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);
 
  if (!isOpen) return null;
 
  const maxWidthMap = { sm: 360, md: 520, lg: 680, xl: 880, full: 1100 };
  const maxW = maxWidthMap[size];
 
  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: "rgba(15,23,41,0.55)", backdropFilter: "blur(2px)" }}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className="relative flex flex-col"
        style={{
          width: "95%",
          maxWidth: maxW,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-modal)",
          border: "1px solid var(--color-border)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "var(--font-size-md)", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
            {title}
          </span>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="flex items-center justify-center transition-colors focus:outline-none"
              style={{ width: 28, height: 28, borderRadius: "var(--radius-md)", color: "var(--color-text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-surface-raised)";
                e.currentTarget.style.color = "var(--color-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--color-text-muted)";
              }}
              title="Close modal"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {/* Body */}
        <div style={{ padding: "20px", maxHeight: "70vh", overflowY: "auto" }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
 
export default Modal;
