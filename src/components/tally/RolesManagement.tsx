// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Shield,
  Check,
  X,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";

type Permission = "full" | "view" | "none";
type VoucherPerm = {
  create: boolean;
  alter: boolean;
  delete: boolean;
  print: boolean;
  export: boolean;
};

interface RoleDef {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  masters: {
    accounts: Permission;
    inventory: Permission;
    statutory: Permission;
    payroll: Permission;
  };
  reports: {
    financial: Permission;
    accountBooks: Permission;
    inventoryReports: Permission;
    payrollReports: Permission;
    statutory: Permission;
  };
  companySettings: {
    f11: boolean;
    securityControl: boolean;
    companyAlt: boolean;
    tallyVault: boolean;
    backup: boolean;
    odbc: boolean;
  };
  restrictions: {
    cannotViewConfidentialLedgers: boolean;
    cannotExport: boolean;
    cannotPrint: boolean;
    maxVoucherAmount: number;
    allowedHours: string;
  };
  vouchers: {
    payment: VoucherPerm;
    receipt: VoucherPerm;
    contra: VoucherPerm;
    journal: VoucherPerm;
    salesInvoice: VoucherPerm;
    creditNote: VoucherPerm;
    purchaseBill: VoucherPerm;
    debitNote: VoucherPerm;
    deliveryNote: VoucherPerm;
    goodsReceiptNote: VoucherPerm;
    stockJournal: VoucherPerm;
    salesOrder: VoucherPerm;
    purchaseOrder: VoucherPerm;
    payrollVoucher: VoucherPerm;
    attendanceEntry: VoucherPerm;
  };
}

const FULL_VOUCHER_PERM: VoucherPerm = {
  create: true,
  alter: true,
  delete: true,
  print: true,
  export: true,
};
const NO_VOUCHER_PERM: VoucherPerm = {
  create: false,
  alter: false,
  delete: false,
  print: false,
  export: false,
};
const VIEW_VOUCHER_PERM: VoucherPerm = {
  create: false,
  alter: false,
  delete: false,
  print: true,
  export: false,
};

