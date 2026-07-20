import React from "react";
import { Trash2, Copy, Save } from "lucide-react";
import toast from "@/lib/appToast";
import type { AccountGroup, Ledger, FeatureConfig, MasterConfig } from "./types";
import {
  CATEGORY_ORDER,
  ACCOUNT_TYPES,
  PARTY_REG_TYPES,
  BANK_ACCOUNT_TYPES,
  INDIA_STATES,
  inputCls,
  labelCls,
  sectionHdr,
} from "./constants";

export type LedgerTabId = "general" | "address" | "gst" | "bank" | "config" | "optional";

export interface CoaLedgerFormProps {
  mode: "add" | "edit";
  lForm: Partial<Ledger>;
  lErrors: Record<string, string>;
  ledgerTab: LedgerTabId;
  editingLedgerId: string | null;
  allGroups: AccountGroup[];
  allLedgers: Ledger[];
  features: FeatureConfig;
  masterConfig: MasterConfig;
  onChange: React.Dispatch<React.SetStateAction<Partial<Ledger>>>;
  onTabChange: (tab: LedgerTabId) => void;
  onSave: (andNew?: boolean) => void;
  onCancel: () => void;
  onDelete: (ledger: Ledger) => void;
  onCopy: (ledger: Ledger) => void;
}

