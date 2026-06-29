import React, { useState } from "react";
import toast from "react-hot-toast";
import { logAuditEvent } from "@/lib/auditLog";
import {
  Field,
  ModalShell,
  PrimaryButton,
  SelectField,
  ToggleRow,
  TopMenuDropdown,
} from "./shared";

type ExchangeModalKey = "sync" | "import" | "export" | "settings" | "logs";

export default function ExchangeMenu() {
  const [activeModal, setActiveModal] = useState<ExchangeModalKey | null>(null);

  return (
    <>
      <TopMenuDropdown
        items={[
          { key: "sync", label: "Synchronise", shortcut: "S" },
          { key: "import", label: "Import (Data Exchange)", shortcut: "I" },
          { key: "export", label: "Export (Data Exchange)", shortcut: "E" },
          { key: "settings", label: "Connectivity Settings", shortcut: "C" },
          { key: "logs", label: "Exchange Logs", shortcut: "L" },
        ]}
        onSelect={(key) => setActiveModal(key as ExchangeModalKey)}
      />

      {activeModal === "sync" && <SyncModal onClose={() => setActiveModal(null)} />}
      {activeModal === "settings" && <ConnectivityModal onClose={() => setActiveModal(null)} />}
      {activeModal === "logs" && <LogsModal onClose={() => setActiveModal(null)} />}
      {(activeModal === "import" || activeModal === "export") && (
        <ModalShell title="Data Exchange" onClose={() => setActiveModal(null)}>
          <p className="text-[12px] text-gray-700">
            Data exchange import/export is ready for branch-office synchronization setup.
          </p>
        </ModalShell>
      )}
    </>
  );
}

function SyncModal({ onClose }: { onClose: () => void }) {
  const [syncType, setSyncType] = useState("Incremental");
  const [ledgers, setLedgers] = useState(true);
  const [items, setItems] = useState(true);
  const [vouchers, setVouchers] = useState(true);
  const [payroll, setPayroll] = useState(false);

  const run = async () => {
    try {
      await fetch("/api/exchange/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncType, ledgers, items, vouchers, payroll }),
      });

      toast.success("✓ Synchronisation completed");

      await logAuditEvent({
        action: "exchange_sync",
        module: "exchange",
        status: "success",
      });

      onClose();
    } catch {
      toast.error("✗ Synchronisation failed");
    }
  };

  return (
    <ModalShell
      title="Synchronise Data"
      onClose={onClose}
      footer={<PrimaryButton onClick={run}>Synchronise</PrimaryButton>}
    >
      <div className="grid gap-2">
        <SelectField
          label="Sync Type"
          value={syncType}
          onChange={setSyncType}
          options={["Full", "Incremental"]}
        />
        <ToggleRow label="Ledgers" checked={ledgers} onChange={setLedgers} />
        <ToggleRow label="Stock Items" checked={items} onChange={setItems} />
        <ToggleRow label="Vouchers" checked={vouchers} onChange={setVouchers} />
        <ToggleRow label="Payroll Data" checked={payroll} onChange={setPayroll} />
      </div>

      <div className="mt-4 rounded-md border border-gray-200">
        <div className="border-b border-gray-200 bg-[#f5f6fa] px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">
          Sync Log
        </div>
        <div className="px-3 py-8 text-center text-[12px] text-gray-500">
          Sync results will appear here after completion.
        </div>
      </div>
    </ModalShell>
  );
}

function ConnectivityModal({ onClose }: { onClose: () => void }) {
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [frequency, setFrequency] = useState("Daily");

  const save = async () => {
    await fetch("/api/settings/connectivity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverUrl, token, frequency }),
    });

    toast.success("✓ Connectivity settings saved");
    onClose();
  };

  return (
    <ModalShell
      title="Connectivity Settings"
      onClose={onClose}
      footer={<PrimaryButton onClick={save}>Save</PrimaryButton>}
    >
      <div className="grid gap-3">
        <Field label="Server URL" value={serverUrl} onChange={setServerUrl} />
        <Field label="Authentication Token" value={token} onChange={setToken} type="password" />
        <SelectField
          label="Sync Frequency"
          value={frequency}
          onChange={setFrequency}
          options={["Hourly", "Daily", "Weekly", "Monthly"]}
        />
      </div>

      <div className="mt-4 rounded-md border border-gray-200 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase text-gray-500">Branch Mapping</div>
        <div className="text-[12px] text-gray-500">
          Local branch → remote branch mapping will appear here.
        </div>
      </div>
    </ModalShell>
  );
}

function LogsModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Exchange Logs" onClose={onClose} width="max-w-3xl">
      <table className="w-full text-[12px]">
        <thead className="bg-[#f5f6fa]">
          <tr>
            {[
              "Date",
              "Direction",
              "Records Sent",
              "Records Received",
              "Failed",
              "Status",
              "User",
            ].map((heading) => (
              <th key={heading} className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
              No exchange logs found.
            </td>
          </tr>
        </tbody>
      </table>
    </ModalShell>
  );
}