const BUILT_IN_ROLES: RoleDef[] = [
  {
    id: "administrator",
    name: "Administrator",
    description: "Full access to everything — cannot be restricted",
    isBuiltIn: true,
    masters: { accounts: "full", inventory: "full", statutory: "full", payroll: "full" },
    reports: {
      financial: "full",
      accountBooks: "full",
      inventoryReports: "full",
      payrollReports: "full",
      statutory: "full",
    },
    companySettings: {
      f11: true,
      securityControl: true,
      companyAlt: true,
      tallyVault: true,
      backup: true,
      odbc: true,
    },
    restrictions: {
      cannotViewConfidentialLedgers: false,
      cannotExport: false,
      cannotPrint: false,
      maxVoucherAmount: 0,
      allowedHours: "",
    },
    vouchers: {
      payment: FULL_VOUCHER_PERM,
      receipt: FULL_VOUCHER_PERM,
      contra: FULL_VOUCHER_PERM,
      journal: FULL_VOUCHER_PERM,
      salesInvoice: FULL_VOUCHER_PERM,
      creditNote: FULL_VOUCHER_PERM,
      purchaseBill: FULL_VOUCHER_PERM,
      debitNote: FULL_VOUCHER_PERM,
      deliveryNote: FULL_VOUCHER_PERM,
      goodsReceiptNote: FULL_VOUCHER_PERM,
      stockJournal: FULL_VOUCHER_PERM,
      salesOrder: FULL_VOUCHER_PERM,
      purchaseOrder: FULL_VOUCHER_PERM,
      payrollVoucher: FULL_VOUCHER_PERM,
      attendanceEntry: FULL_VOUCHER_PERM,
    },
  },
  {
    id: "accountant",
    name: "Accountant",
    description: "Full accounting access; no payroll; no admin settings",
    isBuiltIn: false,
    masters: { accounts: "full", inventory: "full", statutory: "view", payroll: "none" },
    reports: {
      financial: "view",
      accountBooks: "full",
      inventoryReports: "full",
      payrollReports: "none",
      statutory: "full",
    },
    companySettings: {
      f11: false,
      securityControl: false,
      companyAlt: false,
      tallyVault: false,
      backup: false,
      odbc: false,
    },
    restrictions: {
      cannotViewConfidentialLedgers: true,
      cannotExport: false,
      cannotPrint: false,
      maxVoucherAmount: 0,
      allowedHours: "09:00-20:00",
    },
    vouchers: {
      payment: FULL_VOUCHER_PERM,
      receipt: FULL_VOUCHER_PERM,
      contra: FULL_VOUCHER_PERM,
      journal: FULL_VOUCHER_PERM,
      salesInvoice: FULL_VOUCHER_PERM,
      creditNote: FULL_VOUCHER_PERM,
      purchaseBill: FULL_VOUCHER_PERM,
      debitNote: FULL_VOUCHER_PERM,
      deliveryNote: FULL_VOUCHER_PERM,
      goodsReceiptNote: FULL_VOUCHER_PERM,
      stockJournal: FULL_VOUCHER_PERM,
      salesOrder: FULL_VOUCHER_PERM,
      purchaseOrder: FULL_VOUCHER_PERM,
      payrollVoucher: NO_VOUCHER_PERM,
      attendanceEntry: NO_VOUCHER_PERM,
    },
  },
  {
    id: "sales-entry",
    name: "Sales Entry",
    description: "Sales Invoice + Sales Order create/print only; view Sales Register",
    isBuiltIn: false,
    masters: { accounts: "view", inventory: "view", statutory: "none", payroll: "none" },
    reports: {
      financial: "none",
      accountBooks: "none",
      inventoryReports: "view",
      payrollReports: "none",
      statutory: "none",
    },
    companySettings: {
      f11: false,
      securityControl: false,
      companyAlt: false,
      tallyVault: false,
      backup: false,
      odbc: false,
    },
    restrictions: {
      cannotViewConfidentialLedgers: true,
      cannotExport: true,
      cannotPrint: false,
      maxVoucherAmount: 50000,
      allowedHours: "09:00-20:00",
    },
    vouchers: {
      payment: NO_VOUCHER_PERM,
      receipt: NO_VOUCHER_PERM,
      contra: NO_VOUCHER_PERM,
      journal: NO_VOUCHER_PERM,
      salesInvoice: { create: true, alter: true, delete: false, print: true, export: false },
      creditNote: { create: true, alter: false, delete: false, print: true, export: false },
      purchaseBill: NO_VOUCHER_PERM,
      debitNote: NO_VOUCHER_PERM,
      deliveryNote: { create: true, alter: false, delete: false, print: true, export: false },
      goodsReceiptNote: NO_VOUCHER_PERM,
      stockJournal: NO_VOUCHER_PERM,
      salesOrder: { create: true, alter: true, delete: false, print: true, export: true },
      purchaseOrder: NO_VOUCHER_PERM,
      payrollVoucher: NO_VOUCHER_PERM,
      attendanceEntry: NO_VOUCHER_PERM,
    },
  },
  {
    id: "auditor",
    name: "Auditor",
    description: "View-only access to all reports and vouchers; cannot modify anything",
    isBuiltIn: false,
    masters: { accounts: "view", inventory: "view", statutory: "view", payroll: "view" },
    reports: {
      financial: "view",
      accountBooks: "view",
      inventoryReports: "view",
      payrollReports: "view",
      statutory: "view",
    },
    companySettings: {
      f11: false,
      securityControl: false,
      companyAlt: false,
      tallyVault: false,
      backup: false,
      odbc: false,
    },
    restrictions: {
      cannotViewConfidentialLedgers: false,
      cannotExport: false,
      cannotPrint: true,
      maxVoucherAmount: 0,
      allowedHours: "",
    },
    vouchers: {
      payment: VIEW_VOUCHER_PERM,
      receipt: VIEW_VOUCHER_PERM,
      contra: VIEW_VOUCHER_PERM,
      journal: VIEW_VOUCHER_PERM,
      salesInvoice: VIEW_VOUCHER_PERM,
      creditNote: VIEW_VOUCHER_PERM,
      purchaseBill: VIEW_VOUCHER_PERM,
      debitNote: VIEW_VOUCHER_PERM,
      deliveryNote: VIEW_VOUCHER_PERM,
      goodsReceiptNote: VIEW_VOUCHER_PERM,
      stockJournal: VIEW_VOUCHER_PERM,
      salesOrder: VIEW_VOUCHER_PERM,
      purchaseOrder: VIEW_VOUCHER_PERM,
      payrollVoucher: VIEW_VOUCHER_PERM,
      attendanceEntry: VIEW_VOUCHER_PERM,
    },
  },
  {
    id: "report-viewer",
    name: "Report Viewer",
    description: "View reports only; no voucher access",
    isBuiltIn: false,
    masters: { accounts: "view", inventory: "view", statutory: "none", payroll: "none" },
    reports: {
      financial: "view",
      accountBooks: "view",
      inventoryReports: "view",
      payrollReports: "none",
      statutory: "view",
    },
    companySettings: {
      f11: false,
      securityControl: false,
      companyAlt: false,
      tallyVault: false,
      backup: false,
      odbc: false,
    },
    restrictions: {
      cannotViewConfidentialLedgers: false,
      cannotExport: false,
      cannotPrint: false,
      maxVoucherAmount: 0,
      allowedHours: "",
    },
    vouchers: {
      payment: NO_VOUCHER_PERM,
      receipt: NO_VOUCHER_PERM,
      contra: NO_VOUCHER_PERM,
      journal: NO_VOUCHER_PERM,
      salesInvoice: NO_VOUCHER_PERM,
      creditNote: NO_VOUCHER_PERM,
      purchaseBill: NO_VOUCHER_PERM,
      debitNote: NO_VOUCHER_PERM,
      deliveryNote: NO_VOUCHER_PERM,
      goodsReceiptNote: NO_VOUCHER_PERM,
      stockJournal: NO_VOUCHER_PERM,
      salesOrder: NO_VOUCHER_PERM,
      purchaseOrder: NO_VOUCHER_PERM,
      payrollVoucher: NO_VOUCHER_PERM,
      attendanceEntry: NO_VOUCHER_PERM,
    },
  },
];

