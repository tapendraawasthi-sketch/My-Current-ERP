import React, { useState, useEffect } from "react";
import { Download, Upload, Cloud, AlertTriangle, Database } from "lucide-react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { ADToBSString } from "../lib/nepaliDate";
import { ConfirmDialog, Spinner, ActionToolbar } from "../components/ui";

export default function BackupRestore() {
  const { exportBackup, importBackup } = useStore();
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<any>(null);
  const [autoBackup, setAutoBackup] = useState(() => {
    return localStorage.getItem("sutra_auto_backup_frequency") || "never";
  });
  const [lastBackupDate, setLastBackupDate] = useState("Never");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const rawDate = localStorage.getItem("sutra_last_backup_date");
    if (rawDate) {
      setLastBackupDate(new Date(rawDate).toLocaleString());
    }
  }, []);

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
            companyName: data.companySettings?.[0]?.companyNameEn || "Unknown",
            ledgers: data.accounts?.length || 0,
            vouchers: data.vouchers?.length || 0,
            customers: data.parties?.length || 0,
            products: data.items?.length || 0,
            date: data.exportDate || "Unknown",
          });
        } catch (error) {
          toast.error("Invalid backup file");
          setBackupFile(null);
          setBackupPreview(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleRestoreClick = () => {
    if (!backupFile) return;
    setIsConfirmOpen(true);
  };

  const handleRestore = async () => {
    if (!backupFile) return;
    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        await importBackup(jsonStr);
        toast.success("Restore complete. Reloading in 2 seconds...");
        setBackupFile(null);
        setBackupPreview(null);
        setTimeout(() => window.location.reload(), 2000);
      } catch (error: any) {
        toast.error(error?.message || "Error restoring backup");
        setIsRestoring(false);
      }
    };
    reader.readAsText(backupFile);
  };

  return (
    <div className="space-y-6">
      <ActionToolbar title="Backup & Restore" subtitle="Data backup and recovery management" />

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center space-x-3">
            <Download className="w-6 h-6 text-[#1557b0]" />
            <h2 className="text-lg font-semibold">Create Backup</h2>
          </div>

          <p className="text-sm text-gray-600">
            Download a complete backup of all your accounting data in JSON format.
          </p>

          <div className="border-t pt-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backup Reminder Frequency
              </label>
              <select
                value={autoBackup}
                onChange={(e) => {
                  const val = e.target.value;
                  setAutoBackup(val);
                  localStorage.setItem("sutra_auto_backup_frequency", val);
                }}
                className="input"
              >
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <button
              onClick={handleCreateBackup}
              className="w-full flex items-center justify-center space-x-2 h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
            >
              <Download className="w-4 h-4" />
              <span>Create Backup Now</span>
            </button>
            <div className="text-[11px] text-gray-550 mt-1">
              Last backup: {lastBackupDate || "Never"}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center space-x-3">
            <Upload className="w-6 h-6 text-orange-600" />
            <h2 className="text-lg font-semibold">Restore Backup</h2>
          </div>

          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700 font-semibold">Warning!</p>
                <p className="text-xs text-red-600 mt-1">
                  This will replace ALL current data. Make sure you have a backup before proceeding.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Backup File
              </label>
              <input type="file" accept=".json" onChange={handleFileUpload} className="input" />
            </div>

            {backupPreview && (
              <div className="bg-gray-50 p-4 rounded space-y-2">
                <h3 className="font-semibold text-sm">Backup Preview:</h3>
                <div className="text-xs space-y-1">
                  <p>
                    <span className="font-medium">Company:</span> {backupPreview.companyName}
                  </p>
                  <p>
                    <span className="font-medium">Backup Date:</span> {backupPreview.date}
                  </p>
                  <p>
                    <span className="font-medium">Ledgers:</span> {backupPreview.ledgers}
                  </p>
                  <p>
                    <span className="font-medium">Vouchers:</span> {backupPreview.vouchers}
                  </p>
                  <p>
                    <span className="font-medium">Customers:</span> {backupPreview.customers}
                  </p>
                  <p>
                    <span className="font-medium">Products:</span> {backupPreview.products}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleRestoreClick}
              disabled={!backupFile || isRestoring}
              className="w-full flex items-center justify-center space-x-2 h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestoring ? <Spinner size="sm" /> : <Upload className="w-4 h-4" />}
              <span>{isRestoring ? "Restoring..." : "Restore Backup"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="flex items-center space-x-3">
          <Cloud className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold">Cloud Backup</h2>
          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
            Coming Soon
          </span>
        </div>

        <p className="text-sm text-gray-600">
          Automatically backup your data to Google Drive for secure cloud storage.
        </p>

        <div className="border-t pt-4">
          <button
            disabled
            className="btn-primary flex items-center space-x-2 opacity-50 cursor-not-allowed"
          >
            <Cloud className="w-4 h-4" />
            <span>Connect Google Drive</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="flex items-center space-x-3">
          <Database className="w-6 h-6 text-green-600" />
          <h2 className="text-lg font-semibold">Import from Tally</h2>
          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
            Coming Soon
          </span>
        </div>

        <p className="text-sm text-gray-600">
          Import your existing data from Tally ERP by uploading Tally XML export file.
        </p>

        <div className="border-t pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Tally XML</label>
            <input
              type="file"
              accept=".xml"
              disabled
              className="input opacity-50 cursor-not-allowed"
            />
          </div>

          <button
            disabled
            className="btn-primary mt-4 flex items-center space-x-2 opacity-50 cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            <span>Import Tally Data</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleRestore}
        title="Confirm Backup Restore"
        message="This action will completely overwrite all current database tables with the backup data. This process cannot be undone."
        confirmText="Yes, Restore Data"
        cancelText="Cancel"
        danger={true}
        confirmValidationText="RESTORE"
        reasonLabel="Type RESTORE to confirm"
        reasonPlaceholder="RESTORE"
      />
    </div>
  );
}
