import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Input, Select, Modal, ActionToolbar } from "./ui";
import {
  Sliders,
  Save,
  Database,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Mail,
  Printer,
  Upload,
  Download,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { ADToBSString } from "../lib/nepaliDate";

const SystemSettings: React.FC = () => {
  const { companySettings, updateCompanySettings, resetAllData, exportBackup, importBackup } =
    useStore();

  const [innerTab, setInnerTab] = useState<
    "general" | "vouchers" | "invoices" | "email_print" | "backup"
  >("general");

  // Tab "General"
  const [name, setName] = useState(companySettings?.name || "");
  const [address, setAddress] = useState(companySettings?.address || "");
  const [phone, setPhone] = useState(companySettings?.phone || "");
  const [pan, setPan] = useState(companySettings?.panNumber || "");
  const [email, setEmail] = useState(companySettings?.email || "");
  const [currency, setCurrency] = useState(companySettings?.currencySymbol || "Rs.");
  const [enableCostCenter, setEnableCostCenter] = useState(!!companySettings?.enableCostCenter);
  const [enableBillWiseTracking, setEnableBillWiseTracking] = useState(
    !!companySettings?.enableBillWiseTracking || !!companySettings?.enableBillWise,
  );
  const [enableBatchTracking, setEnableBatchTracking] = useState(
    !!companySettings?.enableBatchTracking,
  );
  const [tdsEnabled, setTdsEnabled] = useState(!!companySettings?.tdsEnabled);

  // Tab "Voucher Settings"
  const [prefixPV, setPrefixPV] = useState(
    companySettings?.voucherSeries?.payment?.prefix || "PV-",
  );
  const [prefixRV, setPrefixRV] = useState(
    companySettings?.voucherSeries?.receipt?.prefix || "RV-",
  );
  const [prefixJV, setPrefixJV] = useState(
    companySettings?.voucherSeries?.journal?.prefix || "JV-",
  );
  const [prefixCV, setPrefixCV] = useState(companySettings?.voucherSeries?.contra?.prefix || "CV-");
  const [startingNumber, setStartingNumber] = useState(
    companySettings?.voucherSeries?.journal?.nextNumber ||
      companySettings?.voucherStartingNumber ||
      1,
  );
  const [allowVoucherEdit, setAllowVoucherEdit] = useState(
    companySettings?.allowVoucherEditAfterPosting ?? true,
  );
  const [requireNarration, setRequireNarration] = useState(
    companySettings?.requireVoucherNarration ?? false,
  );
  const [maxAmountWarning, setMaxAmountWarning] = useState(
    companySettings?.voucherWarningThreshold || 1000000,
  );

  // Tab "Invoice Settings"
  const [paymentTerms, setPaymentTerms] = useState(companySettings?.defaultPaymentTerms || 30);
  const [defaultTaxRate, setDefaultTaxRate] = useState(companySettings?.defaultTaxRate || 13);
  const [showHsnSac, setShowHsnSac] = useState(companySettings?.showHsnSac ?? false);
  const [enableMultiCurrency, setEnableMultiCurrency] = useState(
    !!companySettings?.enableMultiCurrency,
  );
  const [invoiceFooter, setInvoiceFooter] = useState(companySettings?.defaultInvoiceFooter || "");

  // Tab "Email/Print Settings"
  const [letterheadBase64, setLetterheadBase64] = useState(companySettings?.letterheadBase64 || "");
  const [invoicePrintFormat, setInvoicePrintFormat] = useState(
    companySettings?.invoicePrintFormat || "tax_invoice",
  );
  const [voucherPrintFormat, setVoucherPrintFormat] = useState(
    companySettings?.voucherPrintFormat || "simple",
  );
  const [showLogoOnPrint, setShowLogoOnPrint] = useState(
    companySettings?.printLogoOnInvoice ?? true,
  );

  // Tab "Backup" states
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<any>(null);
  const [autoBackup, setAutoBackup] = useState("never");
  const [lastBackupDate, setLastBackupDate] = useState("Never");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const rawDate = localStorage.getItem("sutra_last_backup_date");
    if (rawDate) {
      setLastBackupDate(new Date(rawDate).toLocaleString());
    }
  }, []);

  const [resetModal, setResetModal] = useState(false);

  // SMTP / Email Config state
  const [smtpHost, setSmtpHost] = useState(companySettings?.smtpConfig?.host || "smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(companySettings?.smtpConfig?.port || 587);
  const [smtpSecure, setSmtpSecure] = useState(companySettings?.smtpConfig?.secure || false);
  const [smtpAuthUser, setSmtpAuthUser] = useState(companySettings?.smtpConfig?.authUser || "");
  const [smtpAuthPass, setSmtpAuthPass] = useState(companySettings?.smtpConfig?.authPass || "");
  const [smtpFromName, setSmtpFromName] = useState(
    companySettings?.smtpConfig?.fromName || companySettings?.name || "Sutra ERP",
  );
  const [smtpFromEmail, setSmtpFromEmail] = useState(
    companySettings?.smtpConfig?.fromEmail || companySettings?.email || "",
  );
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpTestLoading, setSmtpTestLoading] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"general" | "email">("general");

  const handleLetterheadUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLetterheadBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (innerTab === "general" && (!name.trim() || !pan.trim())) {
      toast.error("Company Name and PAN No. are mandatory to register legal VAT taxonomies.");
      return;
    }

    if (innerTab === "general" && pan.length !== 9) {
      toast.error(
        "Under Nepal Revenue regulations, taxpayer PAN must contain exactly 9 numerical digits.",
      );
      return;
    }

    try {
      await updateCompanySettings({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        panNumber: pan.trim(),
        email: email.trim(),
        currencySymbol: currency,
        enableCostCenter,
        enableBillWiseTracking,
        enableBillWise: enableBillWiseTracking,
        enableBatchTracking,
        tdsEnabled,
        enableMultiCurrency,
        voucherSeries: {
          payment: { prefix: prefixPV.trim(), nextNumber: Number(startingNumber) || 1, padding: 4 },
          receipt: { prefix: prefixRV.trim(), nextNumber: Number(startingNumber) || 1, padding: 4 },
          journal: { prefix: prefixJV.trim(), nextNumber: Number(startingNumber) || 1, padding: 4 },
          contra: { prefix: prefixCV.trim(), nextNumber: Number(startingNumber) || 1, padding: 4 },
        },
        voucherStartingNumber: Number(startingNumber),
        allowVoucherEditAfterPosting: allowVoucherEdit,
        requireVoucherNarration: requireNarration,
        voucherWarningThreshold: Number(maxAmountWarning),
        defaultPaymentTerms: Number(paymentTerms),
        defaultTaxRate: Number(defaultTaxRate),
        showHsnSac,
        defaultInvoiceFooter: invoiceFooter,
        letterheadBase64,
        invoicePrintFormat,
        voucherPrintFormat,
        printLogoOnInvoice: showLogoOnPrint,
        smtpConfig: {
          host: smtpHost.trim(),
          port: Number(smtpPort),
          secure: smtpSecure,
          authUser: smtpAuthUser.trim(),
          authPass: smtpAuthPass,
          fromName: smtpFromName.trim(),
          fromEmail: smtpFromEmail.trim(),
          isConfigured: !!(smtpAuthUser.trim() && smtpAuthPass && smtpHost.trim()),
        },
      });
      toast.success("Settings preserved in local IndexedDB registry.");
    } catch (err) {
      toast.error("Failed to preserve changes.");
    }
  };

  const handleConfirmDBSandboxReset = async () => {
    toast.loading("Flushing database schemas, erasing indexing blocks...");
    try {
      await resetAllData();
      toast.dismiss();
      toast.success("Database reset complete. Workspace is refreshed.");
      setResetModal(false);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast.dismiss();
      toast.error("Database reset failed.");
    }
  };

  const handleTestEmail = async () => {
    if (!smtpAuthUser || !smtpAuthPass || !smtpHost) {
      toast.error("Please fill in all SMTP fields before testing.");
      return;
    }
    setSmtpTestLoading(true);
    setSmtpTestResult(null);
    try {
      const apiKey = (import.meta.env.VITE_SUTRA_API_KEY as string) || "";
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sutra-Api-Key": apiKey,
        },
        body: JSON.stringify({
          to: smtpAuthUser,
          toName: "Admin",
          isTest: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSmtpTestResult({
          ok: true,
          message: `Test email sent to ${smtpAuthUser} successfully!`,
        });
        toast.success("Test email sent! Check your inbox.");
      } else {
        setSmtpTestResult({ ok: false, message: data.error || "Failed to send test email." });
        toast.error(data.error || "SMTP test failed.");
      }
    } catch {
      setSmtpTestResult({ ok: false, message: "Network error — is the server running?" });
      toast.error("Could not reach the email API server.");
    } finally {
      setSmtpTestLoading(false);
    }
  };

  // Backup & Restore handlers
  const handleCreateBackup = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const nepaliDateStr = ADToBSString(today);
      const dataStr = await exportBackup();
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sutra_backup_${nepaliDateStr}.json`;
      a.click();
      window.URL.revokeObjectURL(url);

      const nowStr = new Date().toISOString();
      localStorage.setItem("sutra_last_backup_date", nowStr);
      setLastBackupDate(new Date(nowStr).toLocaleString());
      toast.success("Backup downloaded successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to create backup");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackupFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setBackupPreview({
            companyName: data.companySettings?.name || "Unknown",
            ledgers: data.accounts?.length || 0,
            vouchers: data.vouchers?.length || 0,
            customers: data.parties?.length || 0,
            products: data.items?.length || 0,
            date: data.exportDate || "Unknown",
          });
        } catch (error) {
          toast.error("Invalid backup file format");
          setBackupFile(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleRestore = async () => {
    if (!backupFile) return;
    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        await importBackup(jsonStr);
        toast.success("Restore complete. Reloading workspace...");
        setBackupFile(null);
        setBackupPreview(null);
        setIsConfirmOpen(false);
        setTimeout(() => window.location.reload(), 1500);
      } catch (error: any) {
        toast.error(error?.message || "Error restoring backup");
        setIsRestoring(false);
      }
    };
    reader.readAsText(backupFile);
  };

  return (
    <div className="page-wrapper">
      {/* Page title */}
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <h1 className="page-title text-[15px] font-semibold text-gray-800">System Settings</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Configure system parameters, operations thresholds, and mail configurations
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 mb-4 bg-white px-4">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-colors mr-1 cursor-pointer ${activeTab === "general" ? "border-[#1557b0] text-[#1557b0]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("email")}
          className={`px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-colors mr-1 cursor-pointer ${activeTab === "email" ? "border-[#1557b0] text-[#1557b0]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          📧 Email & OTP Settings
        </button>
      </div>

      {/* GENERAL TAB — wrap all existing SystemSettings content here, shown when activeTab === 'general' */}
      {activeTab === "general" && (
        <div className="page-content-area">
          <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs font-semibold">
            {/* Settings Navigation Tabs */}
            <div className="flex border-b border-gray-200 mb-2">
              {[
                { id: "general", label: "General Settings" },
                { id: "vouchers", label: "Voucher Settings" },
                { id: "invoices", label: "Invoice Settings" },
                { id: "email_print", label: "Print & Media" },
                { id: "data_controls", label: "Data Controls" },
                { id: "backup", label: "Backup & Utility" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInnerTab(tab.id as any)}
                  className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
                    innerTab === tab.id
                      ? "border-[#1557b0] text-[#1557b0] font-bold"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {innerTab !== "backup" ? (
                  <form onSubmit={handleSaveSettings} className="form-wrapper space-y-4">
                    {innerTab === "general" && (
                      <Card
                        title="Legal Identity Taxpayer Profile"
                        subtitle="Configures VAT registries and taxpayer logs."
                      >
                        <div className="flex flex-col gap-4 bg-white form-grid-2">
                          <div className="grid grid-cols-2 gap-4">
                            <Input
                              label="Corporate Name *"
                              value={name}
                              onChange={setName}
                              required
                            />
                            <Input
                              label="PAN / VAT Register No. *"
                              value={pan}
                              onChange={setPan}
                              maxLength={9}
                              required
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-4 border-t pt-4">
                            <Input
                              label="Email Address"
                              value={email}
                              onChange={setEmail}
                              type="email"
                            />
                            <Input label="Office Landline" value={phone} onChange={setPhone} />
                            <Input
                              label="Local Currency Symbol"
                              value={currency}
                              onChange={setCurrency}
                              required
                            />
                          </div>
                          <Input
                            label="HQ Physical Address *"
                            value={address}
                            onChange={setAddress}
                            required
                          />

                          <div className="divide-y divide-gray-150 border-t pt-4">
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-gray-600">
                                  Enable Cost Center tracking
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Cross-reference accounts with cost structures.
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={enableCostCenter}
                                onChange={(e) => setEnableCostCenter(e.target.checked)}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                              />
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-gray-600">
                                  Enable Bill-Wise outstanding tracking
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Track unpaid bills and aging allocations.
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={enableBillWiseTracking}
                                onChange={(e) => setEnableBillWiseTracking(e.target.checked)}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                              />
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-gray-600">
                                  Enable Batch / Expiry dates
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Maintain inventory lot sizes and safety alerts.
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={enableBatchTracking}
                                onChange={(e) => setEnableBatchTracking(e.target.checked)}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                              />
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-gray-600">
                                  Enable Withholding TDS rules
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Automatically deduce tax metrics based on local policies.
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={tdsEnabled}
                                onChange={(e) => setTdsEnabled(e.target.checked)}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}

                    {innerTab === "vouchers" && (
                      <Card
                        title="Sequences and Operational Vouchers Prefixes"
                        subtitle="Maintain custom sequences to avoid gaps."
                      >
                        <div className="flex flex-col gap-4 bg-white form-grid-2">
                          <div className="grid grid-cols-2 gap-4">
                            <Input
                              label="Payment Voucher Prefix *"
                              value={prefixPV}
                              onChange={setPrefixPV}
                              required
                            />
                            <Input
                              label="Receipt Voucher Prefix *"
                              value={prefixRV}
                              onChange={setPrefixRV}
                              required
                            />
                            <Input
                              label="Journal Voucher Prefix *"
                              value={prefixJV}
                              onChange={setPrefixJV}
                              required
                            />
                            <Input
                              label="Contra Voucher Prefix *"
                              value={prefixCV}
                              onChange={setPrefixCV}
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <Input
                              label="Starting Auto-Number *"
                              value={startingNumber}
                              onChange={(val) => setStartingNumber(Number(val) || 0)}
                              type="number"
                              required
                            />
                            <Input
                              label="Voucher warning threshold Amount"
                              value={maxAmountWarning}
                              onChange={(val) => setMaxAmountWarning(Number(val) || 0)}
                              type="number"
                            />
                          </div>
                          <div className="divide-y divide-gray-150 border-t pt-4">
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-gray-600">
                                  Allow voucher modification post-posting
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Users can edit transactions after they are permanently posted.
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={allowVoucherEdit}
                                onChange={(e) => setAllowVoucherEdit(e.target.checked)}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                              />
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-gray-600">
                                  Mandate Voucher Narration field
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Enforce descriptions before transaction saves.
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={requireNarration}
                                onChange={(e) => setRequireNarration(e.target.checked)}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}

                    {innerTab === "invoices" && (
                      <Card
                        title="Billing and Tax Rules Policies"
                        subtitle="Setup custom tax offsets."
                      >
                        <div className="flex flex-col gap-4 bg-white form-grid-2">
                          <div className="grid grid-cols-2 gap-4">
                            <Input
                              label="Default Payment Terms (Days)"
                              value={paymentTerms}
                              onChange={(val) => setPaymentTerms(Number(val) || 0)}
                              type="number"
                            />
                            <Input
                              label="Default Tax Rate (VAT %)"
                              value={defaultTaxRate}
                              onChange={(val) => setDefaultTaxRate(Number(val) || 0)}
                              type="number"
                            />
                          </div>
                          <div className="divide-y divide-gray-150 border-t pt-4">
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-gray-600">
                                  Enable multi-currency exchanges
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Preserve rates history on journals.
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={enableMultiCurrency}
                                onChange={(e) => setEnableMultiCurrency(e.target.checked)}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                              />
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-gray-600">
                                  Show HSN / SAC Codes in invoices
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Add classification headers for goods.
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={showHsnSac}
                                onChange={(e) => setShowHsnSac(e.target.checked)}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                              />
                            </div>
                          </div>
                          <div className="border-t pt-4">
                            <Input
                              label="Default Invoice Footer text / Terms"
                              value={invoiceFooter}
                              onChange={setInvoiceFooter}
                            />
                          </div>
                        </div>
                      </Card>
                    )}

                    {innerTab === "data_controls" && (
                      <Card
                        title="Data Controls & Approval Rules"
                        subtitle="Configure data freezing and voucher approval workflows."
                      >
                        <div className="flex flex-col gap-4 bg-white form-grid-2">
                          <div className="grid grid-cols-2 gap-4">
                            <Input
                              label="Freeze Data Up To Date"
                              type="date"
                              value={companySettings?.freezeUpToDate || ""}
                              onChange={(val) => updateCompanySettings({ freezeUpToDate: val || undefined })}
                            />
                            <div className="flex flex-col justify-end pb-2">
                              <span className="block text-[10px] text-gray-500">
                                Transactions on or before this date cannot be edited by non-admins.
                              </span>
                            </div>
                          </div>
                          
                          <div className="divide-y divide-gray-150 border-t pt-4">
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <span className="block text-[11px] font-medium text-gray-600">
                                  Enable Approval Workflow
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  Vouchers matching rules below require approval before posting.
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={!!companySettings?.enableApprovalWorkflow}
                                onChange={(e) => updateCompanySettings({ enableApprovalWorkflow: e.target.checked })}
                                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}

                    {innerTab === "email_print" && (
                      <Card
                        title="PDF and Printing Templates Settings"
                        subtitle="Configure layout geometries."
                      >
                        <div className="flex flex-col gap-4 bg-white">
                          <div>
                            <span className="block text-[11px] font-medium text-gray-600 mb-1">
                              Corporate Letterhead Branding Upload
                            </span>
                            <div className="flex items-center gap-3">
                              {letterheadBase64 && (
                                <img
                                  src={letterheadBase64}
                                  alt="Letterhead"
                                  className="h-10 border rounded px-1 object-contain"
                                />
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleLetterheadUpload}
                                className="text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <Select
                              label="Invoice Print Template style"
                              value={invoicePrintFormat}
                              onChange={setInvoicePrintFormat}
                              options={[
                                { value: "tax_invoice", label: "Government Tax Invoice Annex" },
                                { value: "simple_bill", label: "Simple Trading Invoice" },
                                { value: "pos_receipt", label: "Thermal 80mm Receipt layout" },
                              ]}
                            />
                            <Select
                              label="Journal/Voucher Print layout"
                              value={voucherPrintFormat}
                              onChange={setVoucherPrintFormat}
                              options={[
                                { value: "simple", label: "Standard layout" },
                                { value: "dense", label: "Detailed double entry ledger" },
                              ]}
                            />
                          </div>

                          <div className="flex items-center justify-between border-t pt-4">
                            <div>
                              <span className="block text-[11px] font-medium text-gray-600">
                                Show company logo on prints
                              </span>
                              <span className="text-[10px] text-gray-400 font-normal">
                                Hides or displays your brand profile on invoices.
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={showLogoOnPrint}
                              onChange={(e) => setShowLogoOnPrint(e.target.checked)}
                              className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                            />
                          </div>
                        </div>
                      </Card>
                    )}

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> Save Settings
                      </button>
                    </div>
                  </form>
                ) : (
                  // Backup tab content integrated directly
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white border rounded-lg p-5 shadow-sm space-y-4">
                        <div className="flex items-center space-x-3">
                          <Download className="w-6 h-6 text-[#1557b0]" />
                          <h2 className="text-sm font-bold text-gray-800">Create System Backup</h2>
                        </div>
                        <p className="text-gray-500 text-[11px] leading-relaxed">
                          Download a complete backup of all transaction ledgers, product masters,
                          vouchers, and settings in JSON format.
                        </p>
                        <div className="border-t pt-4">
                          <div className="mb-4">
                            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                              Auto-Backup Frequency
                            </label>
                            <select
                              value={autoBackup}
                              onChange={(e) => setAutoBackup(e.target.value)}
                              className="h-8 w-full px-2 border rounded text-[12px] bg-white"
                            >
                              <option value="never">Never (Manual only)</option>
                              <option value="daily">Daily Auto-Save</option>
                              <option value="weekly">Weekly Auto-Save</option>
                            </select>
                          </div>

                          <button
                            onClick={handleCreateBackup}
                            className="w-full flex items-center justify-center space-x-2 h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download Backup JSON</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-white border rounded-lg p-5 shadow-sm space-y-4">
                        <div className="flex items-center space-x-3">
                          <Upload className="w-6 h-6 text-[#1557b0]" />
                          <h2 className="text-sm font-bold text-gray-800">Restore System Backup</h2>
                        </div>
                        <p className="text-gray-500 text-[11px] leading-relaxed">
                          Restore system parameters from a legacy JSON file. Warning: This action
                          will replace your current workspace.
                        </p>
                        <div className="border-t pt-4 space-y-4">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                              Upload JSON Backup File
                            </label>
                            <input
                              type="file"
                              accept=".json"
                              onChange={handleFileUpload}
                              className="p-1 border rounded w-full"
                            />
                          </div>

                          {backupPreview && (
                            <div className="bg-gray-50 p-3 rounded border text-[11px] space-y-1">
                              <h3 className="font-bold text-gray-700">Backup Preview:</h3>
                              <p>
                                <span className="font-semibold">Company:</span>{" "}
                                {backupPreview.companyName}
                              </p>
                              <p>
                                <span className="font-semibold">Backup Date:</span>{" "}
                                {backupPreview.date}
                              </p>
                              <p>
                                <span className="font-semibold">Ledgers:</span>{" "}
                                {backupPreview.ledgers}
                              </p>
                              <p>
                                <span className="font-semibold">Vouchers:</span>{" "}
                                {backupPreview.vouchers}
                              </p>
                              <p>
                                <span className="font-semibold">Parties:</span>{" "}
                                {backupPreview.customers}
                              </p>
                              <p>
                                <span className="font-semibold">Items:</span>{" "}
                                {backupPreview.products}
                              </p>
                            </div>
                          )}

                          <button
                            onClick={() => setIsConfirmOpen(true)}
                            disabled={!backupFile || isRestoring}
                            className="w-full flex items-center justify-center space-x-2 h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Upload className="w-4 h-4" />
                            <span>{isRestoring ? "Restoring..." : "Restore Backup"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Diagnostic Panel Column */}
              <div className="flex flex-col gap-6">
                <Card
                  title="Administrative Factory Reset"
                  subtitle="Diagnostics and system schemas controls."
                >
                  <div className="flex flex-col gap-4">
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 flex gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="font-bold text-amber-850">Caution: Erase IndexedDB</span>
                        <p className="text-[10.5px] mt-0.5 leading-normal">
                          This flush will wipe out all local corporate transactions, stock journals,
                          invoices, and audit registers.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      fullWidth
                      size="sm"
                      onClick={() => setResetModal(true)}
                      icon={<Database className="h-4 w-4" />}
                    >
                      Reset Database Schemas
                    </Button>
                  </div>
                </Card>

                <Card title="Compliance Info">
                  <div className="flex items-start gap-2 text-gray-650">
                    <ShieldCheck className="h-5 w-5 text-green-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-gray-800 block">
                        Double-Entry Accounting Audit
                      </span>
                      <span className="text-[10.5px] mt-0.5 block font-normal leading-normal">
                        All transaction configurations automatically inherit safety assertions
                        checking ledger levels and balancing equations.
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Confirmation Reset Modal */}
            {resetModal && (
              <Modal
                isOpen={resetModal}
                onClose={() => setResetModal(false)}
                title="Confirm DB Sandbox Reset"
                size="sm"
                footer={
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setResetModal(false)}>
                      Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleConfirmDBSandboxReset}>
                      Erase Everything
                    </Button>
                  </div>
                }
              >
                <div className="text-gray-700 leading-normal text-xs font-semibold">
                  This operation will erase all ledger registers and transaction history.
                  <div className="mt-3 bg-red-50 p-2 text-red-800 rounded border border-red-200">
                    This sandbox runs in-browser client-side IndexedDB memory spaces.
                  </div>
                </div>
              </Modal>
            )}

            {/* Restore Confirmation Dialog */}
            {isConfirmOpen && (
              <Modal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                title="Confirm System Restore"
                size="sm"
                footer={
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsConfirmOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleRestore}>
                      Proceed Restore
                    </Button>
                  </div>
                }
              >
                <div className="text-gray-700 text-xs">
                  Are you sure you want to restore the database from this backup? All current
                  transaction logs and settings will be permanently overwritten.
                </div>
              </Modal>
            )}
          </div>
        </div>
      )}

      {/* EMAIL TAB — shown when activeTab === 'email' */}
      {activeTab === "email" && (
        <div className="page-content-area font-semibold">
          <div className="form-wrapper max-w-2xl bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
            <div className="form-header mb-6">
              <h2 className="text-[14px] font-bold text-gray-900">SMTP Email Configuration</h2>
              <p className="text-[11px] text-gray-500 mt-1 font-normal">
                Configure your outgoing email server so Sutra ERP can send OTP codes for password
                recovery.
              </p>
            </div>

            {/* Gmail quick-setup banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-[12px] font-semibold text-blue-800 mb-1">
                📌 Using Gmail? Quick Setup Guide:
              </p>
              <ol className="text-[11px] text-blue-700 space-y-1 list-decimal list-inside font-medium">
                <li>Go to myaccount.google.com → Security → Enable 2-Step Verification first</li>
                <li>Then go to myaccount.google.com → Security → App Passwords</li>
                <li>Select "Mail" + "Windows Computer" → Click Generate</li>
                <li>Copy the 16-character password shown → paste it below in "SMTP Password"</li>
                <li>Use smtp.gmail.com, Port 587, TLS OFF for Gmail App Passwords</li>
              </ol>
            </div>

            <div className="form-section mb-6">
              <div className="form-section-title text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Server Details
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    SMTP Host *
                  </label>
                  <input
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5 font-normal">
                    Gmail: smtp.gmail.com | Outlook: smtp-mail.outlook.com
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Port *
                  </label>
                  <input
                    type="number"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5 font-normal">
                    587 = TLS (recommended) | 465 = SSL | 25 = Plain
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-[#1557b0]"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                  />
                  <span className="text-[12px] text-gray-700 font-medium">
                    Use SSL (port 465 only — leave OFF for Gmail App Passwords)
                  </span>
                </label>
              </div>
            </div>

            <div className="form-section mb-6 border-t pt-4">
              <div className="form-section-title text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Authentication
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    SMTP Username / Email *
                  </label>
                  <input
                    type="email"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    value={smtpAuthUser}
                    onChange={(e) => setSmtpAuthUser(e.target.value)}
                    placeholder="yourcompany@gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    SMTP Password / App Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? "text" : "password"}
                      className="h-8 px-2.5 pr-9 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full font-mono"
                      value={smtpAuthPass}
                      onChange={(e) => setSmtpAuthPass(e.target.value)}
                      placeholder="Gmail: 16-char app password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section mb-6 border-t pt-4">
              <div className="form-section-title text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Sender Identity
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    From Name
                  </label>
                  <input
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="Sutra ERP"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    From Email
                  </label>
                  <input
                    type="email"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    placeholder="noreply@yourcompany.com"
                  />
                </div>
              </div>
            </div>

            {/* Test result display */}
            {smtpTestResult && (
              <div
                className={`rounded-lg px-4 py-3 text-[12px] font-medium mb-6 ${smtpTestResult.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-700"}`}
              >
                {smtpTestResult.ok ? "✅ " : "❌ "}
                {smtpTestResult.message}
              </div>
            )}

            {/* Action buttons */}
            <div className="form-footer flex gap-3 border-t pt-4">
              <button
                onClick={handleSaveSettings}
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save SMTP Settings
              </button>
              <button
                onClick={handleTestEmail}
                disabled={smtpTestLoading}
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {smtpTestLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                {smtpTestLoading ? "Sending..." : "Send Test Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;
