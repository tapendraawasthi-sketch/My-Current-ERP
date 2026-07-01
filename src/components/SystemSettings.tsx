/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Input, Select, Modal, ActionToolbar } from "./ui";
import { Sliders, HelpCircle, Save, Database, AlertTriangle, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

const SystemSettings: React.FC = () => {
  const { companySettings, updateCompanySettings, resetAllData } = useStore();

  const [name, setName] = useState(companySettings?.name || "Sutra Textiles Pvt. Ltd.");
  const [address, setAddress] = useState(companySettings?.address || "Tripureshwor-11, Kathmandu");
  const [phone, setPhone] = useState(companySettings?.phone || "01-4235968, 9851012345");
  const [pan, setPan] = useState(companySettings?.panNumber || "602495831");
  const [email, setEmail] = useState(companySettings?.email || "finance@sutratextiles.com.np");
  const [fiscalYear, setFiscalYear] = useState("2083/2084");
  const [currency, setCurrency] = useState(companySettings?.currencySymbol || "Rs.");
  const [salesPrefix, setSalesPrefix] = useState(companySettings?.invoicePrefix || "SI-");
  const [vatRate, setVatRate] = useState(13);

  const [enableCostCenter, setEnableCostCenter] = useState(!!companySettings?.enableCostCenter);
  const [enableBillWiseTracking, setEnableBillWiseTracking] = useState(
    !!companySettings?.enableBillWiseTracking || !!companySettings?.enableBillWise,
  );
  const [enableBatchTracking, setEnableBatchTracking] = useState(
    !!companySettings?.enableBatchTracking,
  );
  const [tdsEnabled, setTdsEnabled] = useState(!!companySettings?.tdsEnabled);
  const [enableMultiCurrency, setEnableMultiCurrency] = useState(
    !!companySettings?.enableMultiCurrency,
  );

  const [resetModal, setResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !pan.trim()) {
      toast.error("Company Name and PAN No. are mandatory to register legal VAT taxonomies.");
      return;
    }

    if (pan.length !== 9) {
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
        invoicePrefix: salesPrefix,
        enableCostCenter,
        enableBillWiseTracking,
        enableBillWise: enableBillWiseTracking, // keep for compatibility
        enableBatchTracking,
        tdsEnabled,
        enableMultiCurrency,
      });
      toast.success("Company parameters updated in local IndexedDB registry.");
    } catch (e) {
      toast.error("Failed to preserve changes.");
    }
  };

  const handleConfirmDBSandboxReset = async () => {
    if (resetConfirmText !== "DELETE ALL DATA") return;
    toast.loading("Flushing schemas, erasing indexing blocks, re-seeding Nepal COAs...");
    try {
      await resetAllData();
      toast.dismiss();
      toast.success("IndexedDB reset. Workspace is refreshed.");
      setResetModal(false);
      setResetConfirmText("");
      // Wait for a second and reload to let store load fresh seed
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast.dismiss();
      toast.error("Database reset failed.");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none">
      <ActionToolbar title="System Settings" subtitle="Application configuration and preferences" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Config Forms (Col span 2) */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSaveSettings}>
            <div className="flex flex-col gap-6">
              <Card
                title="Legal Identity Taxpayer Profile Settings"
                subtitle="This information is used to structure legal invoice footers and tax annex books."
              >
                <div className="flex flex-col gap-4 text-xs font-semibold text-[#1f2937] leading-relaxed bg-white">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Trading Corporate Name"
                      value={name}
                      onChange={setName}
                      required
                    />
                    <Input
                      label="Legal PAN (9-Digit VAT Register)"
                      value={pan}
                      onChange={setPan}
                      maxLength={9}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-t border-[#d1d5db] pt-4">
                    <Input label="Corporate Email" value={email} onChange={setEmail} type="email" />
                    <Input label="Office landline / contacts" value={phone} onChange={setPhone} />
                    <Input
                      label="Current Fiscal Year (BS)"
                      value={fiscalYear}
                      onChange={setFiscalYear}
                      required
                    />
                  </div>

                  <Input
                    label="Registered Billing HQ Address"
                    value={address}
                    onChange={setAddress}
                    required
                  />

                  <div className="grid grid-cols-3 gap-4 border-t border-[#d1d5db] pt-4">
                    <Input
                      label="Trading Prefix Code"
                      value={salesPrefix}
                      onChange={setSalesPrefix}
                      required
                    />
                    <Input
                      label="Local Currency Symbol"
                      value={currency}
                      onChange={setCurrency}
                      required
                    />
                    <Input
                      label="Standard VAT % Rate (Nepal)"
                      value={vatRate}
                      onChange={() => {}}
                      disabled
                    />
                  </div>
                </div>
              </Card>

              <Card
                title="Feature Activation & Module Controls"
                subtitle="Enable or disable advanced ledger modules and tracking engines."
              >
                <div className="flex flex-col gap-4 text-xs font-semibold text-[#1f2937] leading-relaxed bg-white">
                  <div className="divide-y divide-gray-150">
                    {/* Cost Center Toggle */}
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col">
                        <span className="block text-[11px] font-medium text-[#1f2937] mb-0.5 font-semibold">
                          Enable Cost Center Module
                        </span>
                        <span className="text-[11px] text-[#1f2937] font-normal">
                          Track expenses and revenues across departments, projects, or branches.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnableCostCenter(!enableCostCenter)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                          ${enableCostCenter ? "bg-[#1557b0]" : "bg-[#f9fafb]"}
                        `}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${enableCostCenter ? "translate-x-5" : "translate-x-0"}
                          `}
                        />
                      </button>
                    </div>

                    {/* Bill-wise Tracking Toggle */}
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col">
                        <span className="block text-[11px] font-medium text-[#1f2937] mb-0.5 font-semibold">
                          Enable Bill-Wise Outstanding Tracking
                        </span>
                        <span className="text-[11px] text-[#1f2937] font-normal">
                          Allocate payments to specific sales and purchase invoices for accurate
                          aging.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnableBillWiseTracking(!enableBillWiseTracking)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                          ${enableBillWiseTracking ? "bg-[#1557b0]" : "bg-[#f9fafb]"}
                        `}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${enableBillWiseTracking ? "translate-x-5" : "translate-x-0"}
                          `}
                        />
                      </button>
                    </div>

                    {/* Batch Tracking Toggle */}
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col">
                        <span className="block text-[11px] font-medium text-[#1f2937] mb-0.5 font-semibold">
                          Enable Batch & Expiry Tracking
                        </span>
                        <span className="text-[11px] text-[#1f2937] font-normal">
                          Maintain inventory lot/batch numbers and manufacturing/expiry dates.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnableBatchTracking(!enableBatchTracking)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                          ${enableBatchTracking ? "bg-[#1557b0]" : "bg-[#f9fafb]"}
                        `}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${enableBatchTracking ? "translate-x-5" : "translate-x-0"}
                          `}
                        />
                      </button>
                    </div>

                    {/* TDS Enable Toggle */}
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col">
                        <span className="block text-[11px] font-medium text-[#1f2937] mb-0.5 font-semibold">
                          Enable Government TDS Withholding
                        </span>
                        <span className="text-[11px] text-[#1f2937] font-normal">
                          Activate automatic TDS deductions on payment vouchers.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTdsEnabled(!tdsEnabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                          ${tdsEnabled ? "bg-[#1557b0]" : "bg-[#f9fafb]"}
                        `}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${tdsEnabled ? "translate-x-5" : "translate-x-0"}
                          `}
                        />
                      </button>
                    </div>

                    {/* Multi-Currency Toggle */}
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col">
                        <span className="block text-[11px] font-medium text-[#1f2937] mb-0.5 font-semibold">
                          Enable Multi-Currency Support
                        </span>
                        <span className="text-[11px] text-[#1f2937] font-normal">
                          Transact in foreign currencies with automatic exchange rate conversion.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnableMultiCurrency(!enableMultiCurrency)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                          ${enableMultiCurrency ? "bg-[#1557b0]" : "bg-[#f9fafb]"}
                        `}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${enableMultiCurrency ? "translate-x-5" : "translate-x-0"}
                          `}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={<Save className="h-4 w-4" />}
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Developer sandbox reset diagnostics tool (Col span 1) */}
        <div className="flex flex-col gap-6">
          <Card
            title="Administrative Sandbox Controls"
            subtitle="Diagnostics and system database flush engines"
          >
            <div className="flex flex-col gap-4 text-xs select-none">
              <div className="bg-amber-50/50 border border-amber-250 text-amber-900 rounded-xl p-3.5 flex gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex flex-col font-semibold">
                  <span className="font-bold text-amber-800 leading-none">
                    Caution: Database Reset
                  </span>
                  <p className="text-[10.5px] text-amber-700 leading-normal mt-1">
                    Running a database factory reset will purge all transactional invoices, stock
                    records, custom ledgers and restore initial seeding settings.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="danger"
                  fullWidth
                  size="sm"
                  onClick={() => setResetModal(true)}
                  icon={<Database className="h-4 w-4" />}
                >
                  Factory Reset Database
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Workspace Security Compliance">
            <div className="flex items-start gap-2.5 text-xs select-none">
              <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="flex flex-col font-medium leading-relaxed">
                <span className="font-bold text-[#1f2937]">ISO-9001 Compliant Books</span>
                <span className="text-[10.5px] text-[#1f2937] mt-0.5">
                  Double-entry books and stock cost logs adhere to standard audit laws in Kathmandu,
                  Nepal.
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* CONFIRMATION OVERLAY MODAL */}
      {resetModal && (
        <Modal
          isOpen={resetModal}
          onClose={() => setResetModal(false)}
          title="Confirm Database Reset"
          size="sm"
          footer={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setResetModal(false);
                setResetConfirmText("");
              }}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={resetConfirmText !== "DELETE ALL DATA"}
                onClick={handleConfirmDBSandboxReset}
              >
                Erase Everything
              </Button>
            </div>
          }
        >
          <div className="text-xs font-semibold select-none text-[#1f2937] leading-relaxed space-y-3">
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3">
              ⚠️ This will permanently delete ALL business data including invoices, vouchers, accounts, 
              parties, and stock records. This action CANNOT be undone.
            </div>
            <p>Type <strong className="font-mono text-red-600">DELETE ALL DATA</strong> to confirm:</p>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="Type DELETE ALL DATA"
              className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SystemSettings;
