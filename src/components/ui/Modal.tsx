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
      style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        style={{ maxWidth: maxW, width: "95%", border: "2px outset #ffffff", background: "#fdf3e0", boxShadow: "3px 3px 8px rgba(0,0,0,0.4)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Orange header */}
        <div className="busy-orange-modal-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{title} !</span>
          {showCloseButton && (
            <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fff", padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
        {/* Body */}
        <div style={{ padding: "12px 16px", maxHeight: "70vh", overflowY: "auto" }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{ borderTop: "1px solid #c0a870", padding: "8px 12px", display: "flex", gap: 8, justifyContent: "center" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
 
export default Modal;
