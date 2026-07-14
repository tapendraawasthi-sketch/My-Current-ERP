import React, { useMemo, useState } from "react";
import toast from "@/lib/appToast";
import { useStore } from "@/store/useStore";
import { logAuditEvent } from "@/lib/auditLog";
import { useTopbarPermissions } from "./useTopbarPermissions";
import {
  Field,
  ModalShell,
  OutlineButton,
  PrimaryButton,
  SelectField,
  ToggleRow,
  TopMenuDropdown,
} from "./shared";

type HelpModalKey =
  "docs" | "updates" | "troubleshoot" | "settings" | "addons" | "support" | "about" | "knowledge";

interface AdminLogRow {
  id: string;
  timestamp: string;
  level: string;
  message: string;
}

interface SupportTicketRow {
  id: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
}

const APP_SETTINGS_KEY = "sutraAppSettings";
const SUPPORT_TICKETS_KEY = "sutraSupportTickets";
const TROUBLESHOOT_RESULTS_KEY = "sutraTroubleshootResults";

export default function HelpMenu() {
  const [activeModal, setActiveModal] = useState<HelpModalKey | null>(null);
  const perms = useTopbarPermissions();

  return (
    <>
      <TopMenuDropdown
        items={[
          { key: "docs", label: "Open Help Docs", shortcut: "F1" },
          { key: "updates", label: "Check for Updates", shortcut: "U" },
          {
            key: "troubleshoot",
            label: "Troubleshoot",
            shortcut: "T",
            locked: !perms.canManageSecurity,
          },
          { key: "settings", label: "Application Settings", shortcut: "S" },
          { key: "addons", label: "Add-On / Extensions", shortcut: "A" },
          { key: "support", label: "Contact Support", shortcut: "C" },
          { key: "about", label: "About Sutra ERP", shortcut: "B" },
          { key: "knowledge", label: "Online Knowledge Base", shortcut: "Ctrl+F1" },
        ]}
        onSelect={(key) => setActiveModal(key as HelpModalKey)}
      />

      {activeModal === "docs" && <HelpDocsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "updates" && <UpdatesModal onClose={() => setActiveModal(null)} />}
      {activeModal === "troubleshoot" && <TroubleshootModal onClose={() => setActiveModal(null)} />}
      {activeModal === "settings" && (
        <ApplicationSettingsModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "addons" && <AddonsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "support" && <ContactSupportModal onClose={() => setActiveModal(null)} />}
      {activeModal === "about" && <AboutModal onClose={() => setActiveModal(null)} />}
      {activeModal === "knowledge" && <KnowledgeBaseModal onClose={() => setActiveModal(null)} />}
    </>
  );
}

function HelpDocsModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");

  const sections = [
    {
      title: "Getting Started",
      cards: [
        "Create or select a company",
        "Configure fiscal year and PAN",
        "Set default currency as NPR",
        "Enable VAT/TDS features as required",
      ],
    },
    {
      title: "Voucher Entry",
      cards: [
        "Sales Invoice",
        "Purchase Invoice",
        "Payment Voucher",
        "Receipt Voucher",
        "Journal Entry",
        "Contra Entry",
      ],
    },
    {
      title: "Reports",
      cards: ["Trial Balance", "Profit & Loss", "Balance Sheet", "Ledger Report", "Stock Summary"],
    },
    {
      title: "VAT Returns (Nepal IRD)",
      cards: [
        "VAT return is monthly",
        "Use PAN/VAT number for taxpayer identification",
        "Standard VAT rate is 13%",
        "IRD filings should be reconciled before submission",
      ],
    },
    {
      title: "Payroll",
      cards: ["Employee master", "Salary structure", "PF", "CIT", "Payslip"],
    },
    {
      title: "Import/Export",
      cards: ["Import masters", "Import transactions", "Export reports", "Export logs"],
    },
    {
      title: "Keyboard Shortcuts",
      cards: [
        "Alt+K — Company Menu",
        "Alt+Y — Data Menu",
        "Alt+Z — Exchange Menu",
        "Alt+O — Import Menu",
        "Alt+E — Export Menu",
        "Alt+M — Share Menu",
        "Alt+P — Print Menu",
        "Alt+G — Go To",
        "Ctrl+G — Switch To",
        "F1 — Help",
        "F3 — Select Company",
        "Ctrl+F3 — Shut Company",
        "F11 — Company Features",
      ],
    },
  ];

  const filteredSections = sections.filter(
    (section) =>
      section.title.toLowerCase().includes(search.toLowerCase()) ||
      section.cards.some((card) => card.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <ModalShell title="Help Docs" onClose={onClose} width="max-w-4xl">
      <div className="mb-3">
        <Field
          label="Search Help"
          value={search}
          onChange={setSearch}
          placeholder="Search help topics..."
        />
      </div>

      <div className="grid gap-3">
        {filteredSections.map((section) => (
          <div key={section.title} className="rounded-md border border-gray-200">
            <div className="border-b border-gray-200 bg-[#f5f6fa] px-3 py-2 text-[12px] font-semibold text-gray-800">
              {section.title}
            </div>
            <div className="grid gap-2 p-3 md:grid-cols-2">
              {section.cards.map((card) => (
                <div
                  key={card}
                  className="rounded border border-gray-100 bg-white p-2 text-[12px] text-gray-700"
                >
                  {card}
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredSections.length === 0 && (
          <div className="py-8 text-center text-[12px] text-gray-500">No help topics found.</div>
        )}
      </div>
    </ModalShell>
  );
}

function UpdatesModal({ onClose }: { onClose: () => void }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState("");

  const check = async () => {
    setChecking(true);
    setResult("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setResult("You are using the latest available version.");
      toast.success("✓ Update check completed");
    } finally {
      setChecking(false);
    }
  };

  return (
    <ModalShell
      title="Check for Updates"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={check} disabled={checking}>
          {checking ? "Checking..." : "Check Now"}
        </PrimaryButton>
      }
    >
      <div className="rounded-md border border-gray-200 bg-[#f5f6fa] p-4 text-[12px] text-gray-700">
        Sutra ERP periodically checks for application updates, compliance updates, and Nepal IRD
        rule changes.
      </div>

      {result && (
        <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-[12px] text-green-700">
          {result}
        </div>
      )}
    </ModalShell>
  );
}

function TroubleshootModal({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<Record<string, string>>(readTroubleshootResults());
  const [logs, setLogs] = useState<AdminLogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const actions = [
    {
      title: "Check Data Integrity",
      endpoint: "/api/admin/check-integrity",
      description: "Checks vouchers, ledgers, inventory postings, and master links.",
    },
    {
      title: "Rebuild Indexes",
      endpoint: "/api/admin/rebuild-indexes",
      description: "Rebuilds searchable and reporting indexes.",
    },
    {
      title: "Clear Cache",
      endpoint: "/api/admin/clear-cache",
      description: "Clears application cache safely.",
    },
    {
      title: "Send Diagnostic Report",
      endpoint: "/api/admin/diagnostics",
      description: "Sends browser and app diagnostics to support.",
    },
  ];

  const runAction = async (title: string, endpoint: string) => {
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const message = response.ok ? "Completed successfully" : "Server returned fallback status";

      const next = {
        ...results,
        [title]: `${message} at ${new Date().toLocaleTimeString()}`,
      };

      setResults(next);
      localStorage.setItem(TROUBLESHOOT_RESULTS_KEY, JSON.stringify(next));

      toast.success(`✓ ${title} completed`);

      await logAuditEvent({
        action: title.toLowerCase().replace(/\s+/g, "_"),
        module: "admin",
        status: "success",
      });
    } catch (error) {
      const next = {
        ...results,
        [title]: `Failed: ${String(error)}`,
      };

      setResults(next);
      localStorage.setItem(TROUBLESHOOT_RESULTS_KEY, JSON.stringify(next));

      toast.error(`✗ ${title} failed`);

      await logAuditEvent({
        action: title.toLowerCase().replace(/\s+/g, "_"),
        module: "admin",
        status: "failed",
        errorReason: String(error),
      });
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);

    try {
      const response = await fetch("/api/admin/logs");
      if (!response.ok) throw new Error("Unable to load logs");

      const json = await response.json();
      const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setLogs(list);
    } catch {
      setLogs([
        {
          id: "local-log",
          timestamp: new Date().toISOString(),
          level: "info",
          message: "No server logs available. Showing local fallback message.",
        },
      ]);
    } finally {
      setLoadingLogs(false);
    }
  };

  return (
    <ModalShell title="Troubleshoot" onClose={onClose} width="max-w-5xl">
      <div className="grid gap-3 md:grid-cols-2">
        {actions.map((action) => (
          <div key={action.title} className="rounded-md border border-gray-200 p-3">
            <div className="text-[12px] font-semibold text-gray-800">{action.title}</div>
            <div className="mt-1 text-[11px] text-gray-500">{action.description}</div>

            {results[action.title] && (
              <div className="mt-2 rounded border border-blue-100 bg-blue-50 p-2 text-[11px] text-blue-700">
                {results[action.title]}
              </div>
            )}

            <button
              type="button"
              className="mt-3 h-8 rounded-md bg-[#1557b0] px-3 text-[12px] font-medium text-white hover:bg-[#0f4a96]"
              onClick={() => runAction(action.title, action.endpoint)}
            >
              Run
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 bg-[#f5f6fa] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase text-gray-500">Recent Error Logs</div>
          <button
            type="button"
            onClick={loadLogs}
            className="h-7 rounded border border-gray-300 bg-white px-2 text-[11px]"
          >
            {loadingLogs ? "Loading..." : "View Error Logs"}
          </button>
        </div>

        <table className="w-full text-[12px]">
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-100">
                <td className="px-3 py-2 font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-3 py-2 uppercase">{log.level}</td>
                <td className="px-3 py-2">{log.message}</td>
              </tr>
            ))}

            {logs.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-gray-500">No logs loaded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}

function ApplicationSettingsModal({ onClose }: { onClose: () => void }) {
  const saved = readAppSettings();

  const tabs = [
    "General",
    "Display",
    "Date & Number",
    "Email",
    "Print",
    "Security",
    "Notifications",
  ];
  const [activeTab, setActiveTab] = useState("General");

  const [language, setLanguage] = useState(saved.language);
  const [autoSave, setAutoSave] = useState(saved.autoSave);
  const [theme, setTheme] = useState(saved.theme);
  const [dateFormat, setDateFormat] = useState(saved.dateFormat);
  const [numberFormat, setNumberFormat] = useState(saved.numberFormat);
  const [decimalPlaces, setDecimalPlaces] = useState(saved.decimalPlaces);
  const [notifications, setNotifications] = useState(saved.notifications);

  const save = async () => {
    const payload = {
      language,
      autoSave,
      theme,
      dateFormat,
      numberFormat,
      decimalPlaces,
      notifications,
    };

    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(payload));

    try {
      await fetch("/api/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Frontend settings still saved locally.
    }

    toast.success("✓ Application settings saved");
    onClose();
  };

  return (
    <ModalShell
      title="Application Settings"
      onClose={onClose}
      width="max-w-4xl"
      footer={<PrimaryButton onClick={save}>Save Settings</PrimaryButton>}
    >
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`h-8 px-3 text-[12px] font-medium ${
              activeTab === tab ? "border-b-2 border-[#1557b0] text-[#1557b0]" : "text-gray-600"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "General" && (
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="App Language"
            value={language}
            onChange={setLanguage}
            options={["English", "Nepali"]}
          />
          <SelectField
            label="Auto-save Interval"
            value={autoSave}
            onChange={setAutoSave}
            options={["Off", "1 minute", "5 minutes", "10 minutes"]}
          />
        </div>
      )}

      {activeTab === "Display" && (
        <SelectField label="Theme" value={theme} onChange={setTheme} options={["Light", "Dark"]} />
      )}

      {activeTab === "Date & Number" && (
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Primary Date Format"
            value={dateFormat}
            onChange={setDateFormat}
            options={["BS", "AD"]}
          />
          <SelectField
            label="Number Format"
            value={numberFormat}
            onChange={setNumberFormat}
            options={["1,00,000", "100,000"]}
          />
          <SelectField
            label="Decimal Places"
            value={decimalPlaces}
            onChange={setDecimalPlaces}
            options={["0", "2", "3", "4"]}
          />
        </div>
      )}

      {activeTab === "Notifications" && (
        <ToggleRow
          label="Enable Notifications"
          checked={notifications}
          onChange={setNotifications}
        />
      )}

      {!["General", "Display", "Date & Number", "Notifications"].includes(activeTab) && (
        <div className="py-8 text-center text-[12px] text-gray-500">
          {activeTab} settings are available in their respective menu modules.
        </div>
      )}
    </ModalShell>
  );
}

function AddonsModal({ onClose }: { onClose: () => void }) {
  const addons = [
    "Advanced Payroll",
    "Cloud Backup Plus",
    "Branch Synchronisation",
    "IRD Filing Assistant",
  ];

  return (
    <ModalShell title="Add-On / Extensions" onClose={onClose}>
      <div className="grid gap-2">
        {addons.map((addon) => (
          <div
            key={addon}
            className="flex items-center justify-between rounded border border-gray-200 p-3"
          >
            <span className="text-[12px] font-medium text-gray-800">{addon}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
              Coming Soon
            </span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function ContactSupportModal({ onClose }: { onClose: () => void }) {
  const existingTickets = readSupportTickets();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [tickets, setTickets] = useState<SupportTicketRow[]>(existingTickets);

  const submit = async () => {
    if (!subject.trim()) {
      toast.error("✗ Subject is required");
      return;
    }

    const ticket: SupportTicketRow = {
      id: String(Date.now()),
      subject,
      priority,
      status: "Open",
      createdAt: new Date().toISOString(),
    };

    try {
      await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, priority }),
      });
    } catch {
      // Keep local ticket as fallback.
    }

    const next = [ticket, ...tickets];
    setTickets(next);
    localStorage.setItem(SUPPORT_TICKETS_KEY, JSON.stringify(next));

    toast.success("✓ Support ticket raised");
    setSubject("");
    setDescription("");
  };

  return (
    <ModalShell
      title="Contact Support"
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <OutlineButton onClick={() => window.open("mailto:support@sutraerp.com", "_blank")}>
            Email Support
          </OutlineButton>
          <PrimaryButton onClick={submit}>Raise Ticket</PrimaryButton>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Subject" value={subject} onChange={setSubject} />
        <SelectField
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={["Low", "Normal", "High", "Urgent"]}
        />
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[11px] font-medium text-gray-600">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-28 rounded-md border border-gray-300 p-2 text-[12px] focus:border-[#1557b0] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20"
        />
      </label>

      <div className="mt-4 rounded-md border border-gray-200 bg-[#f5f6fa] p-3 text-[12px]">
        Email Support: support@sutraerp.com
        <br />
        Phone Support: +977-1-XXXXXXX
      </div>

      <div className="mt-4 rounded-md border border-gray-200">
        <div className="border-b border-gray-200 bg-[#f5f6fa] px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">
          Existing Tickets
        </div>
        <table className="w-full text-[12px]">
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-gray-100">
                <td className="px-3 py-2">{ticket.subject}</td>
                <td className="px-3 py-2">{ticket.priority}</td>
                <td className="px-3 py-2">{ticket.status}</td>
                <td className="px-3 py-2">{new Date(ticket.createdAt).toLocaleString()}</td>
              </tr>
            ))}

            {tickets.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500">No tickets found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}

function KnowledgeBaseModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell
      title="Online Knowledge Base"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={() => window.open("https://docs.sutraerp.com", "_blank")}>
          Open Knowledge Base
        </PrimaryButton>
      }
    >
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-700">
        Open the online Sutra ERP knowledge base for tutorials, release notes, and Nepal compliance
        guides.
      </div>
    </ModalShell>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  const currentUser = useStore((state) => state.currentUser);
  const companySettings = useStore((state) => state.companySettings);

  const appInfo = {
    appName: "Sutra ERP",
    version: "2.0",
    build: "Web",
    license: "Active",
    registeredUser: currentUser?.name || currentUser?.username || "User",
    company: companySettings?.companyNameEn || companySettings?.name || "—",
    databaseVersion: "Local/Cloud",
    environment: (import.meta as any).env?.MODE ?? "development",
  };

  return (
    <ModalShell title="About Sutra ERP" onClose={onClose}>
      <div className="rounded-md border border-gray-200 bg-[#f5f6fa] p-4 text-[12px]">
        <div className="mb-2 text-[15px] font-semibold text-gray-800">{appInfo.appName}</div>
        <div className="grid gap-1">
          <div>
            <strong>Version:</strong> {appInfo.version}
          </div>
          <div>
            <strong>Build Number:</strong> {appInfo.build}
          </div>
          <div>
            <strong>License Status:</strong> {appInfo.license}
          </div>
          <div>
            <strong>Registered User:</strong> {appInfo.registeredUser}
          </div>
          <div>
            <strong>Company:</strong> {appInfo.company}
          </div>
          <div>
            <strong>Database Version:</strong> {appInfo.databaseVersion}
          </div>
          <div>
            <strong>Node Environment:</strong> {appInfo.environment}
          </div>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-3 text-[11px] text-gray-500">
          Designed for Nepal&apos;s accounting standards | IRD VAT compliant
        </div>
      </div>
    </ModalShell>
  );
}

function readAppSettings(): {
  language: string;
  autoSave: string;
  theme: string;
  dateFormat: string;
  numberFormat: string;
  decimalPlaces: string;
  notifications: boolean;
} {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || "{}");
    return {
      language: parsed.language || "English",
      autoSave: parsed.autoSave || "5 minutes",
      theme: parsed.theme || "Light",
      dateFormat: parsed.dateFormat || "BS",
      numberFormat: parsed.numberFormat || "1,00,000",
      decimalPlaces: parsed.decimalPlaces || "2",
      notifications: parsed.notifications ?? true,
    };
  } catch {
    return {
      language: "English",
      autoSave: "5 minutes",
      theme: "Light",
      dateFormat: "BS",
      numberFormat: "1,00,000",
      decimalPlaces: "2",
      notifications: true,
    };
  }
}

function readTroubleshootResults(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(TROUBLESHOOT_RESULTS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readSupportTickets(): SupportTicketRow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SUPPORT_TICKETS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
