import React from "react";
import {
  Building2,
  Database,
  Shield,
  Users,
  KeyRound,
  Settings,
  Cloud,
  Wrench,
  Upload,
  Download,
  RefreshCw,
  Mail,
  Printer,
  HelpCircle,
  FileText,
  History,
  Lock,
  SplitSquareHorizontal,
  HardDriveDownload,
  BadgeCheck,
} from "lucide-react";
import { TopMenuItem } from "./menuTypes";

const icon = (node: React.ReactNode) => node;

export function createCompanyItems(actions: {
  shutCompany: () => void;
  changeUser: () => void;
}): TopMenuItem[] {
  return [
    {
      id: "company-select",
      label: "Select Company",
      shortcut: "F3",
      page: "company-selector",
      permission: "company.select",
      icon: icon(<Building2 size={14} />),
      description: "Open an existing Nepal company dataset",
    },
    {
      id: "company-create",
      label: "Create Company",
      shortcut: "C",
      page: "company-create",
      permission: "company.create",
      adminOnly: true,
      icon: icon(<Building2 size={14} />),
    },
    {
      id: "company-alter",
      label: "Alter Company",
      shortcut: "A",
      page: "settings",
      permission: "company.alter",
      icon: icon(<Settings size={14} />),
    },
    {
      id: "company-shut",
      label: "Shut Company",
      shortcut: "Ctrl+F3",
      onClick: actions.shutCompany,
      permission: "company.shut",
      icon: icon(<HardDriveDownload size={14} />),
      danger: true,
    },
    { id: "company-div-1", label: "", kind: "divider" },
    {
      id: "company-security",
      label: "Security Control",
      shortcut: "S",
      page: "users",
      permission: "company.security",
      adminOnly: true,
      icon: icon(<Shield size={14} />),
    },
    {
      id: "company-roles",
      label: "User Roles",
      shortcut: "R",
      page: "users",
      permission: "company.users",
      adminOnly: true,
      icon: icon(<Users size={14} />),
    },
    {
      id: "company-change-user",
      label: "Change User",
      shortcut: "U",
      onClick: actions.changeUser,
      icon: icon(<KeyRound size={14} />),
    },
    {
      id: "company-encryption",
      label: "Data Encryption / Vault",
      shortcut: "V",
      page: "data-encryption",
      permission: "company.encryption",
      adminOnly: true,
      icon: icon(<Lock size={14} />),
    },
    {
      id: "company-features",
      label: "Company Features",
      shortcut: "F11",
      page: "company-features",
      permission: "company.features",
      icon: icon(<Settings size={14} />),
      description: "Enable VAT, inventory, TDS, payroll, banking",
    },
    {
      id: "company-license",
      label: "Licensing / Connect Options",
      shortcut: "L",
      page: "license",
      permission: "company.licensing",
      icon: icon(<BadgeCheck size={14} />),
    },
  ];
}

export function createDataItems(): TopMenuItem[] {
  return [
    {
      id: "data-backup",
      label: "Backup",
      shortcut: "B",
      page: "backup",
      permission: "data.backup",
      icon: icon(<Database size={14} />),
    },
    {
      id: "data-restore",
      label: "Restore",
      shortcut: "R",
      page: "backup-restore",
      permission: "data.restore",
      icon: icon(<HardDriveDownload size={14} />),
    },
    {
      id: "data-migrate",
      label: "Migrate",
      shortcut: "M",
      page: "data-migrate",
      permission: "data.migrate",
      adminOnly: true,
      icon: icon(<RefreshCw size={14} />),
    },
    {
      id: "data-split",
      label: "Split Company Data",
      shortcut: "S",
      page: "data-split",
      permission: "data.split",
      adminOnly: true,
      icon: icon(<SplitSquareHorizontal size={14} />),
    },
    {
      id: "data-repair",
      label: "Repair",
      shortcut: "P",
      page: "data-repair",
      permission: "data.repair",
      adminOnly: true,
      icon: icon(<Wrench size={14} />),
    },
    {
      id: "data-cloud-backup",
      label: "Cloud Backup / Drive Backup",
      shortcut: "C",
      page: "cloud-backup",
      permission: "data.cloud-backup",
      icon: icon(<Cloud size={14} />),
    },
  ];
}