export const CoaLedgerForm: React.FC<CoaLedgerFormProps> = ({
  mode,
  lForm,
  lErrors,
  ledgerTab,
  editingLedgerId,
  allGroups,
  allLedgers,
  features,
  masterConfig,
  onChange,
  onTabChange,
  onSave,
  onCancel,
  onDelete,
  onCopy,
}) => {
  const ledgerTabs = [
    { id: "general", label: "General" },
    { id: "address", label: "Address" },
    { id: "gst", label: "GST & Tax" },
    ...(lForm.accountType === "Bank" ? [{ id: "bank", label: "Bank" }] : []),
    { id: "config", label: "Configuration" },
    ...(masterConfig.optionalFields.length > 0
      ? [{ id: "optional", label: "Optional Fields" }]
      : []),
  ];

  const isEdit = mode === "edit";
  const editLedger =
    isEdit && editingLedgerId ? allLedgers.find((l) => l.id === editingLedgerId) : null;
  const selectedGroup = lForm.groupId ? allGroups.find((g) => g.id === lForm.groupId) : null;
  const isBankGroup = selectedGroup?.name.toLowerCase().includes("bank");
  const isDebtorCreditor =
    selectedGroup?.id === "sg-sundry-debtors" ||
    selectedGroup?.id === "sg-sundry-creditors" ||
    selectedGroup?.name.toLowerCase().includes("debtor") ||
    selectedGroup?.name.toLowerCase().includes("creditor");

  return (
      <div className="p-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-bold text-gray-800">
            {isEdit ? `Modify Ledger â€” ${editLedger?.name}` : "Add Ledger Account"}
          </h2>
          <div className="text-[12px] text-gray-500">F2=Save Â· Esc=Cancel</div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4 gap-0">
          {ledgerTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as LedgerTabId)}
              className={`px-3 py-1.5 text-[12px] font-medium border-b-2 transition-colors -mb-px ${ledgerTab === tab.id ? "border-[var(--ds-action-primary)] text-[var(--ds-action-primary)]" : "border-transparent text-gray-600 hover:text-gray-800"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* â”€â”€ GENERAL TAB â”€â”€ */}
        {ledgerTab === "general" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={lForm.name || ""}
                  onChange={(e) => onChange((p) => ({ ...p, name: e.target.value }))}
                  className={`${inputCls} ${lErrors.name ? "border-red-400" : ""}`}
                  placeholder="e.g. HDFC Bank Current A/c 0234"
                  autoFocus
                />
                {lErrors.name && <p className="text-[12px] text-red-600 mt-0.5">{lErrors.name}</p>}
              </div>
              <div>
                <label className={labelCls}>Alias (optional)</label>
                <input
                  value={lForm.alias || ""}
                  onChange={(e) => onChange((p) => ({ ...p, alias: e.target.value }))}
                  className={inputCls}
                  placeholder="Short name for quick search"
                />
              </div>
              <div>
                <label className={labelCls}>Print Name (optional)</label>
                <input
                  value={lForm.printName || ""}
                  onChange={(e) => onChange((p) => ({ ...p, printName: e.target.value }))}
                  className={inputCls}
                  placeholder="Name on invoices/statements"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Account Group <span className="text-red-500">*</span>
              </label>
              <select
                value={lForm.groupId || ""}
                onChange={(e) => onChange((p) => ({ ...p, groupId: e.target.value }))}
                className={`${inputCls} ${lErrors.groupId ? "border-red-400" : ""}`}
              >
                <option value="">â€” Select Account Group â€”</option>
                {CATEGORY_ORDER.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {allGroups
                      .filter((g) => g.category === cat)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.isPrimary ? g.name : `  ${g.name}`}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {lErrors.groupId && (
                <p className="text-[12px] text-red-600 mt-0.5">{lErrors.groupId}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Account Type</label>
              <div className="flex gap-1.5 flex-wrap">
                {ACCOUNT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange((p) => ({ ...p, accountType: t }))}
                    className={`h-7 px-3 text-[12px] font-semibold rounded border transition-colors ${lForm.accountType === t ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)]" : "bg-white text-gray-700 border-[var(--ds-border-default)] hover:bg-gray-50"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-gray-500 mt-1">
                Party = Customers/Suppliers Â· Bank = Bank Accounts Â· Cash = Cash Accounts Â· General
                Ledger = Others
              </p>
            </div>

            {/* Sub Ledger */}
            {features.subLedgers && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <label className={labelCls}>Ledger Type</label>
                <div className="flex gap-2 mb-2">
                  {["General Ledger", "Sub Ledger"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onChange((p) => ({ ...p, ledgerType: t as any }))}
                      className={`flex-1 h-7 text-[12px] font-semibold rounded border ${lForm.ledgerType === t ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)]" : "bg-white text-gray-700 border-[var(--ds-border-default)]"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {lForm.ledgerType === "Sub Ledger" && (
                  <div>
                    <label className={labelCls}>
                      Parent Account <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={lForm.parentLedgerId || ""}
                      onChange={(e) => onChange((p) => ({ ...p, parentLedgerId: e.target.value }))}
                      className={`${inputCls} ${lErrors.parentLedgerId ? "border-red-400" : ""}`}
                    >
                      <option value="">â€” Select Parent Ledger â€”</option>
                      {allLedgers
                        .filter((l) => l.ledgerType !== "Sub Ledger" && l.id !== editingLedgerId)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                    </select>
                    {lErrors.parentLedgerId && (
                      <p className="text-[12px] text-red-600 mt-0.5">{lErrors.parentLedgerId}</p>
                    )}
                    <p className="text-[12px] text-gray-500 mt-1">
                      Sub-ledger balance rolls up to the parent in all reports.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Opening Balance */}
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className={sectionHdr + " -mx-3 mb-2"}>Opening Balance</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Amount</label>
                  <input
                    type="number"
                    value={lForm.openingBalance || ""}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, openingBalance: Number(e.target.value) || 0 }))
                    }
                    className={inputCls}
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                  />
                </div>
                <div>
                  <label className={labelCls}>Dr / Cr</label>
                  <div className="flex h-8 border border-[var(--ds-border-default)] rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onChange((p) => ({ ...p, openingBalanceType: "Dr" }))}
                      className={`flex-1 text-[12px] font-bold transition-colors ${lForm.openingBalanceType === "Dr" ? "bg-[var(--ds-action-primary)] text-white" : "bg-white text-gray-700"}`}
                    >
                      Dr
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange((p) => ({ ...p, openingBalanceType: "Cr" }))}
                      className={`flex-1 text-[12px] font-bold transition-colors ${lForm.openingBalanceType === "Cr" ? "bg-[var(--ds-action-primary)] text-white" : "bg-white text-gray-700"}`}
                    >
                      Cr
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Credit terms for debtors/creditors */}
            {(isDebtorCreditor || lForm.accountType === "Party") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Credit Limit (Rs.)</label>
                  <input
                    type="number"
                    value={lForm.creditLimit || ""}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, creditLimit: Number(e.target.value) || 0 }))
                    }
                    className={inputCls}
                    placeholder="0 = unlimited"
                  />
                </div>
                <div>
                  <label className={labelCls}>Credit Period (Days)</label>
                  <input
                    type="number"
                    value={lForm.creditPeriod || ""}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, creditPeriod: Number(e.target.value) || 0 }))
                    }
                    className={inputCls}
                    placeholder="e.g. 30"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ ADDRESS TAB â”€â”€ */}
        {ledgerTab === "address" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>Address</label>
              <textarea
                value={lForm.address || ""}
                onChange={(e) => onChange((p) => ({ ...p, address: e.target.value }))}
                rows={2}
                className="w-full px-2.5 py-1.5 text-[12px] border border-[var(--ds-border-default)] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)] resize-none"
                placeholder="Street address, Area"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>State</label>
                <select
                  value={lForm.state || ""}
                  onChange={(e) => onChange((p) => ({ ...p, state: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">â€” Select State â€”</option>
                  {INDIA_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>PIN Code</label>
                <input
                  value={lForm.pinCode || ""}
                  onChange={(e) => onChange((p) => ({ ...p, pinCode: e.target.value }))}
                  className={inputCls}
                  placeholder="6-digit PIN"
                  maxLength={6}
                />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input
                  value={lForm.country || "India"}
                  onChange={(e) => onChange((p) => ({ ...p, country: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  value={lForm.phone || ""}
                  onChange={(e) => onChange((p) => ({ ...p, phone: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Mobile</label>
                <input
                  value={lForm.mobile || ""}
                  onChange={(e) => onChange((p) => ({ ...p, mobile: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={lForm.email || ""}
                  onChange={(e) => onChange((p) => ({ ...p, email: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input
                  value={lForm.website || ""}
                  onChange={(e) => onChange((p) => ({ ...p, website: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ GST TAB â”€â”€ */}
        {ledgerTab === "gst" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>GSTIN / UIN (15 chars)</label>
                <div className="flex gap-1">
                  <input
                    value={lForm.gstin || ""}
                    onChange={(e) =>
                      onChange((p) => ({ ...p, gstin: e.target.value.toUpperCase().slice(0, 15) }))
                    }
                    className={`${inputCls} flex-1`}
                    placeholder="27AABCT1234Q1Z5"
                    maxLength={15}
                  />
                  <button
                    type="button"
                    className="h-8 px-2 bg-[var(--ds-action-primary)] text-white text-[12px] rounded hover:bg-[var(--ds-action-primary-hover)]"
                    onClick={() =>
                      toast.success("GSTIN validation requires GST portal integration.")
                    }
                  >
                    Validate
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>PAN (10 chars)</label>
                <input
                  value={lForm.pan || ""}
                  onChange={(e) =>
                    onChange((p) => ({ ...p, pan: e.target.value.toUpperCase().slice(0, 10) }))
                  }
                  className={inputCls}
                  placeholder="AABCT1234Q"
                  maxLength={10}
                />
              </div>
              <div>
                <label className={labelCls}>Registration Type</label>
                <select
                  value={lForm.registrationType || ""}
                  onChange={(e) => onChange((p) => ({ ...p, registrationType: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">â€” Select â€”</option>
                  {PARTY_REG_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tax Category</label>
                <input
                  value={lForm.taxCategory || ""}
                  onChange={(e) => onChange((p) => ({ ...p, taxCategory: e.target.value }))}
                  className={inputCls}
                  placeholder="Default tax category"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
              {[
                { key: "gstApplicable", label: "GST Applicable" },
                { key: "reverseCharge", label: "Reverse Charge Applicable" },
                { key: "tdsApplicable", label: "TDS Applicable" },
                { key: "tcsApplicable", label: "TCS Applicable" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(lForm as any)[key] || false}
                    onChange={(e) => onChange((p) => ({ ...p, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded accent-[var(--ds-action-primary)]"
                  />
                  <span className="text-[12px] text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* â”€â”€ BANK TAB â”€â”€ */}
        {ledgerTab === "bank" && lForm.accountType === "Bank" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bank Name</label>
                <input
                  value={lForm.bankName || ""}
                  onChange={(e) => onChange((p) => ({ ...p, bankName: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. HDFC Bank"
                />
              </div>
              <div>
                <label className={labelCls}>Branch</label>
                <input
                  value={lForm.bankBranch || ""}
                  onChange={(e) => onChange((p) => ({ ...p, bankBranch: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Andheri West"
                />
              </div>
              <div>
                <label className={labelCls}>Account Number</label>
                <input
                  value={lForm.bankAccountNo || ""}
                  onChange={(e) => onChange((p) => ({ ...p, bankAccountNo: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>IFSC Code</label>
                <input
                  value={lForm.ifscCode || ""}
                  onChange={(e) =>
                    onChange((p) => ({ ...p, ifscCode: e.target.value.toUpperCase() }))
                  }
                  className={inputCls}
                  maxLength={11}
                  placeholder="HDFC0001234"
                />
              </div>
              <div>
                <label className={labelCls}>Account Type</label>
                <select
                  value={lForm.bankAccountType || ""}
                  onChange={(e) => onChange((p) => ({ ...p, bankAccountType: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">â€” Select â€”</option>
                  {BANK_ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>OD/CC Limit (Rs.)</label>
                <input
                  type="number"
                  value={lForm.odCcLimit || ""}
                  onChange={(e) =>
                    onChange((p) => ({ ...p, odCcLimit: Number(e.target.value) || 0 }))
                  }
                  className={inputCls}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ CONFIGURATION TAB â”€â”€ */}
        {ledgerTab === "config" && (
          <div className="flex flex-col gap-2">
            {[
              {
                key: "billByBill",
                label: "Maintain Bill-by-Bill Balancing",
                desc: "Track outstanding invoices individually. Enables AR/AP aging reports.",
                show: features.billByBill,
              },
              {
                key: "maintainCostCenter",
                label: "Maintain Cost Center",
                desc: "Require cost center allocation for transactions in this account.",
                show: features.costCenter,
              },
              {
                key: "maintainBranch",
                label: "Maintain Branch-wise Details",
                desc: "Track transactions by branch/division.",
                show: features.branchDivision,
              },
              {
                key: "multiCurrency",
                label: "Multi-Currency",
                desc: "Enable foreign currency transactions for this party.",
                show: features.multiCurrency,
              },
              {
                key: "isActive",
                label: "Active",
                desc: "Inactive ledgers are hidden from voucher entry dropdowns.",
                show: true,
              },
            ]
              .filter((f) => f.show)
              .map(({ key, label, desc }) => (
                <div
                  key={key}
                  className={`p-3 rounded border ${(lForm as any)[key] ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(lForm as any)[key] || false}
                      onChange={(e) => onChange((p) => ({ ...p, [key]: e.target.checked }))}
                      className="h-4 w-4 mt-0.5 rounded accent-[var(--ds-action-primary)] shrink-0"
                    />
                    <div>
                      <span className="text-[12px] font-semibold text-gray-800 block">{label}</span>
                      <span className="text-[12px] text-gray-500">{desc}</span>
                    </div>
                  </label>
                </div>
              ))}
          </div>
        )}

        {/* â”€â”€ OPTIONAL FIELDS TAB â”€â”€ */}
        {ledgerTab === "optional" && masterConfig.optionalFields.length > 0 && (
          <div className="flex flex-col gap-3">
            {masterConfig.optionalFields.map((field) => (
              <div key={field.id}>
                <label className={labelCls}>
                  {field.name}
                  {field.mandatory && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.dataType === "text" && (
                  <input
                    value={((lForm.optionalFields || {})[field.id] || field.defaultValue || "") as string}
                    onChange={(e) =>
                      onChange((p) => ({
                        ...p,
                        optionalFields: { ...(p.optionalFields || {}), [field.id]: e.target.value },
                      }))
                    }
                    className={inputCls}
                  />
                )}
                {field.dataType === "numeric" && (
                  <input
                    type="number"
                    step={field.decimalPlaces ? `0.${"0".repeat(field.decimalPlaces - 1)}1` : "1"}
                    value={((lForm.optionalFields || {})[field.id] || field.defaultValue || "") as string}
                    onChange={(e) =>
                      onChange((p) => ({
                        ...p,
                        optionalFields: { ...(p.optionalFields || {}), [field.id]: e.target.value },
                      }))
                    }
                    className={inputCls}
                  />
                )}
                {field.dataType === "date" && (
                  <input
                    type="date"
                    value={((lForm.optionalFields || {})[field.id] || "") as string}
                    onChange={(e) =>
                      onChange((p) => ({
                        ...p,
                        optionalFields: { ...(p.optionalFields || {}), [field.id]: e.target.value },
                      }))
                    }
                    className={inputCls}
                  />
                )}
                {field.dataType === "list" && (
                  <select
                    value={((lForm.optionalFields || {})[field.id] || "") as string}
                    onChange={(e) =>
                      onChange((p) => ({
                        ...p,
                        optionalFields: { ...(p.optionalFields || {}), [field.id]: e.target.value },
                      }))
                    }
                    className={inputCls}
                  >
                    <option value="">â€” Select â€”</option>
                    {(field.listValues || "")
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean)
                      .map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                  </select>
                )}
                {field.dataType === "yesno" && (
                  <div className="flex gap-2">
                    {["Yes", "No"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          onChange((p) => ({
                            ...p,
                            optionalFields: { ...(p.optionalFields || {}), [field.id]: v },
                          }))
                        }
                        className={`flex-1 h-8 text-[12px] font-semibold rounded border ${(lForm.optionalFields || {})[field.id] === v ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)]" : "bg-white text-gray-700 border-[var(--ds-border-default)]"}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
          <div className="flex gap-2">
            {isEdit && (
              <button
                onClick={() => editLedger && onDelete(editLedger)}
                className="h-8 px-3 bg-red-600 text-white text-[12px] font-medium rounded hover:bg-red-700 flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete (F8)
              </button>
            )}
            {editLedger && (
              <button
                onClick={() => onCopy(editLedger)}
                className="h-8 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copy (F12)
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onCancel()}
              className="h-8 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-50"
            >
              Cancel (Esc)
            </button>
            <button
              onClick={() => onSave(true)}
              className="h-8 px-3 bg-gray-100 border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-200"
            >
              Save & New
            </button>
            <button
              onClick={() => onSave(false)}
              className="h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] font-medium rounded hover:bg-[var(--ds-action-primary-hover)] flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save (F2)
            </button>
          </div>
        </div>
      </div>
    );

};
