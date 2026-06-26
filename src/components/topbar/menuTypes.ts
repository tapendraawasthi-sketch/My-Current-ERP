import React from "react";

export type TopMenuId =
  | "company"
  | "data"
  | "exchange"
  | "import"
  | "export"
  | "share"
  | "print"
  | "help";

export type TopMenuActionKind =
  | "navigate"
  | "callback"
  | "divider"
  | "heading";

export interface TopMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  description?: string;
  icon?: React.ReactNode;
  kind?: TopMenuActionKind;
  page?: string;
  permission?: string;
  adminOnly?: boolean;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
}

export interface TopMenuComponentProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onAction?: (action: string, payload?: Record<string, unknown>) => void;
}

export interface CommandPaletteItem {
  id: string;
  label: string;
  page?: string;
  category:
    | "Dashboard"
    | "Masters"
    | "Transactions"
    | "Reports"
    | "Inventory"
    | "Tax"
    | "Payroll"
    | "Banking"
    | "Company"
    | "Data"
    | "Actions"
    | "Help";
  description?: string;
  shortcut?: string;
  permission?: string;
  adminOnly?: boolean;
  action?: () => void;
}

export interface ScreenCapability {
  currentPage: string;
  title: string;
  canExport: boolean;
  canPrint: boolean;
  canShare: boolean;
  documentType?: string;
}
