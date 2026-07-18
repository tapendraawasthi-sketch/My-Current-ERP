import React, { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

export interface MenuItemDef {
  key: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  locked?: boolean;
  separatorBefore?: boolean;
}

export function TopMenuDropdown({
  items,
  onSelect,
}: {
  items: MenuItemDef[];
  onSelect: (key: string) => void;
}) {
  return (
    <div className="top-menu-dropdown">
      {items.map((item) => (
        <React.Fragment key={item.key}>
          {item.separatorBefore && <div className="top-menu-separator" />}
          <button
            type="button"
            className="top-menu-item"
            disabled={item.disabled || item.locked}
            title={item.locked ? "You do not have permission for this action." : undefined}
            style={{
              opacity: item.disabled || item.locked ? 0.5 : 1,
              cursor: item.disabled || item.locked ? "not-allowed" : "pointer",
            }}
            onClick={() => {
              if (!item.disabled && !item.locked) onSelect(item.key);
            }}
          >
            <span>
              {item.locked ? "🔒 " : ""}
              {item.label}
            </span>
            {item.shortcut && <span className="item-shortcut">{item.shortcut}</span>}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

export function ModalShell({
  title,
  children,
  onClose,
  footer,
  width = "max-w-2xl",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div
        className={`w-full ${width} max-h-[88vh] overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg`}
      >
        <div className="flex h-10 items-center justify-between border-b border-gray-200 bg-[#f5f6fa] px-4">
          <h2 className="text-[13px] font-semibold text-gray-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-2 text-[12px] font-medium text-gray-600 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[68vh] overflow-auto p-4 text-[12px] text-gray-700">{children}</div>

        {footer && (
          <div className="flex min-h-10 items-center justify-end gap-2 border-t border-gray-200 bg-[#f5f6fa] px-4 py-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-md bg-[var(--ds-action-primary)] px-3 text-[12px] font-medium text-white hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-md border border-gray-300 bg-white px-3 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-600">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 disabled:bg-gray-100"
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-600">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 disabled:bg-gray-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2">
      <div>
        <div className="text-[12px] font-medium text-gray-800">{label}</div>
        {description && <div className="text-[11px] text-gray-500">{description}</div>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--ds-action-primary)]"
      />
    </div>
  );
}

export function BadgePill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "default";
}) {
  const cls =
    tone === "success"
      ? "bg-green-100 text-green-700"
      : tone === "warning"
        ? "bg-amber-100 text-amber-700"
        : tone === "danger"
          ? "bg-red-100 text-red-700"
          : tone === "info"
            ? "bg-blue-100 text-blue-700"
            : "bg-gray-100 text-gray-700";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
      {children}
    </span>
  );
}

export function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
      {label} is coming soon for Nepal IRD integration.
    </div>
  );
}