const RolesManagement = () => {
  const [roles, setRoles] = useState<RoleDef[]>(() => {
    const saved = localStorage.getItem("customRoles");
    return saved ? [...BUILT_IN_ROLES, ...JSON.parse(saved)] : BUILT_IN_ROLES;
  });
  const [editingRole, setEditingRole] = useState<RoleDef | null>(null);
  const [mode, setMode] = useState<"list" | "edit" | "create">("list");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["vouchers-accounting"]),
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const renderPermissionSelect = (
    label: string,
    value: Permission,
    onChange: (v: Permission) => void,
  ) => (
    <div className="flex rounded-md shadow-sm">
      <button
        onClick={() => onChange("full")}
        className={`px-3 py-1 text-[11px] font-bold border transition-colors rounded-l-md ${
          value === "full"
            ? "bg-[#059669] text-white border-[#059669] z-10"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        Full
      </button>
      <button
        onClick={() => onChange("view")}
        className={`px-3 py-1 text-[11px] font-bold border-y border-r transition-colors -ml-px ${
          value === "view"
            ? "bg-[#1557b0] text-white border-[#1557b0] z-10"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        View
      </button>
      <button
        onClick={() => onChange("none")}
        className={`px-3 py-1 text-[11px] font-bold border-y border-r transition-colors rounded-r-md -ml-px ${
          value === "none"
            ? "bg-[#dc2626] text-white border-[#dc2626] z-10"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        None
      </button>
    </div>
  );

  const renderYesNoToggle = (value: boolean, onChange: (v: boolean) => void) => (
    <div className="flex rounded-md shadow-sm">
      <button
        onClick={() => onChange(true)}
        className={`px-4 py-1 text-[11px] font-bold border transition-colors rounded-l-md ${
          value
            ? "bg-[#059669] text-white border-[#059669] z-10"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        Yes
      </button>
      <button
        onClick={() => onChange(false)}
        className={`px-4 py-1 text-[11px] font-bold border-y border-r transition-colors rounded-r-md -ml-px ${
          !value
            ? "bg-[#dc2626] text-white border-[#dc2626] z-10"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        No
      </button>
    </div>
  );

  const handleCreateNewRole = () => {
    const newRole: RoleDef = {
      id: "",
      name: "",
      description: "",
      isBuiltIn: false,
      masters: { accounts: "none", inventory: "none", statutory: "none", payroll: "none" },
      reports: {
        financial: "none",
        accountBooks: "none",
        inventoryReports: "none",
        payrollReports: "none",
        statutory: "none",
      },
      companySettings: {
        f11: false,
        securityControl: false,
        companyAlt: false,
        tallyVault: false,
        backup: false,
        odbc: false,
      },
      restrictions: {
        cannotViewConfidentialLedgers: false,
        cannotExport: false,
        cannotPrint: false,
        maxVoucherAmount: 0,
        allowedHours: "",
      },
      vouchers: {
        payment: NO_VOUCHER_PERM,
        receipt: NO_VOUCHER_PERM,
        contra: NO_VOUCHER_PERM,
        journal: NO_VOUCHER_PERM,
        salesInvoice: NO_VOUCHER_PERM,
        creditNote: NO_VOUCHER_PERM,
        purchaseBill: NO_VOUCHER_PERM,
        debitNote: NO_VOUCHER_PERM,
        deliveryNote: NO_VOUCHER_PERM,
        goodsReceiptNote: NO_VOUCHER_PERM,
        stockJournal: NO_VOUCHER_PERM,
        salesOrder: NO_VOUCHER_PERM,
        purchaseOrder: NO_VOUCHER_PERM,
        payrollVoucher: NO_VOUCHER_PERM,
        attendanceEntry: NO_VOUCHER_PERM,
      },
    };
    setEditingRole(newRole);
    setMode("create");
  };

  const handleEditRole = (role: RoleDef) => {
    setEditingRole({ ...role });
    setMode("edit");
  };

  const handleDuplicateRole = (role: RoleDef) => {
    const duplicate: RoleDef = {
      ...role,
      id: `${role.id}-copy-${Date.now()}`,
      name: `${role.name} (Copy)`,
      isBuiltIn: false,
    };
    setRoles((prev) => [...prev, duplicate]);
    localStorage.setItem(
      "customRoles",
      JSON.stringify(roles.filter((r) => !r.isBuiltIn).concat(duplicate)),
    );
    toast.success(`Role "${duplicate.name}" created successfully.`);
  };

  const handleDeleteRole = (roleId: string) => {
    if (
      window.confirm("Are you sure you want to delete this role? This action cannot be undone.")
    ) {
      setRoles((prev) => {
        const newRoles = prev.filter((r) => r.id !== roleId);
        localStorage.setItem("customRoles", JSON.stringify(newRoles.filter((r) => !r.isBuiltIn)));
        return newRoles;
      });
      toast.success("Role deleted successfully.");
    }
  };

  const handleSaveRole = () => {
    if (!editingRole?.name.trim()) {
      toast.error("Role name is required");
      return;
    }

    if (mode === "create") {
      const newRole = { ...editingRole, id: Date.now().toString() };
      setRoles((prev) => {
        const newRoles = [...prev, newRole];
        localStorage.setItem("customRoles", JSON.stringify(newRoles.filter((r) => !r.isBuiltIn)));
        return newRoles;
      });
    } else if (mode === "edit" && editingRole) {
      setRoles((prev) => {
        const newRoles = prev.map((r) => (r.id === editingRole.id ? editingRole : r));
        localStorage.setItem("customRoles", JSON.stringify(newRoles.filter((r) => !r.isBuiltIn)));
        return newRoles;
      });
    }

    setMode("list");
    setEditingRole(null);
    toast.success(`Role "${editingRole.name}" saved successfully.`);
  };

  const handleSetAllFullAccess = () => {
    if (!editingRole) return;

    setEditingRole((prev) => ({
      ...prev!,
      vouchers: {
        payment: FULL_VOUCHER_PERM,
        receipt: FULL_VOUCHER_PERM,
        contra: FULL_VOUCHER_PERM,
        journal: FULL_VOUCHER_PERM,
        salesInvoice: FULL_VOUCHER_PERM,
        creditNote: FULL_VOUCHER_PERM,
        purchaseBill: FULL_VOUCHER_PERM,
        debitNote: FULL_VOUCHER_PERM,
        deliveryNote: FULL_VOUCHER_PERM,
        goodsReceiptNote: FULL_VOUCHER_PERM,
        stockJournal: FULL_VOUCHER_PERM,
        salesOrder: FULL_VOUCHER_PERM,
        purchaseOrder: FULL_VOUCHER_PERM,
        payrollVoucher: FULL_VOUCHER_PERM,
        attendanceEntry: FULL_VOUCHER_PERM,
      },
    }));
  };

  const handleClearAll = () => {
    if (!editingRole) return;

    setEditingRole((prev) => ({
      ...prev!,
      vouchers: {
        payment: NO_VOUCHER_PERM,
        receipt: NO_VOUCHER_PERM,
        contra: NO_VOUCHER_PERM,
        journal: NO_VOUCHER_PERM,
        salesInvoice: NO_VOUCHER_PERM,
        creditNote: NO_VOUCHER_PERM,
        purchaseBill: NO_VOUCHER_PERM,
        debitNote: NO_VOUCHER_PERM,
        deliveryNote: NO_VOUCHER_PERM,
        goodsReceiptNote: NO_VOUCHER_PERM,
        stockJournal: NO_VOUCHER_PERM,
        salesOrder: NO_VOUCHER_PERM,
        purchaseOrder: NO_VOUCHER_PERM,
        payrollVoucher: NO_VOUCHER_PERM,
        attendanceEntry: NO_VOUCHER_PERM,
      },
    }));
  };

  if (mode === "list") {
    return (
      <div className="max-w-[900px] mx-auto p-5 font-sans">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">
              Security Roles & Permissions
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Manage access templates for different types of users
            </p>
          </div>
          <button
            onClick={handleCreateNewRole}
            className="flex items-center gap-1.5 h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md shadow-sm transition-colors"
          >
            <Plus size={16} />
            Create Custom Role
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Role Name
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Description
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-gray-800">{role.name}</span>
                      {role.isBuiltIn && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-bold uppercase tracking-wider">
                          Built-in
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-600">{role.description}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditRole(role)}
                        className="p-1.5 text-gray-500 hover:text-[#1557b0] hover:bg-blue-50 rounded transition-colors"
                        title="Edit Role"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDuplicateRole(role)}
                        className="p-1.5 text-gray-500 hover:text-[#059669] hover:bg-green-50 rounded transition-colors"
                        title="Duplicate Role"
                      >
                        <Copy size={16} />
                      </button>
                      {!role.isBuiltIn && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="p-1.5 text-gray-500 hover:text-[#dc2626] hover:bg-red-50 rounded transition-colors"
                          title="Delete Role"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // mode === 'edit' || 'create'
  return (
    <div className="max-w-[900px] mx-auto p-5 font-sans">
      <div className="flex items-center gap-4 mb-5">
        <button
          onClick={() => setMode("list")}
          className="flex items-center gap-1 text-[12px] font-medium text-gray-600 hover:text-[#1557b0] transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Roles
        </button>
        <div className="h-4 w-px bg-gray-300" />
        <h1 className="text-[15px] font-semibold text-gray-800">
          {mode === "create" ? "Create Custom Role" : `Edit Role: ${editingRole?.name}`}
        </h1>
      </div>

      {editingRole && (
        <div className="flex flex-col gap-4">
          {/* Basic Info Section */}
          <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Role Name
                </label>
                <input
                  type="text"
                  value={editingRole.name}
                  onChange={(e) =>
                    setEditingRole((prev) => (prev ? { ...prev, name: e.target.value } : null))
                  }
                  disabled={editingRole.isBuiltIn}
                  className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="e.g. Senior Cashier"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingRole.description}
                  onChange={(e) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, description: e.target.value } : null,
                    )
                  }
                  disabled={editingRole.isBuiltIn}
                  className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>
            {editingRole.isBuiltIn && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-100 rounded-md flex items-start gap-2">
                <Shield size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-blue-800">
                  This is a built-in role. You cannot change its name or description, but you can
                  alter its permissions. For a fresh start, duplicate this role.
                </div>
              </div>
            )}
          </div>

          {/* Masters Section */}
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div
              onClick={() => toggleSection("masters")}
              className="bg-gray-50 px-4 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200"
            >
              <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase">
                Masters (Ledgers, Items)
              </div>
              {expandedSections.has("masters") ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </div>
            {expandedSections.has("masters") && (
              <div className="divide-y divide-gray-100">
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">
                    Accounts Masters (Ledger, Group, Currency)
                  </div>
                  {renderPermissionSelect("", editingRole.masters.accounts, (v) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, masters: { ...prev.masters, accounts: v } } : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">
                    Inventory Masters (Item, Unit, Godown)
                  </div>
                  {renderPermissionSelect("", editingRole.masters.inventory, (v) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, masters: { ...prev.masters, inventory: v } } : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">Statutory Masters (GST, TDS)</div>
                  {renderPermissionSelect("", editingRole.masters.statutory, (v) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, masters: { ...prev.masters, statutory: v } } : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">Payroll Masters</div>
                  {renderPermissionSelect("", editingRole.masters.payroll, (v) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, masters: { ...prev.masters, payroll: v } } : null,
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reports Section */}
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div
              onClick={() => toggleSection("reports")}
              className="bg-gray-50 px-4 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200"
            >
              <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase">
                Reports
              </div>
              {expandedSections.has("reports") ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </div>
            {expandedSections.has("reports") && (
              <div className="divide-y divide-gray-100">
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">
                    Financial Reports (Balance Sheet, P&L)
                  </div>
                  {renderPermissionSelect("", editingRole.reports.financial, (v) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, reports: { ...prev.reports, financial: v } } : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">
                    Accounts Books (Day Book, Registers)
                  </div>
                  {renderPermissionSelect("", editingRole.reports.accountBooks, (v) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, reports: { ...prev.reports, accountBooks: v } } : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">Inventory Reports</div>
                  {renderPermissionSelect("", editingRole.reports.inventoryReports, (v) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, reports: { ...prev.reports, inventoryReports: v } } : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">Payroll Reports</div>
                  {renderPermissionSelect("", editingRole.reports.payrollReports, (v) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, reports: { ...prev.reports, payrollReports: v } } : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">Statutory Reports (GST/TDS)</div>
                  {renderPermissionSelect("", editingRole.reports.statutory, (v) =>
                    setEditingRole((prev) =>
                      prev ? { ...prev, reports: { ...prev.reports, statutory: v } } : null,
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Company Settings Section */}
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div
              onClick={() => toggleSection("settings")}
              className="bg-gray-50 px-4 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200"
            >
              <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase">
                Company Settings & Features
              </div>
              {expandedSections.has("settings") ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </div>
            {expandedSections.has("settings") && (
              <div className="divide-y divide-gray-100">
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">F11 Features & Configuration</div>
                  {renderYesNoToggle(editingRole.companySettings.f11, (v) =>
                    setEditingRole((prev) =>
                      prev
                        ? { ...prev, companySettings: { ...prev.companySettings, f11: v } }
                        : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">
                    Security Control / User Management
                  </div>
                  {renderYesNoToggle(editingRole.companySettings.securityControl, (v) =>
                    setEditingRole((prev) =>
                      prev
                        ? {
                            ...prev,
                            companySettings: { ...prev.companySettings, securityControl: v },
                          }
                        : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">Company Alteration (name, year)</div>
                  {renderYesNoToggle(editingRole.companySettings.companyAlt, (v) =>
                    setEditingRole((prev) =>
                      prev
                        ? { ...prev, companySettings: { ...prev.companySettings, companyAlt: v } }
                        : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">TallyVault Management</div>
                  {renderYesNoToggle(editingRole.companySettings.tallyVault, (v) =>
                    setEditingRole((prev) =>
                      prev
                        ? { ...prev, companySettings: { ...prev.companySettings, tallyVault: v } }
                        : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">Data Backup / Restore</div>
                  {renderYesNoToggle(editingRole.companySettings.backup, (v) =>
                    setEditingRole((prev) =>
                      prev
                        ? { ...prev, companySettings: { ...prev.companySettings, backup: v } }
                        : null,
                    ),
                  )}
                </div>
                <div className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                  <div className="text-[12px] text-gray-800">ODBC Configuration</div>
                  {renderYesNoToggle(editingRole.companySettings.odbc, (v) =>
                    setEditingRole((prev) =>
                      prev
                        ? { ...prev, companySettings: { ...prev.companySettings, odbc: v } }
                        : null,
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Voucher Type Security Section */}
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden mt-2">
            <div className="bg-[#1e2433] px-4 py-3 flex justify-between items-center">
              <div className="text-[12px] font-bold text-white tracking-wide uppercase">
                Voucher Operations
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSetAllFullAccess}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-semibold transition-colors"
                >
                  Set All Full
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-semibold transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Accounting Vouchers */}
            <div
              onClick={() => toggleSection("vouchers-accounting")}
              className="bg-gray-50 px-4 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200"
            >
              <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase">
                Accounting Vouchers
              </div>
              {expandedSections.has("vouchers-accounting") ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </div>
            {expandedSections.has("vouchers-accounting") && (
              <table className="w-full text-left border-collapse border-b border-gray-200">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Voucher Type
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Create
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Alter
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Delete
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Print
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Export
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {[
                    "payment",
                    "receipt",
                    "contra",
                    "journal",
                    "salesInvoice",
                    "creditNote",
                    "purchaseBill",
                    "debitNote",
                  ].map((voucherType) => {
                    const perms = editingRole.vouchers[
                      voucherType as keyof typeof editingRole.vouchers
                    ] as VoucherPerm;
                    return (
                      <tr key={voucherType} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-[11px] font-medium text-gray-800">
                          {voucherType.charAt(0).toUpperCase() +
                            voucherType.slice(1).replace(/([A-Z])/g, " $1")}
                        </td>
                        {["create", "alter", "delete", "print", "export"].map((perm) => (
                          <td key={perm} className="px-1 py-1">
                            <button
                              onClick={() =>
                                setEditingRole((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        vouchers: {
                                          ...prev.vouchers,
                                          [voucherType]: {
                                            ...perms,
                                            [perm]: !perms[perm as keyof VoucherPerm],
                                          },
                                        },
                                      }
                                    : null,
                                )
                              }
                              className={`w-full py-1.5 flex justify-center items-center rounded transition-colors ${
                                perms[perm as keyof VoucherPerm]
                                  ? "bg-green-50 text-green-600 hover:bg-green-100"
                                  : "bg-red-50 text-red-500 hover:bg-red-100"
                              }`}
                            >
                              {perms[perm as keyof VoucherPerm] ? (
                                <Check size={14} strokeWidth={3} />
                              ) : (
                                <X size={14} strokeWidth={3} />
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Inventory Vouchers */}
            <div
              onClick={() => toggleSection("vouchers-inventory")}
              className="bg-gray-50 px-4 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200"
            >
              <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase">
                Inventory Vouchers
              </div>
              {expandedSections.has("vouchers-inventory") ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </div>
            {expandedSections.has("vouchers-inventory") && (
              <table className="w-full text-left border-collapse border-b border-gray-200">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Voucher Type
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Create
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Alter
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Delete
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Print
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Export
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {["deliveryNote", "goodsReceiptNote", "stockJournal"].map((voucherType) => {
                    const perms = editingRole.vouchers[
                      voucherType as keyof typeof editingRole.vouchers
                    ] as VoucherPerm;
                    return (
                      <tr key={voucherType} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-[11px] font-medium text-gray-800">
                          {voucherType.charAt(0).toUpperCase() +
                            voucherType.slice(1).replace(/([A-Z])/g, " $1")}
                        </td>
                        {["create", "alter", "delete", "print", "export"].map((perm) => (
                          <td key={perm} className="px-1 py-1">
                            <button
                              onClick={() =>
                                setEditingRole((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        vouchers: {
                                          ...prev.vouchers,
                                          [voucherType]: {
                                            ...perms,
                                            [perm]: !perms[perm as keyof VoucherPerm],
                                          },
                                        },
                                      }
                                    : null,
                                )
                              }
                              className={`w-full py-1.5 flex justify-center items-center rounded transition-colors ${
                                perms[perm as keyof VoucherPerm]
                                  ? "bg-green-50 text-green-600 hover:bg-green-100"
                                  : "bg-red-50 text-red-500 hover:bg-red-100"
                              }`}
                            >
                              {perms[perm as keyof VoucherPerm] ? (
                                <Check size={14} strokeWidth={3} />
                              ) : (
                                <X size={14} strokeWidth={3} />
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Order Vouchers */}
            <div
              onClick={() => toggleSection("vouchers-order")}
              className="bg-gray-50 px-4 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200"
            >
              <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase">
                Order Vouchers
              </div>
              {expandedSections.has("vouchers-order") ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </div>
            {expandedSections.has("vouchers-order") && (
              <table className="w-full text-left border-collapse border-b border-gray-200">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Voucher Type
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Create
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Alter
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Delete
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Print
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Export
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {["salesOrder", "purchaseOrder"].map((voucherType) => {
                    const perms = editingRole.vouchers[
                      voucherType as keyof typeof editingRole.vouchers
                    ] as VoucherPerm;
                    return (
                      <tr key={voucherType} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-[11px] font-medium text-gray-800">
                          {voucherType.charAt(0).toUpperCase() +
                            voucherType.slice(1).replace(/([A-Z])/g, " $1")}
                        </td>
                        {["create", "alter", "delete", "print", "export"].map((perm) => (
                          <td key={perm} className="px-1 py-1">
                            <button
                              onClick={() =>
                                setEditingRole((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        vouchers: {
                                          ...prev.vouchers,
                                          [voucherType]: {
                                            ...perms,
                                            [perm]: !perms[perm as keyof VoucherPerm],
                                          },
                                        },
                                      }
                                    : null,
                                )
                              }
                              className={`w-full py-1.5 flex justify-center items-center rounded transition-colors ${
                                perms[perm as keyof VoucherPerm]
                                  ? "bg-green-50 text-green-600 hover:bg-green-100"
                                  : "bg-red-50 text-red-500 hover:bg-red-100"
                              }`}
                            >
                              {perms[perm as keyof VoucherPerm] ? (
                                <Check size={14} strokeWidth={3} />
                              ) : (
                                <X size={14} strokeWidth={3} />
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Payroll Vouchers */}
            <div
              onClick={() => toggleSection("vouchers-payroll")}
              className="bg-gray-50 px-4 py-2.5 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200"
            >
              <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase">
                Payroll Vouchers
              </div>
              {expandedSections.has("vouchers-payroll") ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </div>
            {expandedSections.has("vouchers-payroll") && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Voucher Type
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Create
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Alter
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Delete
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Print
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                      Export
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {["payrollVoucher", "attendanceEntry"].map((voucherType) => {
                    const perms = editingRole.vouchers[
                      voucherType as keyof typeof editingRole.vouchers
                    ] as VoucherPerm;
                    return (
                      <tr key={voucherType} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-[11px] font-medium text-gray-800">
                          {voucherType.charAt(0).toUpperCase() +
                            voucherType.slice(1).replace(/([A-Z])/g, " $1")}
                        </td>
                        {["create", "alter", "delete", "print", "export"].map((perm) => (
                          <td key={perm} className="px-1 py-1">
                            <button
                              onClick={() =>
                                setEditingRole((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        vouchers: {
                                          ...prev.vouchers,
                                          [voucherType]: {
                                            ...perms,
                                            [perm]: !perms[perm as keyof VoucherPerm],
                                          },
                                        },
                                      }
                                    : null,
                                )
                              }
                              className={`w-full py-1.5 flex justify-center items-center rounded transition-colors ${
                                perms[perm as keyof VoucherPerm]
                                  ? "bg-green-50 text-green-600 hover:bg-green-100"
                                  : "bg-red-50 text-red-500 hover:bg-red-100"
                              }`}
                            >
                              {perms[perm as keyof VoucherPerm] ? (
                                <Check size={14} strokeWidth={3} />
                              ) : (
                                <X size={14} strokeWidth={3} />
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setMode("list")}
              className="h-9 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRole}
              className="h-9 px-6 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
            >
              Save Role Permissions
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesManagement;