export function createExchangeItems(): TopMenuItem[] {
  return [
    {
      id: "exchange-sync",
      label: "Synchronise",
      shortcut: "S",
      page: "exchange-sync",
      permission: "exchange.sync",
      icon: icon(<RefreshCw size={14} />),
    },
    {
      id: "exchange-import",
      label: "Import Exchange Data",
      shortcut: "I",
      page: "import-masters",
      permission: "exchange.sync",
      icon: icon(<Upload size={14} />),
    },
    {
      id: "exchange-export",
      label: "Export Exchange Data",
      shortcut: "E",
      page: "export-logs",
      permission: "exchange.sync",
      icon: icon(<Download size={14} />),
    },
    {
      id: "exchange-connect",
      label: "Connectivity Settings",
      shortcut: "C",
      page: "exchange-sync",
      permission: "exchange.connect",
      icon: icon(<Settings size={14} />),
    },
    {
      id: "exchange-logs",
      label: "Exchange Logs",
      shortcut: "L",
      page: "exchange-logs",
      permission: "exchange.sync",
      icon: icon(<History size={14} />),
    },
  ];
}

export function createImportItems(): TopMenuItem[] {
  return [
    {
      id: "import-masters",
      label: "Import Masters",
      shortcut: "M",
      page: "import-masters",
      permission: "import.masters",
      icon: icon(<Upload size={14} />),
    },
    {
      id: "import-transactions",
      label: "Import Transactions",
      shortcut: "T",
      page: "import-transactions",
      permission: "import.transactions",
      icon: icon(<FileText size={14} />),
    },
    {
      id: "import-bank",
      label: "Import Bank Statements",
      shortcut: "B",
      page: "bank-import",
      permission: "import.bank",
      icon: icon(<Database size={14} />),
    },
    {
      id: "import-inventory",
      label: "Import Inventory Data",
      shortcut: "I",
      page: "import-inventory",
      permission: "import.masters",
      icon: icon(<Upload size={14} />),
    },
    {
      id: "import-payroll",
      label: "Import Payroll Data",
      shortcut: "P",
      page: "import-payroll",
      permission: "import.masters",
      icon: icon(<Upload size={14} />),
    },
    {
      id: "import-einvoice",
      label: "Upload / Import E-Invoices",
      shortcut: "E",
      page: "e-invoice",
      permission: "import.einvoice",
      icon: icon(<FileText size={14} />),
    },
    {
      id: "import-ewaybill",
      label: "Upload / Import E-Way Bills",
      shortcut: "W",
      page: "e-waybill",
      permission: "import.ewaybill",
      icon: icon(<FileText size={14} />),
    },
    {
      id: "import-logs",
      label: "Import Logs",
      shortcut: "L",
      page: "import-logs",
      permission: "import.masters",
      icon: icon(<History size={14} />),
    },
  ];
}

export function createExportItems(actions: {
  exportCurrent: (format: "xlsx" | "pdf" | "csv" | "json" | "xml") => void;
}): TopMenuItem[] {
  return [
    {
      id: "export-current-heading",
      label: "Current Screen",
      kind: "heading",
    },
    {
      id: "export-current-xlsx",
      label: "Export Current Screen — Excel",
      shortcut: "E",
      onClick: () => actions.exportCurrent("xlsx"),
      permission: "export.current",
      icon: icon(<Download size={14} />),
    },
    {
      id: "export-current-pdf",
      label: "Export Current Screen — PDF",
      shortcut: "P",
      onClick: () => actions.exportCurrent("pdf"),
      permission: "export.current",
      icon: icon(<Download size={14} />),
    },
    {
      id: "export-current-json",
      label: "Export Current Screen — JSON",
      shortcut: "J",
      onClick: () => actions.exportCurrent("json"),
      permission: "export.current",
      icon: icon(<Download size={14} />),
    },
    { id: "export-div-1", label: "", kind: "divider" },
    {
      id: "export-masters",
      label: "Export Masters",
      shortcut: "M",
      page: "export-masters",
      permission: "export.masters",
      icon: icon(<Database size={14} />),
    },
    {
      id: "export-transactions",
      label: "Export Transactions",
      shortcut: "T",
      page: "export-transactions",
      permission: "export.transactions",
      icon: icon(<FileText size={14} />),
    },
    {
      id: "export-reports",
      label: "Export Reports",
      shortcut: "R",
      page: "export-reports",
      permission: "export.reports",
      icon: icon(<FileText size={14} />),
    },
    {
      id: "export-logs",
      label: "Export Logs",
      shortcut: "L",
      page: "export-logs",
      permission: "export.current",
      icon: icon(<History size={14} />),
    },
  ];
}

