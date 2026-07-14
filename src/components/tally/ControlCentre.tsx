// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Monitor,
  Cloud,
  RefreshCw,
  Users,
  Wifi,
  WifiOff,
  Download,
  AlertTriangle,
  CheckCircle,
  Settings,
  Globe,
  Key,
  CreditCard,
  Clock,
  Shield,
} from "lucide-react";
import toast from "@/lib/appToast";
import { useStore } from "../../store/useStore";

const ControlCentre = () => {
  const { companySettings } = useStore();
  const [tab, setTab] = useState<"license" | "account" | "services" | "remote" | "updates">(
    "license",
  );
  const [activeSessions, setActiveSessions] = useState([
    { user: "accounts1", machine: "PC-1", since: "09:15 AM" },
    { user: "salesperson", machine: "PC-2", since: "10:30 AM" },
    { user: "owner", machine: "PC-3 (Remote)", since: "11:00 AM" },
  ]);
  const [updateChannel, setUpdateChannel] = useState<"stable" | "beta" | "manual">("stable");
  const [autoDownload, setAutoDownload] = useState(true);
  const [autoInstall, setAutoInstall] = useState(false);
  const [odbcPort, setOdbcPort] = useState("9000");
  const [remoteEnabled, setRemoteEnabled] = useState(
    () => localStorage.getItem("remoteEnabled") === "true",
  );
  const [remoteMode, setRemoteMode] = useState<"relay" | "tunnel">("relay");
  const [whitelistIPs, setWhitelistIPs] = useState("");
  const [maxRemoteConns, setMaxRemoteConns] = useState("2");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(true);

  const handleForceLogout = (sessionIndex: number) => {
    const session = activeSessions[sessionIndex];
    setActiveSessions((prev) => prev.filter((_, i) => i !== sessionIndex));
    toast.success(`User ${session.user} logged out forcibly`);
  };

  const handleSaveRemoteSettings = () => {
    localStorage.setItem("remoteEnabled", String(remoteEnabled));
    toast.success("Remote access settings saved.");
  };

  const handleTestConnection = () => {
    toast.loading("Testing connection...");
    setTimeout(() => {
      toast.success("Connection test successful! Ping: 42ms");
    }, 1500);
  };

  const handleCheckForUpdates = () => {
    setCheckingUpdate(true);
    setTimeout(() => {
      setCheckingUpdate(false);
      toast.success("Checking for updates... Version 4.2.1 is available!");
    }, 2000);
  };

  const handleInstallNow = () => {
    toast.success("Download started. Update will be installed at next restart.");
  };

  const handleRollback = () => {
    if (window.confirm("Are you sure you want to rollback to the previous version?")) {
      toast.success("Rollback initiated. Previous version will be restored at next restart.");
    }
  };

  const handleDeactivate = () => {
    toast.warning("Deactivation request sent. This machine will lose access after confirmation.");
  };

  return (
    <div className="max-w-[850px] mx-auto p-5 font-sans">
      {/* Page Header */}
      <div className="bg-[#1e2433] px-4 py-3 rounded-t-lg flex items-center gap-2 border-b border-gray-700 shadow-sm">
        <Monitor size={20} className="text-white" />
        <span className="text-[14px] font-semibold text-white tracking-wide">
          Control Centre — License & Account Management
        </span>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-gray-50 border-x border-b border-gray-200 shadow-sm">
        {[
          { key: "license", label: "License", icon: <Key size={14} /> },
          { key: "account", label: "Online Account", icon: <Globe size={14} /> },
          { key: "services", label: "Cloud Services", icon: <Cloud size={14} /> },
          { key: "remote", label: "Remote Access", icon: <Wifi size={14} /> },
          { key: "updates", label: "Updates", icon: <Download size={14} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`px-4 py-2.5 text-[12px] font-medium transition-colors border-b-2 flex-1 flex items-center justify-center gap-1.5 ${
              tab === key
                ? "bg-white text-[#1557b0] border-[#1557b0]"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Main Area */}
      <div className="bg-[#f5f6fa] border border-gray-200 border-t-0 p-5 rounded-b-lg shadow-sm">
        {tab === "license" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column */}
            <div className="flex flex-col gap-5">
              {/* License Info Card */}
              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
                  License Information
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-gray-500 font-medium">Product:</span>
                    <span className="font-semibold text-gray-800">Sutra ERP — Nepal Edition</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-gray-500 font-medium">Edition:</span>
                    <span className="font-semibold text-gray-800">
                      Gold (Multi-User, 10 licenses)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-gray-500 font-medium">Serial Number:</span>
                    <span className="font-mono font-semibold text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                      SUTRA-2024-NPL-XXXXXX
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-gray-500 font-medium">Status:</span>
                    <span className="bg-green-50 border border-green-200 text-green-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle size={10} strokeWidth={3} /> ACTIVE
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-gray-500 font-medium">Valid Until:</span>
                    <span className="font-semibold text-gray-800">31/03/2026</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] pt-2 border-t border-gray-100">
                    <span className="text-gray-500 font-medium">Last Validated:</span>
                    <span className="font-semibold text-gray-600 text-[11px]">
                      Today, 09:45 AM ✓ (Online)
                    </span>
                  </div>
                </div>
              </div>

              {/* Subscription Card */}
              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
                  Subscription
                </div>

                <div className="grid grid-cols-2 gap-y-3 text-[11px] mb-4">
                  <div className="text-gray-500 font-medium">Plan:</div>
                  <div className="text-gray-800 font-semibold">Annual</div>

                  <div className="text-gray-500 font-medium">Auto-Renewal:</div>
                  <div className="text-green-600 font-semibold flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Enabled
                  </div>

                  <div className="text-gray-500 font-medium">Next Billing:</div>
                  <div className="text-gray-800 font-semibold">01/04/2026</div>

                  <div className="text-gray-500 font-medium">Payment:</div>
                  <div className="text-gray-800 font-semibold flex items-center gap-1">
                    <CreditCard size={12} /> HDFC Bank **** 5678
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap pt-3 border-t border-gray-100">
                  <button className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-[3px] hover:bg-gray-50 transition-colors">
                    View Billing History
                  </button>
                  <button className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-[3px] hover:bg-gray-50 transition-colors">
                    Update Payment Method
                  </button>
                  <button className="h-7 px-3 bg-white border border-gray-300 text-red-600 text-[11px] font-medium rounded-[3px] hover:bg-red-50 transition-colors">
                    Cancel Auto-Renewal
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-5">
              {/* Usage Card */}
              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
                  License Usage
                </div>

                <div className="flex justify-between text-[11px] font-medium mb-1.5 text-gray-600">
                  <span>Licensed Users: 10</span>
                  <span>Active Sessions: 3</span>
                </div>

                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="bg-[#059669] h-full rounded-full transition-all"
                    style={{ width: "30%" }}
                  />
                </div>

                <div className="text-[10px] text-gray-500 font-medium mb-4">
                  3 of 10 licenses in use
                </div>

                {/* Active Sessions Table */}
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                          User
                        </th>
                        <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                          Machine
                        </th>
                        <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                          Since
                        </th>
                        <th className="px-2 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeSessions.map((session, index) => (
                        <tr key={index} className="hover:bg-gray-50/50">
                          <td className="px-2 py-2 text-[11px] font-medium text-gray-800">
                            {session.user}
                          </td>
                          <td className="px-2 py-2 text-[11px] text-gray-600">{session.machine}</td>
                          <td className="px-2 py-2 text-[11px] text-gray-600">{session.since}</td>
                          <td className="px-2 py-2 text-right">
                            <button
                              onClick={() => handleForceLogout(index)}
                              className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[9px] font-bold uppercase hover:bg-red-100 transition-colors"
                            >
                              Force Logout
                            </button>
                          </td>
                        </tr>
                      ))}
                      {activeSessions.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-2 py-4 text-center text-[11px] text-gray-500 italic"
                          >
                            No active sessions
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transfer License Section */}
              <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
                  License Transfer (Move to another machine)
                </div>

                <div className="flex flex-col gap-2 mb-3">
                  <label className="flex items-center gap-2 text-[11px] font-medium text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="transfer"
                      defaultChecked
                      className="text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    Deactivate on this machine
                  </label>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="transfer"
                      className="text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    Add additional activation
                  </label>
                </div>

                <input
                  type="text"
                  placeholder="Reason for transfer..."
                  className="w-full h-7 px-2 text-[11px] border border-gray-300 rounded-[3px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] mb-3"
                />

                <button
                  onClick={handleDeactivate}
                  className="w-full h-8 bg-[#dc2626] hover:bg-red-800 text-white text-[11px] font-medium rounded-md transition-colors shadow-sm"
                >
                  Deactivate This Machine
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "account" && (
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            {/* Account Info */}
            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 mb-4">
                Account Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 mb-5">
                <div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">
                    Account Email
                  </div>
                  <div className="text-[13px] font-semibold text-gray-800">owner@company.com</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">
                    Account ID
                  </div>
                  <div className="text-[13px] font-semibold text-gray-800">ACC-000123456</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">
                    Account Name
                  </div>
                  <div className="text-[13px] font-semibold text-gray-800">
                    {companySettings?.name || "Company"}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap pt-4 border-t border-gray-100">
                <button className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors">
                  Update Profile
                </button>
                <button className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors">
                  Change Password
                </button>
                <button className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors">
                  Manage API Keys
                </button>
              </div>
            </div>

            {/* Linked Companies Table */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                  Linked Companies
                </div>
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100">
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Company
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                      Active Users
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-[12px] font-semibold text-gray-800">
                      Current Company
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-green-50 text-green-700 border border-green-200 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                        Primary
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-600 font-medium text-right">
                      3 users
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-[12px] font-medium text-gray-800">
                      Branch Office
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-green-50 text-green-700 border border-green-200 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-600 font-medium text-right">
                      1 user
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-[12px] font-medium text-gray-800">
                      Demo Company
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                        Inactive
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-600 font-medium text-right">
                      0 users
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "services" && (
          <div className="flex flex-col gap-5">
            {/* Cloud Services Status */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                  Connected Services Status
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                <div className="divide-y divide-gray-100">
                  {[
                    {
                      name: "Cloud Backup",
                      status: "connected",
                      detail: "Last backup: Today 03:00 AM",
                    },
                    { name: "Remote Access", status: "connected", detail: "2 remote sessions" },
                    {
                      name: "e-Way Bill Integration",
                      status: "connected",
                      detail: "NIC API: Connected",
                    },
                    {
                      name: "e-Invoice Integration",
                      status: "connected",
                      detail: "IRP API: Connected (via GSP)",
                    },
                  ].map((service, index) => (
                    <div
                      key={index}
                      className="px-4 py-3 flex justify-between items-center hover:bg-gray-50/50"
                    >
                      <div>
                        <div className="text-[12px] font-medium text-gray-800">{service.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{service.detail}</div>
                      </div>
                      <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle size={10} strokeWidth={3} /> Connected
                      </span>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    {
                      name: "GST Filing Integration",
                      status: "connected",
                      detail: "GSTN API: Connected",
                    },
                    {
                      name: "Bank Reconciliation Feed",
                      status: "disconnected",
                      detail: "Not configured",
                    },
                    {
                      name: "WhatsApp/Email Sharing",
                      status: "disconnected",
                      detail: "Not configured",
                    },
                  ].map((service, index) => (
                    <div
                      key={index}
                      className="px-4 py-3 flex justify-between items-center hover:bg-gray-50/50"
                    >
                      <div>
                        <div className="text-[12px] font-medium text-gray-800">{service.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{service.detail}</div>
                      </div>
                      {service.status === "connected" ? (
                        <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle size={10} strokeWidth={3} /> Connected
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                            <X size={10} strokeWidth={3} /> Inactive
                          </span>
                          <button className="h-6 px-2 bg-white border border-gray-300 hover:bg-gray-50 text-[#1557b0] text-[10px] font-semibold rounded shadow-sm transition-colors">
                            Set Up
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Notifications Band */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 shadow-sm">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide border-b border-amber-200/60 pb-2 mb-3">
                Vendor Notifications
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2 text-[12px] text-amber-900 pb-2 border-b border-amber-200/40">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-semibold">Product Update available:</span> v4.2.1 —
                    <button className="ml-1 text-[#1557b0] hover:underline font-medium">
                      View Release Notes
                    </button>
                    <span className="mx-1.5 text-amber-300">•</span>
                    <button className="text-[#1557b0] hover:underline font-medium">
                      Update Now
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-[12px] text-amber-900">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-semibold">Compliance Alert:</span> GST API update required
                    by 31st May —
                    <button className="ml-1 text-[#1557b0] hover:underline font-medium">
                      Read More
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "remote" && (
          <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm max-w-2xl mx-auto">
            {/* Remote Access Toggle */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div>
                <div className="text-[13px] font-semibold text-gray-800">Enable Remote Access</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Allow users to access this company data remotely over the internet.
                </div>
              </div>
              <div className="flex rounded-md shadow-sm">
                <button
                  onClick={() => setRemoteEnabled(true)}
                  className={`px-4 py-1.5 text-[11px] font-bold border transition-colors rounded-l-md ${
                    remoteEnabled
                      ? "bg-[#059669] text-white border-[#059669] z-10"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => setRemoteEnabled(false)}
                  className={`px-4 py-1.5 text-[11px] font-bold border-y border-r transition-colors rounded-r-md -ml-px ${
                    !remoteEnabled
                      ? "bg-[#dc2626] text-white border-[#dc2626] z-10"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {remoteEnabled && (
              <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Mode Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Connection Mode
                  </label>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex items-start gap-2.5 text-[12px] font-medium text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={remoteMode === "relay"}
                        onChange={() => setRemoteMode("relay")}
                        className="mt-0.5 text-[#1557b0] focus:ring-[#1557b0]"
                      />
                      <div>
                        <div className="text-gray-800">
                          Cloud Relay{" "}
                          <span className="text-[10px] font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded ml-1">
                            Easiest Setup
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-normal mt-0.5">
                          Connects via vendor's secure relay server. No router configuration
                          required.
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2.5 text-[12px] font-medium text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={remoteMode === "tunnel"}
                        onChange={() => setRemoteMode("tunnel")}
                        className="mt-0.5 text-[#1557b0] focus:ring-[#1557b0]"
                      />
                      <div>
                        <div className="text-gray-800">
                          Direct Tunnel (TLS/SSL){" "}
                          <span className="text-[10px] font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-1">
                            Best Performance
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-normal mt-0.5">
                          Direct connection to this machine. Requires port forwarding in your
                          router.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {/* Port */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Port
                    </label>
                    <input
                      type="number"
                      value={odbcPort}
                      onChange={(e) => setOdbcPort(e.target.value)}
                      className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                    />
                  </div>
                  {/* Max Connections */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Max Concurrent Sessions
                    </label>
                    <input
                      type="number"
                      value={maxRemoteConns}
                      onChange={(e) => setMaxRemoteConns(e.target.value)}
                      className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                    />
                  </div>
                </div>

                {/* SSL */}
                {remoteMode === "tunnel" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      SSL Certificate
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="ssl"
                          defaultChecked
                          className="text-[#1557b0] focus:ring-[#1557b0]"
                        />
                        Auto (Let's Encrypt — auto-renews)
                      </label>
                      <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="ssl"
                          className="text-[#1557b0] focus:ring-[#1557b0]"
                        />
                        Custom certificate
                      </label>
                    </div>
                  </div>
                )}

                {/* Whitelist IPs */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Whitelist IPs
                  </label>
                  <textarea
                    value={whitelistIPs}
                    onChange={(e) => setWhitelistIPs(e.target.value)}
                    placeholder="One IP per line. Leave blank to allow all connections."
                    rows={3}
                    className="w-full p-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] font-mono resize-y"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleTestConnection}
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Test Connection
                  </button>
                  <button className="h-8 px-4 bg-white border border-gray-300 text-[#1557b0] text-[11px] font-medium rounded-md hover:bg-blue-50 transition-colors shadow-sm">
                    Generate Mobile QR Code
                  </button>
                  <div className="flex-1"></div>
                  <button
                    onClick={handleSaveRemoteSettings}
                    className="h-8 px-5 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-md transition-colors shadow-sm"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "updates" && (
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            {/* Current Version Banner */}
            <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">
                  Current Version
                </div>
                <div className="text-[14px] font-bold text-gray-800">
                  v4.1.0{" "}
                  <span className="text-[11px] font-medium text-gray-500 ml-1">
                    (Build 2024.04.01)
                  </span>
                </div>
              </div>

              {updateAvailable && (
                <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide">
                      Update Available
                    </span>
                    <span className="text-[12px] font-bold text-blue-800">Version 4.2.1</span>
                  </div>
                  <button
                    onClick={handleInstallNow}
                    className="h-7 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded-[3px] transition-colors shadow-sm whitespace-nowrap"
                  >
                    Install Now
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                  Update Settings
                </div>
              </div>
              <div className="p-5 flex flex-col gap-5">
                {/* Update Channel */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Release Channel
                  </label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={updateChannel === "stable"}
                        onChange={() => setUpdateChannel("stable")}
                        className="text-[#1557b0] focus:ring-[#1557b0]"
                      />
                      Stable (Recommended — Fully tested releases only)
                    </label>
                    <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={updateChannel === "beta"}
                        onChange={() => setUpdateChannel("beta")}
                        className="text-[#1557b0] focus:ring-[#1557b0]"
                      />
                      Beta (Get features early, minor bugs possible)
                    </label>
                    <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={updateChannel === "manual"}
                        onChange={() => setUpdateChannel("manual")}
                        className="text-[#1557b0] focus:ring-[#1557b0]"
                      />
                      Manual Only
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                    {/* Auto-Download */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-gray-800">
                          Auto-Download
                        </span>
                        <div className="flex rounded shadow-sm">
                          <button
                            onClick={() => setAutoDownload(true)}
                            className={`px-3 py-1 text-[10px] font-bold border transition-colors rounded-l ${
                              autoDownload
                                ? "bg-[#059669] text-white border-[#059669] z-10"
                                : "bg-white text-gray-700 border-gray-300"
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setAutoDownload(false)}
                            className={`px-3 py-1 text-[10px] font-bold border-y border-r transition-colors rounded-r -ml-px ${
                              !autoDownload
                                ? "bg-[#dc2626] text-white border-[#dc2626] z-10"
                                : "bg-white text-gray-700 border-gray-300"
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Downloads in background during idle time.
                      </div>
                    </div>

                    {/* Auto-Install */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-gray-800">
                          Auto-Install
                        </span>
                        <div className="flex rounded shadow-sm">
                          <button
                            onClick={() => setAutoInstall(true)}
                            className={`px-3 py-1 text-[10px] font-bold border transition-colors rounded-l ${
                              autoInstall
                                ? "bg-[#059669] text-white border-[#059669] z-10"
                                : "bg-white text-gray-700 border-gray-300"
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setAutoInstall(false)}
                            className={`px-3 py-1 text-[10px] font-bold border-y border-r transition-colors rounded-r -ml-px ${
                              !autoInstall
                                ? "bg-[#dc2626] text-white border-[#dc2626] z-10"
                                : "bg-white text-gray-700 border-gray-300"
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Installs at next startup without prompting.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                    <span className="text-[12px] font-semibold text-gray-800">
                      Scheduled Update Window:
                    </span>
                    <input
                      type="text"
                      defaultValue="02:00 AM to 04:00 AM"
                      className="w-48 h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCheckForUpdates}
                disabled={checkingUpdate}
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-1.5"
              >
                {checkingUpdate && <RefreshCw size={12} className="animate-spin" />}
                Check for Updates Now
              </button>

              <button className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm">
                View Release Notes
              </button>

              <div className="flex-1"></div>

              <button
                onClick={handleRollback}
                className="h-8 px-4 bg-white border border-red-200 text-red-600 text-[11px] font-medium rounded-md hover:bg-red-50 transition-colors shadow-sm"
              >
                Rollback Version
              </button>
            </div>

            {/* Critical Update Warning */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 mt-2">
              <Shield size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-800 leading-snug">
                <span className="font-semibold">Important:</span> Tax rate changes (GST, TDS, PF)
                are pushed as mandatory updates with a strict deadline. If not updated by the
                deadline, statutory voucher creation for the affected category will be blocked.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlCentre;
