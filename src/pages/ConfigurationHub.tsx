// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Sliders, Calendar, Plus, Edit2, Trash2, X, Save, ArrowLeft } from "lucide-react";
import toast from "@/lib/appToast";
import { sendTestEmail } from "../lib/messagingService";
import {
  DEFAULT_SYSTEM_CONFIGURATION,
  mergeSystemConfiguration,
  type SystemConfiguration,
} from "../lib/systemConfiguration";

const CONFIG_SECTIONS = [
  {
    id: "party-dashboard",
    label: "Party Dashboard Configuration",
    desc: "Widgets shown on party dashboards.",
  },
  { id: "email", label: "Email Configuration", desc: "SMTP server and sender settings." },
  {
    id: "whatsapp-sms",
    label: "WhatsApp/SMS API Configuration",
    desc: "Messaging gateway credentials.",
  },
  { id: "backup", label: "Backup Configuration", desc: "Auto-backup schedule and retention." },
  {
    id: "invoice-print",
    label: "Invoice/Document Printing",
    desc: "Invoice print layout defaults.",
  },
  {
    id: "voucher-print",
    label: "Accounting Voucher Printing",
    desc: "Voucher print layout defaults.",
  },
  {
    id: "warning-alarms",
    label: "Warning Alarms",
    desc: "Alert triggers for credit, stock, and price.",
  },
  {
    id: "ageing-slabs",
    label: "Ageing Analysis Time Slabs",
    desc: "Receivable/payable ageing buckets.",
  },
  {
    id: "interest-slabs",
    label: "Interest Calculation Slabs",
    desc: "Overdue interest rates by period.",
  },
  {
    id: "max-voucher-entries",
    label: "Maximum Entries in Voucher",
    desc: "Line item limit per voucher.",
  },
];

const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50";

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-[12px] text-gray-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
    </label>
  );
}

function PrintPanel({
  title,
  config,
  onChange,
}: {
  title: string;
  config: SystemConfiguration["invoicePrint"];
  onChange: (next: SystemConfiguration["invoicePrint"]) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {[
        ["marginTopMm", "Top margin (mm)"],
        ["marginBottomMm", "Bottom margin (mm)"],
        ["marginLeftMm", "Left margin (mm)"],
        ["marginRightMm", "Right margin (mm)"],
        ["fontSize", "Font size (pt)"],
      ].map(([key, lbl]) => (
        <div key={key}>
          <label className={labelCls}>{lbl}</label>
          <input
            type="number"
            className={inputCls}
            value={config[key as keyof typeof config] as number}
            onChange={(e) => onChange({ ...config, [key]: Number(e.target.value) || 0 })}
          />
        </div>
      ))}
      <div className="col-span-2 md:col-span-3">
        <ToggleRow
          label="Show logo on print"
          checked={config.showLogo}
          onChange={(v) => onChange({ ...config, showLogo: v })}
        />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Header text</label>
        <input
          className={inputCls}
          value={config.headerText}
          onChange={(e) => onChange({ ...config, headerText: e.target.value })}
        />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Footer text</label>
        <input
          className={inputCls}
          value={config.footerText}
          onChange={(e) => onChange({ ...config, footerText: e.target.value })}
        />
      </div>
    </div>
  );
}

