import React, { useState } from "react";
import toast from "react-hot-toast";
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

type DataModalKey = "backup" | "restore" | "migrate" | "split" | "repair" | "cloud";

export default function DataMenu() {
  const [activeModal, setActiveModal] = useState<DataModalKey | null>(null);
  const perms = useTopbarPermissions();

  return (
    <>
      <TopMenuDropdown
        items={[
          { key: "backup", label: "Backup", shortcut: "B", locked: !perms.canBackupRestore },
          { key: "restore", label: "Restore", shortcut: "R", locked: !perms.canBackupRestore },
          { key: "migrate", label: "Migrate Data", shortcut: "M", locked: !perms.isAdmin },
          { key: "split", label: "Split Company Data", shortcut: "S", locked: !perms.isAdmin },
          { key: "repair", label: "Repair Data", shortcut: "P", locked: !perms.canBackupRestore },
          { key: "cloud", label: "Cloud Backup", shortcut: "C", locked: !perms.canBackupRestore },
        ]}
        onSelect={(key) => setActiveModal(key as DataModalKey)}
      />

      {activeModal === "backup" && <BackupModal onClose={() => setActiveModal(null)} />}
      {activeModal === "restore" && <RestoreModal onClose={() => setActiveModal(null)} />}
      {activeModal === "migrate" && (
        <SimpleDataActionModal
          title="Migrate Data"
          endpoint="/api/data/migrate"
          action="migrate_data"
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "split" && <SplitModal onClose={() => setActiveModal(null)} />}
      {activeModal === "repair" && <RepairModal onClose={() => setActiveModal(null)} />}
      {activeModal === "cloud" && <CloudBackupModal onClose={() => setActiveModal(null)} />}
    </>
  );
}

function BackupModal({ onClose }: { onClose: () => void }) {
  const [location, setLocation] = useState("/backups");
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [encryptBackup, setEncryptBackup] = useState(false);
  const [compress, setCompress] = useState(true);
  const [password, setPassword] = useState("");
  const [progress, setProgress] = useState(0);

  const fileName = `Company_Backup_${new Date().toISOString().slice(0, 10).replace(/-/g, "_")}.zip`;

  const run = async () => {
    try {
      setProgress(25);

      await fetch("/api/data/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          fileName,
          includeAttachments,
          encryptBackup,
          compress,
        }),
      });

      setProgress(100);
      toast.success("✓ Backup completed");

      await logAuditEvent({
        action: "backup",
        module: "data",
        status: "success",
        newValue: { location, fileName, includeAttachments, encryptBackup, compress },
      });

      onClose();
    } catch (error) {
      toast.error("✗ Backup failed");

      await logAuditEvent({
        action: "backup",
        module: "data",
        status: "failed",
        errorReason: String(error),
      });
    }
  };

  return (
    <ModalShell
      title="Backup Data"
      onClose={onClose}
      footer={<PrimaryButton onClick={run}>Start Backup</PrimaryButton>}
    >
      <div className="grid gap-3">
        <Field label="Backup Location" value={location} onChange={setLocation} />
        <Field label="Backup File Name" value={fileName} onChange={() => undefined} disabled />
        <ToggleRow label="Include Attachments" checked={includeAttachments} onChange={setIncludeAttachments} />
        <ToggleRow label="Encrypt Backup" checked={encryptBackup} onChange={setEncryptBackup} />
        {encryptBackup && <Field label="Backup Password" value={password} onChange={setPassword} type="password" />}
        <ToggleRow label="Compress" checked={compress} onChange={setCompress} />

        {progress > 0 && (
          <div className="mt-2">
            <div className="mb-1 text-[11px] text-gray-500">Progress: {progress}%</div>
            <div className="h-2 overflow-hidden rounded bg-gray-100">
              <div className="h-full bg-[#1557b0]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function RestoreModal({ onClose }: { onClose: () => void }) {
  const [restoreAsNew, setRestoreAsNew] = useState(true);

  const run = async () => {
    try {
      await fetch("/api/data/restore", { method: "POST" });

      toast.success("✓ Restore started");

      await logAuditEvent({
        action: "restore",
        module: "data",
        status: "success",
        newValue: { restoreAsNew },
      });

      onClose();
    } catch (error) {
      toast.error("✗ Restore failed");

      await logAuditEvent({
        action: "restore",
        module: "data",
        status: "failed",
        errorReason: String(error),
      });
    }
  };

  return (
    <ModalShell
      title="Restore Data"
      onClose={onClose}
      footer={<PrimaryButton onClick={run}>Restore</PrimaryButton>}
    >
      <input type="file" accept=".zip" className="mb-3 text-[12px]" />
      <ToggleRow label="Restore As New Company" checked={restoreAsNew} onChange={setRestoreAsNew} />
      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
        Restoring may overwrite existing company data if not restored as a new company.
      </div>
    </ModalShell>
  );
}

function SplitModal({ onClose }: { onClose: () => void }) {
  const [splitDate, setSplitDate] = useState("2081-04-01");
  const [oldCompany, setOldCompany] = useState("Old Data Company");
  const [newCompany, setNewCompany] = useState("Current Data Company");
  const [backup, setBackup] = useState(true);

  const run = async () => {
    try {
      await fetch("/api/data/split", { method: "POST" });

      toast.success("✓ Split started");

      await logAuditEvent({
        action: "split_data",
        module: "data",
        status: "success",
        newValue: { splitDate, oldCompany, newCompany, backup },
      });

      onClose();
    } catch (error) {
      toast.error("✗ Split failed");

      await logAuditEvent({
        action: "split_data",
        module: "data",
        status: "failed",
        errorReason: String(error),
      });
    }
  };

  return (
    <ModalShell
      title="Split Company Data"
      onClose={onClose}
      footer={<PrimaryButton onClick={run}>Split Data</PrimaryButton>}
    >
      <div className="grid gap-3">
        <Field label="Split From Date (BS)" value={splitDate} onChange={setSplitDate} />
        <Field label="New Company Name for Old Data" value={oldCompany} onChange={setOldCompany} />
        <Field label="New Company Name for Current Data" value={newCompany} onChange={setNewCompany} />
        <ToggleRow label="Backup Before Split" checked={backup} onChange={setBackup} />
      </div>

      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
        Ensure pending vouchers are reviewed before splitting data.
      </div>
    </ModalShell>
  );
}

function RepairModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState("Basic Repair");

  const run = async () => {
    try {
      await fetch("/api/data/repair", { method: "POST" });

      toast.success("✓ Repair completed");

      await logAuditEvent({
        action: "repair_data",
        module: "data",
        status: "success",
        newValue: { mode },
      });

      onClose();
    } catch (error) {
      toast.error("✗ Repair failed");

      await logAuditEvent({
        action: "repair_data",
        module: "data",
        status: "failed",
        errorReason: String(error),
      });
    }
  };

  return (
    <ModalShell
      title="Repair Data"
      onClose={onClose}
      footer={
        <>
          <OutlineButton>Take Backup</OutlineButton>
          <PrimaryButton onClick={run}>Continue Without Backup</PrimaryButton>
        </>
      }
    >
      <SelectField
        label="Repair Mode"
        value={mode}
        onChange={setMode}
        options={[
          "Basic Repair",
          "Advanced Repair",
          "Data Integrity Check Only",
          "Recalculate Balances Only",
          "Rebuild Indexes Only",
        ]}
      />

      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
        Recommended to take backup first.
      </div>
    </ModalShell>
  );
}

function CloudBackupModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Cloud Backup" onClose={onClose} width="max-w-3xl">
      <div className="grid gap-3 md:grid-cols-4">
        {["Google Drive", "OneDrive", "Dropbox", "Custom Server"].map((name) => (
          <div key={name} className="rounded-md border border-gray-200 p-3">
            <div className="font-semibold text-gray-800">{name}</div>
            <div className="mt-1 text-[11px] text-gray-500">Last backup: —</div>
            <button type="button" className="mt-3 h-7 rounded border border-gray-300 px-2 text-[11px]">
              Connect
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <SelectField
          label="Backup Schedule"
          value="Daily"
          onChange={() => undefined}
          options={["Hourly", "Daily", "Weekly", "Monthly", "On Exit"]}
        />
      </div>

      <div className="mt-4 rounded-md border border-gray-200">
        <div className="border-b border-gray-200 bg-[#f5f6fa] px-3 py-2 text-[10px] font-semibold uppercase text-gray-500">
          Backup History
        </div>
        <div className="px-3 py-8 text-center text-[12px] text-gray-500">No backup history found.</div>
      </div>
    </ModalShell>
  );
}

function SimpleDataActionModal({
  title,
  endpoint,
  action,
  onClose,
}: {
  title: string;
  endpoint: string;
  action: string;
  onClose: () => void;
}) {
  const run = async () => {
    try {
      await fetch(endpoint, { method: "POST" });

      toast.success(`✓ ${title} completed`);

      await logAuditEvent({
        action,
        module: "data",
        status: "success",
      });

      onClose();
    } catch (error) {
      toast.error(`✗ ${title} failed`);

      await logAuditEvent({
        action,
        module: "data",
        status: "failed",
        errorReason: String(error),
      });
    }
  };

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      footer={<PrimaryButton onClick={run}>Continue</PrimaryButton>}
    >
      <p className="text-[12px] text-gray-700">Take a backup before continuing.</p>
    </ModalShell>
  );
}