export function createShareItems(actions: {
  shareCurrent: (method: "email" | "whatsapp" | "link") => void;
}): TopMenuItem[] {
  return [
    {
      id: "share-email",
      label: "Email Current Report / Voucher",
      shortcut: "E",
      onClick: () => actions.shareCurrent("email"),
      permission: "share.email",
      icon: icon(<Mail size={14} />),
    },
    {
      id: "share-whatsapp",
      label: "WhatsApp Share",
      shortcut: "W",
      onClick: () => actions.shareCurrent("whatsapp"),
      permission: "share.whatsapp",
      icon: icon(<Mail size={14} />),
    },
    {
      id: "share-link",
      label: "Generate Share Link",
      shortcut: "L",
      onClick: () => actions.shareCurrent("link"),
      permission: "share.link",
      icon: icon(<Cloud size={14} />),
    },
    {
      id: "share-internal",
      label: "Share with Internal User",
      shortcut: "S",
      page: "share-history",
      permission: "share.link",
      icon: icon(<Users size={14} />),
    },
    {
      id: "share-email-settings",
      label: "Email Settings",
      shortcut: "T",
      page: "settings",
      permission: "share.email",
      icon: icon(<Settings size={14} />),
    },
    {
      id: "share-history",
      label: "Share History",
      shortcut: "H",
      page: "share-history",
      permission: "share.email",
      icon: icon(<History size={14} />),
    },
  ];
}

export function createPrintItems(actions: {
  printCurrent: () => void;
}): TopMenuItem[] {
  return [
    {
      id: "print-current",
      label: "Print Current Screen",
      shortcut: "P",
      onClick: actions.printCurrent,
      permission: "print.current",
      icon: icon(<Printer size={14} />),
    },
    {
      id: "print-configure",
      label: "Configure Print",
      shortcut: "C",
      page: "printer-settings",
      permission: "print.configure",
      icon: icon(<Settings size={14} />),
    },
    {
      id: "print-reports",
      label: "Print Reports",
      shortcut: "R",
      page: "print-reports",
      permission: "print.current",
      icon: icon(<FileText size={14} />),
    },
    {
      id: "print-vouchers",
      label: "Print Vouchers",
      shortcut: "V",
      page: "vouchers",
      permission: "print.current",
      icon: icon(<Printer size={14} />),
    },
    {
      id: "print-settings",
      label: "Printer Settings",
      shortcut: "S",
      page: "printer-settings",
      permission: "print.configure",
      icon: icon(<Settings size={14} />),
    },
    {
      id: "print-logs",
      label: "Print Logs",
      shortcut: "L",
      page: "print-logs",
      permission: "print.current",
      icon: icon(<History size={14} />),
    },
  ];
}

export function createHelpItems(actions: {
  openOnlineHelp: () => void;
  contactSupport: () => void;
}): TopMenuItem[] {
  return [
    {
      id: "help-open",
      label: "Open Help",
      shortcut: "F1",
      page: "help",
      icon: icon(<HelpCircle size={14} />),
    },
    {
      id: "help-upgrade",
      label: "Upgrade",
      shortcut: "U",
      page: "license",
      icon: icon(<BadgeCheck size={14} />),
    },
    {
      id: "help-troubleshoot",
      label: "Troubleshoot",
      shortcut: "T",
      page: "troubleshoot",
      icon: icon(<Wrench size={14} />),
    },
    {
      id: "help-settings",
      label: "Settings",
      shortcut: "S",
      page: "settings",
      icon: icon(<Settings size={14} />),
    },
    {
      id: "help-addons",
      label: "Add-On Manager",
      shortcut: "A",
      page: "addons",
      icon: icon(<Settings size={14} />),
    },
    {
      id: "help-contact",
      label: "Contact Support",
      shortcut: "C",
      onClick: actions.contactSupport,
      icon: icon(<Mail size={14} />),
    },
    {
      id: "help-about",
      label: "About",
      shortcut: "B",
      page: "about",
      icon: icon(<HelpCircle size={14} />),
    },
    {
      id: "help-online",
      label: "Online Help / Knowledge Base",
      shortcut: "Ctrl+F1",
      onClick: actions.openOnlineHelp,
      icon: icon(<Cloud size={14} />),
    },
  ];
}