export default function ConfigurationHub() {
  const {
    currentPage,
    companySettings,
    updateCompanySettings,
    holidays,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    setCurrentPage,
  } = useStore();
  const [activeSection, setActiveSection] = useState("overview");
  const [draft, setDraft] = useState<SystemConfiguration>(DEFAULT_SYSTEM_CONFIGURATION);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "" });

  const isHolidaysPage = currentPage === "holidays";

  const loadedConfig = useMemo(
    () => mergeSystemConfiguration(companySettings?.systemConfiguration),
    [companySettings?.systemConfiguration],
  );

  const openSection = (sectionId: string) => {
    setDraft(loadedConfig);
    setActiveSection(sectionId);
  };

  const saveConfig = async () => {
    await updateCompanySettings({ systemConfiguration: draft });
    toast.success("Configuration saved");
  };

  const resetHolidayForm = () => {
    setHolidayForm({ date: "", name: "" });
    setSelectedHoliday(null);
    setShowHolidayForm(false);
  };

  const handleHolidaySubmit = async () => {
    if (!holidayForm.date || !holidayForm.name.trim()) {
      toast.error("Date and holiday name are required");
      return;
    }
    if (selectedHoliday) {
      await updateHoliday(selectedHoliday.id, holidayForm);
      toast.success("Holiday updated");
    } else {
      await addHoliday(holidayForm);
      toast.success("Holiday saved");
    }
    resetHolidayForm();
  };

  const renderSectionForm = () => {
    switch (activeSection) {
      case "party-dashboard":
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <ToggleRow
              label="Show outstanding balance"
              checked={draft.partyDashboard.showOutstanding}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  partyDashboard: { ...draft.partyDashboard, showOutstanding: v },
                })
              }
            />
            <ToggleRow
              label="Show last invoice"
              checked={draft.partyDashboard.showLastInvoice}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  partyDashboard: { ...draft.partyDashboard, showLastInvoice: v },
                })
              }
            />
            <ToggleRow
              label="Show credit limit"
              checked={draft.partyDashboard.showCreditLimit}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  partyDashboard: { ...draft.partyDashboard, showCreditLimit: v },
                })
              }
            />
            <ToggleRow
              label="Show ageing summary"
              checked={draft.partyDashboard.showAgingSummary}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  partyDashboard: { ...draft.partyDashboard, showAgingSummary: v },
                })
              }
            />
          </div>
        );
      case "email":
        return (
          <div className="grid grid-cols-2 gap-3 bg-white border border-gray-200 rounded-lg p-4">
            {[
              ["smtpHost", "SMTP Host"],
              ["smtpPort", "SMTP Port", "number"],
              ["smtpUser", "SMTP User"],
              ["smtpPassword", "SMTP Password", "password"],
              ["senderEmail", "Sender Email"],
            ].map(([key, lbl, type]) => (
              <div key={key}>
                <label className={labelCls}>{lbl}</label>
                <input
                  type={type || "text"}
                  className={inputCls}
                  value={draft.email[key as keyof typeof draft.email] as string | number}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      email: {
                        ...draft.email,
                        [key]: type === "number" ? Number(e.target.value) || 0 : e.target.value,
                      },
                    })
                  }
                />
              </div>
            ))}
            <div className="col-span-2">
              <ToggleRow
                label="Use TLS/STARTTLS"
                checked={draft.email.useTls}
                onChange={(v) => setDraft({ ...draft, email: { ...draft.email, useTls: v } })}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <button
                type="button"
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
                onClick={() => {
                  const recipient =
                    draft.email.senderEmail?.trim() || draft.email.smtpUser?.trim() || "";
                  if (!recipient) {
                    toast.error("Set sender email or SMTP user first");
                    return;
                  }
                  void sendTestEmail(draft.email, recipient).then((r) => {
                    toast.success(
                      r.method === "smtp"
                        ? "Test email sent via SMTP"
                        : "Opened mail client for test",
                    );
                  });
                }}
              >
                Send test email
              </button>
              <span className="text-[11px] text-gray-500">
                Uses SMTP when configured; otherwise opens your email client.
              </span>
            </div>
          </div>
        );
      case "whatsapp-sms":
        return (
          <div className="grid grid-cols-2 gap-3 bg-white border border-gray-200 rounded-lg p-4">
            {[
              ["provider", "Provider"],
              ["apiKey", "API Key"],
              ["senderId", "Sender ID"],
              ["gatewayUrl", "Gateway URL"],
            ].map(([key, lbl]) => (
              <div key={key} className={key === "gatewayUrl" ? "col-span-2" : ""}>
                <label className={labelCls}>{lbl}</label>
                <input
                  className={inputCls}
                  value={draft.messaging[key as keyof typeof draft.messaging]}
                  onChange={(e) =>
                    setDraft({ ...draft, messaging: { ...draft.messaging, [key]: e.target.value } })
                  }
                />
              </div>
            ))}
          </div>
        );
      case "backup":
        return (
          <div className="grid grid-cols-2 gap-3 bg-white border border-gray-200 rounded-lg p-4">
            <div className="col-span-2">
              <ToggleRow
                label="Enable automatic backup"
                checked={draft.backup.autoBackupEnabled}
                onChange={(v) =>
                  setDraft({ ...draft, backup: { ...draft.backup, autoBackupEnabled: v } })
                }
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Backup folder path</label>
              <input
                className={inputCls}
                value={draft.backup.backupFolder}
                onChange={(e) =>
                  setDraft({ ...draft, backup: { ...draft.backup, backupFolder: e.target.value } })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Frequency</label>
              <select
                className={inputCls}
                value={draft.backup.frequency}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    backup: { ...draft.backup, frequency: e.target.value as any },
                  })
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Retention count</label>
              <input
                type="number"
                className={inputCls}
                value={draft.backup.retentionCount}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    backup: { ...draft.backup, retentionCount: Number(e.target.value) || 1 },
                  })
                }
              />
            </div>
            <div className="col-span-2">
              <ToggleRow
                label="Compress backup files"
                checked={draft.backup.compress}
                onChange={(v) => setDraft({ ...draft, backup: { ...draft.backup, compress: v } })}
              />
            </div>
          </div>
        );
      case "invoice-print":
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <PrintPanel
              title="Invoice"
              config={draft.invoicePrint}
              onChange={(invoicePrint) => setDraft({ ...draft, invoicePrint })}
            />
          </div>
        );
      case "voucher-print":
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <PrintPanel
              title="Voucher"
              config={draft.voucherPrint}
              onChange={(voucherPrint) => setDraft({ ...draft, voucherPrint })}
            />
          </div>
        );
      case "warning-alarms":
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <ToggleRow
              label="Credit limit exceeded"
              checked={draft.warningAlarms.creditLimitExceeded}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  warningAlarms: { ...draft.warningAlarms, creditLimitExceeded: v },
                })
              }
            />
            <ToggleRow
              label="Overdue payment"
              checked={draft.warningAlarms.overduePayment}
              onChange={(v) =>
                setDraft({ ...draft, warningAlarms: { ...draft.warningAlarms, overduePayment: v } })
              }
            />
            <ToggleRow
              label="Low stock"
              checked={draft.warningAlarms.lowStock}
              onChange={(v) =>
                setDraft({ ...draft, warningAlarms: { ...draft.warningAlarms, lowStock: v } })
              }
            />
            <ToggleRow
              label="Below minimum price"
              checked={draft.warningAlarms.belowMinimumPrice}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  warningAlarms: { ...draft.warningAlarms, belowMinimumPrice: v },
                })
              }
            />
            <ToggleRow
              label="PDC cheque due for deposit"
              checked={draft.warningAlarms.pdcDueReminder}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  warningAlarms: { ...draft.warningAlarms, pdcDueReminder: v },
                })
              }
            />
          </div>
        );
      case "ageing-slabs":
        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  {["Label", "From (days)", "To (days)", ""].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.ageingSlabs.map((slab, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="px-2 py-1.5">
                      <input
                        className={inputCls}
                        value={slab.label}
                        onChange={(e) => {
                          const ageingSlabs = [...draft.ageingSlabs];
                          ageingSlabs[idx] = { ...slab, label: e.target.value };
                          setDraft({ ...draft, ageingSlabs });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className={inputCls}
                        value={slab.fromDays}
                        onChange={(e) => {
                          const ageingSlabs = [...draft.ageingSlabs];
                          ageingSlabs[idx] = { ...slab, fromDays: Number(e.target.value) || 0 };
                          setDraft({ ...draft, ageingSlabs });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className={inputCls}
                        value={slab.toDays ?? ""}
                        placeholder="∞"
                        onChange={(e) => {
                          const ageingSlabs = [...draft.ageingSlabs];
                          ageingSlabs[idx] = {
                            ...slab,
                            toDays: e.target.value === "" ? null : Number(e.target.value),
                          };
                          setDraft({ ...draft, ageingSlabs });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        className="text-[11px] text-red-600"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            ageingSlabs: draft.ageingSlabs.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t border-gray-200">
              <button
                className={btnOutline}
                onClick={() =>
                  setDraft({
                    ...draft,
                    ageingSlabs: [
                      ...draft.ageingSlabs,
                      { label: "New slab", fromDays: 0, toDays: 30 },
                    ],
                  })
                }
              >
                Add slab
              </button>
            </div>
          </div>
        );
      case "interest-slabs":
        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  {["Label", "From (days)", "To (days)", "Rate %", ""].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.interestSlabs.map((slab, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="px-2 py-1.5">
                      <input
                        className={inputCls}
                        value={slab.label}
                        onChange={(e) => {
                          const interestSlabs = [...draft.interestSlabs];
                          interestSlabs[idx] = { ...slab, label: e.target.value };
                          setDraft({ ...draft, interestSlabs });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className={inputCls}
                        value={slab.fromDays}
                        onChange={(e) => {
                          const interestSlabs = [...draft.interestSlabs];
                          interestSlabs[idx] = { ...slab, fromDays: Number(e.target.value) || 0 };
                          setDraft({ ...draft, interestSlabs });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className={inputCls}
                        value={slab.toDays ?? ""}
                        placeholder="∞"
                        onChange={(e) => {
                          const interestSlabs = [...draft.interestSlabs];
                          interestSlabs[idx] = {
                            ...slab,
                            toDays: e.target.value === "" ? null : Number(e.target.value),
                          };
                          setDraft({ ...draft, interestSlabs });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className={inputCls}
                        value={slab.ratePercent}
                        onChange={(e) => {
                          const interestSlabs = [...draft.interestSlabs];
                          interestSlabs[idx] = {
                            ...slab,
                            ratePercent: Number(e.target.value) || 0,
                          };
                          setDraft({ ...draft, interestSlabs });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        className="text-[11px] text-red-600"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            interestSlabs: draft.interestSlabs.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t border-gray-200">
              <button
                className={btnOutline}
                onClick={() =>
                  setDraft({
                    ...draft,
                    interestSlabs: [
                      ...draft.interestSlabs,
                      { label: "New slab", fromDays: 0, toDays: 30, ratePercent: 18 },
                    ],
                  })
                }
              >
                Add slab
              </button>
            </div>
          </div>
        );
      case "max-voucher-entries":
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-sm">
            <label className={labelCls}>Maximum line items per voucher</label>
            <input
              type="number"
              min={1}
              max={5000}
              className={inputCls}
              value={draft.maxVoucherEntries}
              onChange={(e) =>
                setDraft({ ...draft, maxVoucherEntries: Number(e.target.value) || 1 })
              }
            />
            <p className="text-[11px] text-gray-500 mt-2">
              Applies to accounting and inventory vouchers when saving new entries.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  if (isHolidaysPage || activeSection === "holidays") {
    return (
      <div className="p-4 bg-[#f5f6fa] min-h-screen">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">List of Holidays</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Define company holidays for working-day calculations
            </p>
          </div>
          <div className="flex gap-2">
            {!isHolidaysPage && (
              <button className={btnOutline} onClick={() => setActiveSection("overview")}>
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
              </button>
            )}
            <button
              className={btnPrimary}
              onClick={() => {
                resetHolidayForm();
                setShowHolidayForm(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Add Holiday
            </button>
          </div>
        </div>
        <div className="flex gap-4">
          <div
            className={`flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden ${showHolidayForm ? "max-w-[calc(100%-320px)]" : ""}`}
          >
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  {["#", "Date", "Holiday Name", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(holidays || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-[12px] text-gray-500">
                      No holidays defined.
                    </td>
                  </tr>
                ) : (
                  [...(holidays || [])]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((h, i) => (
                      <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">
                          {h.date}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{h.name}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <button
                              className={btnOutline}
                              onClick={() => {
                                setSelectedHoliday(h);
                                setHolidayForm({ date: h.date, name: h.name });
                                setShowHolidayForm(true);
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              className={`${btnOutline} text-red-600`}
                              onClick={async () => {
                                if (confirm("Delete holiday?")) {
                                  await deleteHoliday(h.id);
                                  toast.success("Deleted");
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
          {showHolidayForm && (
            <div className="w-80 bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-gray-800">
                  {selectedHoliday ? "Edit" : "Add"} Holiday
                </h2>
                <button onClick={resetHolidayForm}>
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div>
                <label className={labelCls}>Date *</label>
                <input
                  type="date"
                  className={inputCls}
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Holiday Name *</label>
                <input
                  className={inputCls}
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  placeholder="e.g. Dashain"
                />
              </div>
              <div className="flex gap-2 mt-auto">
                <button className={btnPrimary} onClick={handleHolidaySubmit}>
                  <Save className="w-3.5 h-3.5 inline mr-1" /> Save
                </button>
                <button className={btnOutline} onClick={resetHolidayForm}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeSection !== "overview") {
    const section = CONFIG_SECTIONS.find((s) => s.id === activeSection);
    return (
      <div className="p-4 bg-[#f5f6fa] min-h-screen">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">{section?.label}</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">{section?.desc}</p>
          </div>
          <div className="flex gap-2">
            <button className={btnOutline} onClick={() => setActiveSection("overview")}>
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
            </button>
            <button className={btnPrimary} onClick={saveConfig}>
              <Save className="w-3.5 h-3.5 inline mr-1" /> Save
            </button>
          </div>
        </div>
        {renderSectionForm()}
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Setup options</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Company-wide settings for reports, alerts, printing, and integrations
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CONFIG_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-[#1557b0]/40 hover:bg-gray-50 transition-colors"
            onClick={() => openSection(s.id)}
          >
            <div className="text-[13px] font-semibold text-gray-800 mb-1">{s.label}</div>
            <div className="text-[11px] text-gray-500">{s.desc}</div>
          </button>
        ))}
        <button
          type="button"
          className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-[#1557b0]/40 hover:bg-gray-50 transition-colors"
          onClick={() => setCurrentPage("communication-hub")}
        >
          <div className="text-[13px] font-semibold text-gray-800 mb-1">Communication Hub</div>
          <div className="text-[11px] text-gray-500">
            Send invoice emails, payment reminders, and SMS using the settings above.
          </div>
          <div className="mt-2 text-[11px] text-[#1557b0] font-medium">Open hub →</div>
        </button>
        <button
          type="button"
          className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-[#1557b0]/40 hover:bg-gray-50 transition-colors"
          onClick={() => setActiveSection("holidays")}
        >
          <div className="text-[13px] font-semibold text-gray-800 mb-1">List of Holidays</div>
          <div className="text-[11px] text-gray-500">
            Define company holidays for working-day calculations.
          </div>
          <div className="mt-2 text-[11px] text-[#1557b0] font-medium">
            {(holidays || []).length} holiday(s) configured →
          </div>
        </button>
      </div>
    </div>
  );
}
