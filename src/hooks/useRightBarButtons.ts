// @ts-nocheck
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useScreenContext } from "../context/ScreenContext";
import { useStore } from "../store/useStore";

export interface RightBarButton {
  id: string;
  shortcut: string;
  label: string;
  group: string;
  visible: boolean;
  enabled: boolean;
  active?: boolean;
  disabledReason?: string;
  action: () => void;
  confirmMessage?: string;
  auditLabel?: string;
}

const dispatch = (name: string, detail?: unknown) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const usePermissions = () => {
  return {
    canSave: true,
    canDelete: true,
    canExport: true,
    canPrint: true,
    canConfigure: true,
  };
};

export const useRightBarButtons = (): RightBarButton[] => {
  const { screenType, voucherType } = useScreenContext();
  const setCurrentPage = useStore((state) => state.setCurrentPage);
  const companySettings = useStore((state) => state.companySettings);
  const permissions = usePermissions();

  const [optionalMode, setOptionalMode] = useState(false);
  const [postDatedMode, setPostDatedMode] = useState(false);
  const [detailedMode, setDetailedMode] = useState(true);

  const hasInventory =
    companySettings?.enableStock !== false &&
    companySettings?.enableInventory !== false &&
    companySettings?.disableInventory !== true;

  const audit = (label: string) => {
    console.log("[AUDIT]", label, new Date().toISOString());
  };

  const run = (label: string | undefined, fn: () => void) => {
    return () => {
      if (label) audit(label);
      fn();
    };
  };

  return useMemo(() => {
    const commonVisible = true;

    const gatewayButtons: RightBarButton[] = [
      {
        id: "gateway-period",
        shortcut: "F2",
        label: "Period",
        group: "Navigation",
        visible: commonVisible,
        enabled: true,
        action: run("Open Period Selector", () =>
          toast.success("Period selector: coming soon (BS/AD)"),
        ),
        auditLabel: "Open Period Selector",
      },
      {
        id: "gateway-company",
        shortcut: "F3",
        label: "Company",
        group: "Navigation",
        visible: commonVisible,
        enabled: true,
        action: run("Switch Company", () => setCurrentPage("settings")),
      },
      {
        id: "gateway-features",
        shortcut: "F11",
        label: "Features",
        group: "Navigation",
        visible: commonVisible,
        enabled: true,
        action: run("Open Features", () => setCurrentPage("configuration")),
      },
      {
        id: "gateway-configure",
        shortcut: "F12",
        label: "Configure",
        group: "Navigation",
        visible: commonVisible,
        enabled: permissions.canConfigure,
        disabledReason: "No permission to configure",
        action: run("Open Settings", () => setCurrentPage("settings")),
      },
      {
        id: "gateway-print",
        shortcut: "Ctrl+P",
        label: "Print",
        group: "Actions",
        visible: commonVisible,
        enabled: permissions.canPrint,
        disabledReason: "No permission to print",
        action: run("Print Gateway", () => window.print()),
      },
      {
        id: "gateway-export",
        shortcut: "Ctrl+E",
        label: "Export",
        group: "Actions",
        visible: commonVisible,
        enabled: permissions.canExport,
        disabledReason: "No permission to export",
        action: run("Export Gateway", () =>
          toast.success("Export: use report screens for data export"),
        ),
      },
      {
        id: "gateway-quit",
        shortcut: "Esc",
        label: "Quit",
        group: "Actions",
        visible: commonVisible,
        enabled: true,
        confirmMessage: "Quit Sutra ERP?",
        action: run("Quit Application", () => {
          try {
            window.close();
          } catch {
            toast.error("Browser blocked window close.");
          }
        }),
      },
    ];

    const voucherTypeButtons: RightBarButton[] = [
      {
        id: "voucher-contra",
        shortcut: "F4",
        label: "Contra",
        group: "Voucher Type",
        visible: true,
        enabled: true,
        active: voucherType === "contra",
        action: run("Navigate Contra Voucher", () => setCurrentPage("contra")),
      },
      {
        id: "voucher-payment",
        shortcut: "F5",
        label: "Payment",
        group: "Voucher Type",
        visible: true,
        enabled: true,
        active: voucherType === "payment",
        action: run("Navigate Payment Voucher", () => setCurrentPage("payment")),
      },
      {
        id: "voucher-receipt",
        shortcut: "F6",
        label: "Receipt",
        group: "Voucher Type",
        visible: true,
        enabled: true,
        active: voucherType === "receipt",
        action: run("Navigate Receipt Voucher", () => setCurrentPage("receipt")),
      },
      {
        id: "voucher-journal",
        shortcut: "F7",
        label: "Journal",
        group: "Voucher Type",
        visible: true,
        enabled: true,
        active: voucherType === "journal",
        action: run("Navigate Journal Voucher", () => setCurrentPage("journal")),
      },
      {
        id: "voucher-sales",
        shortcut: "F8",
        label: "Sales",
        group: "Voucher Type",
        visible: true,
        enabled: true,
        active: voucherType === "sales",
        action: run("Navigate Sales Voucher", () => setCurrentPage("billing")),
      },
      {
        id: "voucher-purchase",
        shortcut: "F9",
        label: "Purchase",
        group: "Voucher Type",
        visible: true,
        enabled: true,
        active: voucherType === "purchase",
        action: run("Navigate Purchase Voucher", () => setCurrentPage("purchase-invoice")),
      },
    ];

    const voucherToolButtons: RightBarButton[] = [
      {
        id: "voucher-change-mode",
        shortcut: "Ctrl+H",
        label: "Change Mode",
        group: "Voucher Tools",
        visible: true,
        enabled: true,
        action: run("Change Voucher Mode", () =>
          toast.success("Toggle Single/Double entry mode"),
        ),
      },
      {
        id: "voucher-optional",
        shortcut: "Ctrl+L",
        label: optionalMode ? "Optional [ON]" : "Optional Mode",
        group: "Voucher Tools",
        visible: true,
        enabled: true,
        active: optionalMode,
        action: run("Toggle Optional Voucher", () => {
          const next = !optionalMode;
          setOptionalMode(next);
          toast.success(`Voucher marked Optional [${next ? "ON" : "OFF"}]`);
        }),
      },
      {
        id: "voucher-postdated",
        shortcut: "Ctrl+T",
        label: postDatedMode ? "Post-Dated [ON]" : "Post-Dated",
        group: "Voucher Tools",
        visible: true,
        enabled: true,
        active: postDatedMode,
        action: run("Toggle Post Dated Voucher", () => {
          const next = !postDatedMode;
          setPostDatedMode(next);
          toast.success(`Voucher marked Post-Dated [${next ? "ON" : "OFF"}]`);
        }),
      },
      {
        id: "voucher-autofill",
        shortcut: "Ctrl+F",
        label: "Autofill",
        group: "Voucher Tools",
        visible: true,
        enabled: true,
        action: run("Autofill Voucher", () => toast.success("Autofill from previous voucher")),
      },
      {
        id: "voucher-stock-query",
        shortcut: "Alt+S",
        label: "Stock Query",
        group: "Voucher Tools",
        visible: hasInventory,
        enabled: true,
        action: run("Open Stock Query", () => toast.success("Stock Query panel")),
      },
      {
        id: "voucher-more-details",
        shortcut: "Ctrl+I",
        label: "More Details",
        group: "Voucher Tools",
        visible: true,
        enabled: true,
        action: run("Open More Voucher Details", () =>
          toast.success("Additional voucher details"),
        ),
      },
      {
        id: "voucher-change-date",
        shortcut: "F2",
        label: "Change Date",
        group: "Voucher Tools",
        visible: true,
        enabled: true,
        action: run("Change Voucher Date", () =>
          toast.success("Change voucher date (BS/AD)"),
        ),
      },
      {
        id: "voucher-switch-company",
        shortcut: "F3",
        label: "Company",
        group: "Voucher Tools",
        visible: true,
        enabled: true,
        action: run("Switch Company From Voucher", () => setCurrentPage("settings")),
      },
      {
        id: "voucher-configure",
        shortcut: "F12",
        label: "Configure",
        group: "Voucher Tools",
        visible: true,
        enabled: permissions.canConfigure,
        disabledReason: "No permission to configure vouchers",
        action: run("Voucher Configuration", () => toast.success("Voucher configuration")),
      },
      {
        id: "voucher-ird",
        shortcut: "Alt+V",
        label: "IRD Portal",
        group: "Voucher Tools",
        visible: true,
        enabled: true,
        action: run("Open IRD Portal", () => {
          window.open("https://ird.gov.np", "_blank", "noopener,noreferrer");
        }),
      },
    ];

    const voucherActionButtons: RightBarButton[] = [
      {
        id: "voucher-save",
        shortcut: "Ctrl+A",
        label: "Accept/Save",
        group: "Actions",
        visible: true,
        enabled: permissions.canSave,
        disabledReason: "No permission to save",
        action: run("Accept Voucher", () => dispatch("rightbar:save")),
      },
      {
        id: "voucher-quit",
        shortcut: "Esc",
        label: "Quit/Discard",
        group: "Actions",
        visible: true,
        enabled: true,
        action: run("Discard Voucher", () => dispatch("rightbar:quit")),
      },
    ];

    const reportButtons: RightBarButton[] = [
      {
        id: "report-detailed",
        shortcut: "F1",
        label: detailedMode ? "Detailed" : "Condensed",
        group: "View Controls",
        visible: true,
        enabled: true,
        active: detailedMode,
        action: run("Toggle Report Detail", () => {
          const next = !detailedMode;
          setDetailedMode(next);
          dispatch("report:toggleDetailed", { detailed: next });
        }),
      },
      {
        id: "report-period",
        shortcut: "F2",
        label: "Period",
        group: "View Controls",
        visible: true,
        enabled: true,
        action: run("Change Report Period", () =>
          toast.success("Period: use the period selector in the report header (BS/AD)"),
        ),
      },
      {
        id: "report-view",
        shortcut: "Ctrl+H",
        label: "Change View",
        group: "View Controls",
        visible: true,
        enabled: true,
        action: run("Change Report View", () => toast.success("Switching report view")),
      },
      {
        id: "report-configure",
        shortcut: "F12",
        label: "Configure",
        group: "View Controls",
        visible: true,
        enabled: permissions.canConfigure,
        disabledReason: "No permission to configure reports",
        action: run("Report Configuration", () => toast.success("Report configuration")),
      },
      {
        id: "report-new-column",
        shortcut: "Alt+C",
        label: "New Column",
        group: "Report Tools",
        visible: true,
        enabled: true,
        action: run("New Report Column", () => dispatch("report:newColumn")),
      },
      {
        id: "report-alter-column",
        shortcut: "Alt+A",
        label: "Alter Column",
        group: "Report Tools",
        visible: true,
        enabled: true,
        action: run("Alter Report Column", () => dispatch("report:alterColumn")),
      },
      {
        id: "report-delete-column",
        shortcut: "Alt+D",
        label: "Delete Column",
        group: "Report Tools",
        visible: true,
        enabled: true,
        confirmMessage: "Delete this report column?",
        action: run("Delete Report Column", () => dispatch("report:deleteColumn")),
      },
      {
        id: "report-auto-column",
        shortcut: "Alt+N",
        label: "Auto Column",
        group: "Report Tools",
        visible: true,
        enabled: true,
        action: run("Auto Report Column", () => dispatch("report:autoColumn")),
      },
      {
        id: "report-basis",
        shortcut: "Ctrl+B",
        label: "Basis Values",
        group: "Report Tools",
        visible: true,
        enabled: true,
        action: run("Basis Of Values", () =>
          toast.success("Basis: Actuals / Budget / Variance"),
        ),
      },
      {
        id: "report-filter",
        shortcut: "Alt+F12",
        label: "Filter",
        group: "Report Tools",
        visible: true,
        enabled: true,
        action: run("Open Report Filter", () => dispatch("report:openFilter")),
      },
      {
        id: "report-exceptions",
        shortcut: "Ctrl+J",
        label: "Exceptions",
        group: "Report Tools",
        visible: true,
        enabled: true,
        action: run("Report Exceptions", () =>
          toast.success("Exception report: negative cash, missing VAT/PAN, etc."),
        ),
      },
      {
        id: "report-print",
        shortcut: "Ctrl+P",
        label: "Print",
        group: "Actions",
        visible: true,
        enabled: permissions.canPrint,
        disabledReason: "No permission to print",
        action: run("Print Report", () => window.print()),
      },
      {
        id: "report-export",
        shortcut: "Ctrl+E",
        label: "Export",
        group: "Actions",
        visible: true,
        enabled: permissions.canExport,
        disabledReason: "No permission to export",
        action: run("Export Report", () => dispatch("report:export")),
      },
      {
        id: "report-email",
        shortcut: "Ctrl+M",
        label: "E-mail",
        group: "Actions",
        visible: true,
        enabled: true,
        action: run("Email Report", () =>
          toast.success("E-mail report: configure SMTP in Settings"),
        ),
      },
      {
        id: "report-quit",
        shortcut: "Esc",
        label: "Quit",
        group: "Actions",
        visible: true,
        enabled: true,
        action: run("Quit Report", () => setCurrentPage("dashboard")),
      },
    ];

    const masterButtons: RightBarButton[] = [
      {
        id: "master-configure",
        shortcut: "F12",
        label: "Configure",
        group: "Tools",
        visible: true,
        enabled: permissions.canConfigure,
        disabledReason: "No permission to configure masters",
        action: run("Master Configuration", () => toast.success("Master configuration")),
      },
      {
        id: "master-language",
        shortcut: "Ctrl+K",
        label: "Language",
        group: "Tools",
        visible: true,
        enabled: true,
        action: run("Master Language", () =>
          toast.success("Display language: English / Nepali"),
        ),
      },
      {
        id: "master-input-lang",
        shortcut: "Ctrl+W",
        label: "Input Lang",
        group: "Tools",
        visible: true,
        enabled: true,
        action: run("Master Input Language", () => toast.success("Data entry language")),
      },
      {
        id: "master-save",
        shortcut: "Ctrl+A",
        label: "Accept/Save",
        group: "Actions",
        visible: true,
        enabled: permissions.canSave,
        disabledReason: "No permission to save",
        action: run("Save Master", () => dispatch("rightbar:save")),
      },
      {
        id: "master-delete",
        shortcut: "Alt+D",
        label: "Delete",
        group: "Actions",
        visible: true,
        enabled: permissions.canDelete,
        disabledReason: "No permission to delete",
        confirmMessage: "Delete this master? This cannot be undone.",
        action: run("Delete Master", () => dispatch("rightbar:delete")),
      },
      {
        id: "master-quit",
        shortcut: "Esc",
        label: "Quit",
        group: "Actions",
        visible: true,
        enabled: true,
        action: run("Quit Master", () => dispatch("rightbar:quit")),
      },
    ];

    const configButtons: RightBarButton[] = [
      {
        id: "config-save",
        shortcut: "Ctrl+A",
        label: "Save Settings",
        group: "Actions",
        visible: true,
        enabled: permissions.canSave,
        disabledReason: "No permission to save settings",
        action: run("Save Settings", () => dispatch("rightbar:save")),
      },
      {
        id: "config-cancel",
        shortcut: "Esc",
        label: "Cancel",
        group: "Actions",
        visible: true,
        enabled: true,
        action: run("Cancel Configuration", () => setCurrentPage("dashboard")),
      },
      {
        id: "config-advanced",
        shortcut: "F12",
        label: "Configure",
        group: "Actions",
        visible: true,
        enabled: permissions.canConfigure,
        disabledReason: "No permission to configure",
        action: run("Advanced Configuration", () => toast.success("Advanced configuration")),
      },
    ];

    const listInventoryButtons: RightBarButton[] = [
      {
        id: "list-insert",
        shortcut: "Alt+I",
        label: "Insert",
        group: "Actions",
        visible: true,
        enabled: true,
        action: run("Insert Record", () => toast.success("Insert new record")),
      },
      {
        id: "list-add-new",
        shortcut: "Alt+A",
        label: "Add New",
        group: "Actions",
        visible: true,
        enabled: true,
        action: run("Add New Record", () => dispatch("rightbar:addNew")),
      },
      {
        id: "list-cancel",
        shortcut: "Alt+X",
        label: "Cancel Rec.",
        group: "Actions",
        visible: true,
        enabled: true,
        confirmMessage: "Cancel selected record?",
        action: run("Cancel Record", () => toast.success("Cancel selected record")),
      },
      {
        id: "list-delete",
        shortcut: "Alt+D",
        label: "Delete",
        group: "Actions",
        visible: true,
        enabled: permissions.canDelete,
        disabledReason: "No permission to delete",
        confirmMessage: "Delete selected record?",
        action: run("Delete Record", () => dispatch("rightbar:delete")),
      },
      {
        id: "list-print",
        shortcut: "Ctrl+P",
        label: "Print",
        group: "Actions",
        visible: true,
        enabled: permissions.canPrint,
        disabledReason: "No permission to print",
        action: run("Print List", () => window.print()),
      },
      {
        id: "list-export",
        shortcut: "Ctrl+E",
        label: "Export",
        group: "Actions",
        visible: true,
        enabled: permissions.canExport,
        disabledReason: "No permission to export",
        action: run("Export List", () => dispatch("report:export")),
      },
      {
        id: "list-back",
        shortcut: "Esc",
        label: "Back",
        group: "Actions",
        visible: true,
        enabled: true,
        action: run("Back From List", () => {
          if (window.history.length > 1) window.history.back();
          else setCurrentPage("dashboard");
        }),
      },
    ];

    if (screenType === "gateway") return gatewayButtons;
    if (screenType === "voucher")
      return [...voucherTypeButtons, ...voucherToolButtons, ...voucherActionButtons];
    if (screenType === "report") return reportButtons;
    if (screenType === "master") return masterButtons;
    if (screenType === "config") return configButtons;
    return listInventoryButtons;
  }, [
    screenType,
    voucherType,
    setCurrentPage,
    companySettings,
    permissions.canConfigure,
    permissions.canDelete,
    permissions.canExport,
    permissions.canPrint,
    permissions.canSave,
    optionalMode,
    postDatedMode,
    detailedMode,
    hasInventory,
  ]);
};

export default useRightBarButtons;
