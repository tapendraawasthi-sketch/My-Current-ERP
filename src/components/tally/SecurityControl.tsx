// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Shield, Eye, EyeOff, AlertTriangle } from "lucide-react";
import toast from "@/lib/appToast";

const SecurityControl = () => {
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [adminName, setAdminName] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [auditEnabled, setAuditEnabled] = useState(false);
  const [tab, setTab] = useState<"overview" | "admin" | "audit">("overview");
  const [auditFilter, setAuditFilter] = useState({
    user: "",
    action: "",
    dateFrom: "",
    dateTo: "",
  });
  const [showSetupForm, setShowSetupForm] = useState(false);

  const MOCK_AUDIT = [
    {
      timestamp: "2024-04-05 10:32:15",
      user: "accounts1",
      action: "CREATE" as const,
      voucher: "SI-001",
      details: "Sales Invoice ₹11,800 — ABC Traders",
    },
    {
      timestamp: "2024-04-05 14:15:30",
      user: "accounts1",
      action: "ALTER" as const,
      voucher: "SI-001",
      details: "Changed amount from ₹10,000 to ₹11,800",
    },
    {
      timestamp: "2024-04-05 14:20:00",
      user: "manager",
      action: "APPROVE" as const,
      voucher: "SI-001",
      details: "Marked approved",
    },
    {
      timestamp: "2024-04-06 09:00:00",
      user: "admin",
      action: "DELETE" as const,
      voucher: "SI-001",
      details: "Deleted — Reason: Duplicate entry",
    },
    {
      timestamp: "2024-04-06 09:30:00",
      user: "accounts1",
      action: "CREATE" as const,
      voucher: "PB-001",
      details: "Purchase Bill ₹47,200 — XYZ Suppliers",
    },
    {
      timestamp: "2024-04-06 11:00:00",
      user: "salesperson",
      action: "CREATE" as const,
      voucher: "SO-001",
      details: "Sales Order ₹25,000 — New Customer",
    },
    {
      timestamp: "2024-04-06 11:05:00",
      user: "salesperson",
      action: "LOGIN" as const,
      voucher: "—",
      details: "Logged in from 192.168.1.15",
    },
    {
      timestamp: "2024-04-06 17:30:00",
      user: "salesperson",
      action: "LOGOUT" as const,
      voucher: "—",
      details: "Session ended — idle timeout",
    },
  ];

  useEffect(() => {
    const isEnabled = localStorage.getItem("securityEnabled") === "true";
    setSecurityEnabled(isEnabled);
    setAdminName(localStorage.getItem("adminName") || "admin");
    setAuditEnabled(localStorage.getItem("auditEnabled") === "true");
    setShowSetupForm(!isEnabled);
  }, []);

  const handleEnableSecurity = () => {
    setSecurityEnabled(true);
    localStorage.setItem("securityEnabled", "true");
    setShowSetupForm(true);
  };

  const handleDisableSecurity = () => {
    if (!window.confirm("Disabling security removes all user restrictions. Are you sure?")) return;
    setSecurityEnabled(false);
    localStorage.setItem("securityEnabled", "false");
    toast.success("Security control disabled.");
  };

  const handleActivateSecurity = () => {
    if (!adminName.trim()) {
      toast.error("Enter administrator name");
      return;
    }
    if (adminPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (adminPassword !== confirmAdminPassword) {
      toast.error("Passwords do not match");
      return;
    }

    localStorage.setItem("adminName", adminName);
    localStorage.setItem("adminSetup", "true");
    localStorage.setItem("auditEnabled", String(auditEnabled));
    setShowSetupForm(false);
    toast.success("Security control activated! Administrator: " + adminName);
  };

  const filteredAudit = MOCK_AUDIT.filter((row) => {
    if (auditFilter.user && !row.user.toLowerCase().includes(auditFilter.user.toLowerCase()))
      return false;
    if (
      auditFilter.action &&
      auditFilter.action !== "All Actions" &&
      row.action !== auditFilter.action
    )
      return false;
    return true;
  });

  return (
    <div className="max-w-[850px] mx-auto p-5 font-sans">
      {/* Page Header */}
      <div className="bg-[#1e2433] px-4 py-3 rounded-t-lg flex justify-between items-center border-b border-gray-700 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-white" />
          <span className="text-[14px] font-semibold text-white tracking-wide">
            Security Control
          </span>
        </div>
        <div
          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-white shadow-sm flex items-center gap-1.5 ${
            securityEnabled ? "bg-[#059669]" : "bg-[#dc2626]"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          {securityEnabled ? "Security Active" : "Security Inactive"}
        </div>
      </div>

      {/* Security Toggle Row */}
      <div className="bg-gray-50 border-x border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="text-[12px] font-medium text-gray-800">
          Use Security Control for this company
        </div>
        <div className="flex rounded-md shadow-sm">
          <button
            onClick={handleEnableSecurity}
            className={`px-4 py-1.5 text-[11px] font-bold rounded-l-md border transition-colors ${
              securityEnabled
                ? "bg-[#059669] text-white border-[#059669] z-10"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Yes
          </button>
          <button
            onClick={handleDisableSecurity}
            className={`px-4 py-1.5 text-[11px] font-bold rounded-r-md border-y border-r transition-colors ${
              !securityEnabled
                ? "bg-[#dc2626] text-white border-[#dc2626] z-10 -ml-px"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 -ml-px"
            }`}
          >
            No
          </button>
        </div>
      </div>

      {/* Setup Form */}
      {showSetupForm && !localStorage.getItem("adminSetup") && (
        <div className="bg-amber-50 border-x border-b border-amber-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <div className="text-[13px] font-bold text-amber-800">
              Configure Administrator Account
            </div>
          </div>
          <div className="text-[11px] text-amber-700 mb-4 ml-6">
            The Administrator is the master account that can manage all users and cannot be deleted.
          </div>

          <div className="grid grid-cols-2 gap-4 ml-6 max-w-lg">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-amber-900 mb-1">
                Name of Administrator
              </label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full h-8 px-2.5 text-[12px] border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-amber-900 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showAdminPass ? "text" : "password"}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={() => setShowAdminPass(!showAdminPass)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showAdminPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-amber-900 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showAdminPass ? "text" : "password"}
                  value={confirmAdminPassword}
                  onChange={(e) => setConfirmAdminPassword(e.target.value)}
                  className="w-full h-8 pl-2.5 pr-8 text-[12px] border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={() => setShowAdminPass(!showAdminPass)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showAdminPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-5 ml-6">
            <div className="text-[12px] font-medium text-amber-900">Use Tally Audit Features</div>
            <div className="flex rounded-md shadow-sm">
              <button
                onClick={() => setAuditEnabled(true)}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-l-md border transition-colors ${
                  auditEnabled
                    ? "bg-[#059669] text-white border-[#059669] z-10"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setAuditEnabled(false)}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-r-md border-y border-r transition-colors ${
                  !auditEnabled
                    ? "bg-[#dc2626] text-white border-[#dc2626] z-10 -ml-px"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 -ml-px"
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div className="ml-6 mt-5 max-w-lg">
            <button
              onClick={handleActivateSecurity}
              className="w-full h-9 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
            >
              Activate Security
            </button>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      {securityEnabled && (
        <div className="flex bg-gray-50 border-x border-b border-gray-200 shadow-sm mt-0">
          <button
            onClick={() => setTab("overview")}
            className={`px-5 py-2.5 text-[12px] font-medium transition-colors border-b-2 flex-1 ${
              tab === "overview"
                ? "bg-white text-[#1557b0] border-[#1557b0]"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab("admin")}
            className={`px-5 py-2.5 text-[12px] font-medium transition-colors border-b-2 flex-1 ${
              tab === "admin"
                ? "bg-white text-[#1557b0] border-[#1557b0]"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent"
            }`}
          >
            Admin Account
          </button>
          <button
            onClick={() => setTab("audit")}
            className={`px-5 py-2.5 text-[12px] font-medium transition-colors border-b-2 flex-1 ${
              tab === "audit"
                ? "bg-white text-[#1557b0] border-[#1557b0]"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent"
            }`}
          >
            Audit Trail
          </button>
        </div>
      )}

      {/* Main Content */}
      <div
        className={`bg-[#f5f6fa] border-x border-b border-gray-200 p-5 shadow-sm ${!showSetupForm && securityEnabled ? "rounded-b-lg" : ""}`}
      >
        {tab === "overview" && securityEnabled && (
          <div className="grid grid-cols-[1fr_2fr] gap-5">
            {/* Left - Security Architecture */}
            <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm h-fit">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
                RBAC Architecture
              </div>
              <pre className="font-mono text-[10px] leading-relaxed text-gray-700 whitespace-pre overflow-x-auto">
                {`COMPANY
  └ SECURITY CONTROL
    └ ROLES (Templates)
      ├ Administrator
      ├ Accountant
      ├ Sales Entry
      ├ Manager
      └ Auditor (view)
    └ USERS (Accounts)
      ├ admin → Admin
      ├ accounts1 → Acct
      ├ salesperson → Sales
      └ owner → Manager`}
              </pre>
            </div>

            {/* Right - Roles Table */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-1/3">
                      Role
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Default Access
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">
                      Administrator
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      Full access — cannot be restricted
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">Owner</td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      Full access except Security Control
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">Accountant</td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      All accounting + inventory; no payroll/security
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">
                      Data Entry Operator
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      Create vouchers only; no reports
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">
                      Sales Person
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      Sales Invoice + Order; view Sales Register
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">
                      Purchase Manager
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      Purchase Bill + Order; no Sales access
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">
                      Inventory Manager
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      Full inventory; no accounting vouchers
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">
                      Payroll Officer
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      Full payroll; no accounting/inventory
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">Auditor</td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      View-only; cannot create/alter/delete
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] font-medium text-gray-800">
                      Report Viewer
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-600">
                      Reports only; no voucher access
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "admin" && securityEnabled && (
          <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <div>
                <div className="text-[14px] font-bold text-gray-800">{adminName}</div>
                <div className="text-[11px] text-gray-500">Built-in Administrator</div>
              </div>
              <div className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-bold uppercase tracking-wider">
                Active
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Current Password
              </label>
              <input
                type="password"
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-colors"
              />
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                New Password
              </label>
              <input
                type="password"
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-colors"
              />
              <div className="flex gap-1 h-1.5 mt-2">
                <div className="flex-1 rounded-full bg-amber-500" />
                <div className="flex-1 rounded-full bg-amber-500" />
                <div className="flex-1 rounded-full bg-gray-200" />
                <div className="flex-1 rounded-full bg-gray-200" />
              </div>
              <div className="text-[10px] text-amber-600 font-medium mt-1">
                Password Strength: Fair
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-colors"
              />
            </div>

            <button
              onClick={() =>
                toast.success(
                  "Admin password changed successfully. Keep it safe — there is no recovery option.",
                )
              }
              className="w-full h-8 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
            >
              Change Admin Password
            </button>

            <div className="mt-5 p-3 bg-blue-50 border border-blue-100 rounded-md">
              <div className="text-[11px] text-blue-800 leading-snug">
                <span className="font-semibold">Note:</span> The administrator account has
                unrestricted access and cannot be deleted. Last login was simulated at{" "}
                {new Date().toLocaleString()}.
              </div>
            </div>
          </div>
        )}

        {tab === "audit" && securityEnabled && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm">
            {/* Audit Toggle Row */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-md">
              <div className="text-[12px] font-medium text-gray-800">
                Use Tally Audit Features (Voucher Audit Trail)
              </div>
              <div className="flex rounded-md shadow-sm">
                <button
                  onClick={() => {
                    setAuditEnabled(true);
                    localStorage.setItem("auditEnabled", "true");
                  }}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-l-md border transition-colors ${
                    auditEnabled
                      ? "bg-[#059669] text-white border-[#059669] z-10"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => {
                    setAuditEnabled(false);
                    localStorage.setItem("auditEnabled", "false");
                  }}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-r-md border-y border-r transition-colors ${
                    !auditEnabled
                      ? "bg-[#dc2626] text-white border-[#dc2626] z-10 -ml-px"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 -ml-px"
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {!auditEnabled && (
              <div className="p-8 text-center border-t border-gray-100">
                <Shield className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <div className="text-[12px] font-medium text-gray-600">Audit trail is disabled</div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Enable above to track all voucher changes and user actions.
                </div>
              </div>
            )}

            {auditEnabled && (
              <div className="p-4">
                {/* Filter Row */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <input
                    type="text"
                    placeholder="Filter by user..."
                    value={auditFilter.user}
                    onChange={(e) => setAuditFilter({ ...auditFilter, user: e.target.value })}
                    className="h-8 px-2.5 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] w-36"
                  />
                  <select
                    value={auditFilter.action}
                    onChange={(e) => setAuditFilter({ ...auditFilter, action: e.target.value })}
                    className="h-8 px-2.5 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] w-32"
                  >
                    <option>All Actions</option>
                    <option>CREATE</option>
                    <option>ALTER</option>
                    <option>DELETE</option>
                    <option>APPROVE</option>
                    <option>LOGIN</option>
                    <option>LOGOUT</option>
                  </select>
                  <input
                    type="date"
                    value={auditFilter.dateFrom}
                    onChange={(e) => setAuditFilter({ ...auditFilter, dateFrom: e.target.value })}
                    className="h-8 px-2.5 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] w-32"
                  />
                  <input
                    type="date"
                    value={auditFilter.dateTo}
                    onChange={(e) => setAuditFilter({ ...auditFilter, dateTo: e.target.value })}
                    className="h-8 px-2.5 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] w-32"
                  />
                  <button
                    onClick={() =>
                      setAuditFilter({ user: "", action: "", dateFrom: "", dateTo: "" })
                    }
                    className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>

                {/* Audit Table */}
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Timestamp
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          User
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Action
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Voucher
                        </th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredAudit.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-[11px] text-gray-600 font-mono">
                            {row.timestamp}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-gray-800 font-medium">
                            {row.user}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold uppercase tracking-wider border ${
                                row.action === "CREATE"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : row.action === "ALTER"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : row.action === "DELETE"
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : row.action === "APPROVE"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-gray-100 text-gray-600 border-gray-200"
                              }`}
                            >
                              {row.action}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-gray-600">{row.voucher}</td>
                          <td className="px-3 py-2.5 text-[11px] text-gray-800">{row.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Audit Integrity Note */}
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex gap-2">
                  <Shield size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-800 leading-snug">
                    <span className="font-semibold">Security Note:</span> Audit logs are
                    append-only. No user (including the Administrator) can delete or edit them
                    through the application. TallyVault encryption protects audit logs from physical
                    file access tampering.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityControl;
