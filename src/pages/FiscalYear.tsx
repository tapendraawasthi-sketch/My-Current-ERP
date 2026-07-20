// @ts-nocheck
import React, { useState } from "react";
import { Calendar, Plus, Lock, AlertTriangle } from "lucide-react";
import toast from "@/lib/appToast";
import NepaliDatePicker from "../components/ui/NepaliDatePicker";
import { ADToBSString } from "../lib/nepaliDate";
import { useStore } from "../store/useStore";
import { FiscalYear as FiscalYearRecord, FiscalYearStatus } from "../lib/types";

export default function FiscalYearPage() {
  const { fiscalYears, currentUser, addFiscalYear, setCurrentFiscalYear, closeFiscalYear } =
    useStore();

  const [showForm, setShowForm] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    fiscalYearBS: "",
    startDateBS: "",
    endDateBS: "",
  });

  const handleStartDateChange = (adStr: string) => {
    const bsStr = adStr ? ADToBSString(adStr) : "";
    setFormData((prev) => ({ ...prev, startDate: adStr, startDateBS: bsStr }));
  };

  const handleEndDateChange = (adStr: string) => {
    const bsStr = adStr ? ADToBSString(adStr) : "";
    setFormData((prev) => ({ ...prev, endDate: adStr, endDateBS: bsStr }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter a fiscal year label (e.g. 2081/82)");
      return;
    }
    if (!formData.startDate) {
      toast.error("Please select a Start Date");
      return;
    }
    if (!formData.endDate) {
      toast.error("Please select an End Date");
      return;
    }
    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast.error("End Date must be after Start Date");
      return;
    }

    try {
      setIsSubmitting(true);
      const bsLabel = formData.startDateBS
        ? `${formData.startDateBS} - ${formData.endDateBS}`
        : formData.name;

      const newFY: FiscalYearRecord = {
        id: "",
        name: formData.name.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        isCurrent: false,
        status: FiscalYearStatus.FUTURE,
        fiscalYearBS: bsLabel,
      };

      await addFiscalYear(newFY);
      toast.success("New Fiscal Year Created Successfully");
      setFormData({
        name: "",
        startDate: "",
        endDate: "",
        fiscalYearBS: "",
        startDateBS: "",
        endDateBS: "",
      });
      setShowForm(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create fiscal year");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetActive = async (id: string) => {
    if (!confirm("Set this as the current active fiscal year?")) return;
    try {
      await setCurrentFiscalYear(id);
      toast.success("Fiscal Year activated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to activate");
    }
  };

  const handleCloseYear = async (id: string) => {
    try {
      await closeFiscalYear(id, currentUser?.username || "admin");
      toast.success("Fiscal Year successfully closed!");
      setShowCloseModal(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to close fiscal year");
    }
  };

  const getStatusBadge = (status: string, isCurrent: boolean) => {
    if (isCurrent)
      return (
        <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">
          CURRENT
        </span>
      );
    const classes: Record<string, string> = {
      active: "bg-[var(--ox-success-soft)] text-[var(--ox-success)]",
      closed: "bg-[var(--ox-surface-muted)] text-[var(--ox-text-muted)]",
      future: "bg-amber-100 text-amber-700",
    };
    return (
      <span
        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${classes[status] || "bg-[var(--ox-surface-muted)] text-[var(--ox-text-muted)]"}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="flex animate-fadeIn flex-col gap-4 pb-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--ox-text)]">Fiscal Year Management</h1>
          <p className="mt-0.5 text-[11px] text-[var(--ox-text-muted)]">
            Manage accounting periods and process year-end closings
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex h-8 items-center gap-1.5 rounded-md bg-[var(--ox-primary)] px-3 text-[12px] font-medium text-white hover:bg-[var(--ox-primary-hover)]"
        >
          <Plus className="h-4 w-4" /> Create New Year
        </button>
      </div>

      <div className="overflow-hidden rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)]">
        <table className="w-full">
          <thead className="border-b border-[var(--ox-border)] bg-[var(--ox-surface-muted)]">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
                Label
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
                Start Date (AD)
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
                End Date (AD)
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
                BS Period
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
                Status
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {fiscalYears.map((fy) => (
              <tr
                key={fy.id}
                className="border-b border-[var(--ox-border)] hover:bg-[var(--ox-primary-soft)]/40"
              >
                <td className="px-3 py-2.5 text-[12px] font-medium text-[var(--ox-text)]">{fy.name}</td>
                <td className="px-3 py-2.5 text-[12px] text-[var(--ox-text)]">{fy.startDate || "—"}</td>
                <td className="px-3 py-2.5 text-[12px] text-[var(--ox-text)]">{fy.endDate || "—"}</td>
                <td className="px-3 py-2.5 text-[12px] text-[var(--ox-text)]">
                  {fy.fiscalYearBS || "—"}
                </td>
                <td className="px-3 py-2.5">{getStatusBadge(fy.status, fy.isCurrent)}</td>
                <td className="flex items-center justify-end gap-2 px-3 py-2.5 text-right">
                  {!fy.isCurrent && fy.status !== FiscalYearStatus.CLOSED && (
                    <button
                      type="button"
                      onClick={() => handleSetActive(fy.id)}
                      className="rounded border border-[var(--ox-primary)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--ox-primary)] transition-colors hover:bg-[var(--ox-primary)] hover:text-white"
                    >
                      Set Active
                    </button>
                  )}
                  {(fy.isCurrent || fy.status === FiscalYearStatus.ACTIVE) && (
                    <button
                      type="button"
                      onClick={() => setShowCloseModal(fy.id)}
                      className="flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                    >
                      <Lock className="h-3 w-3" /> Close Year
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {fiscalYears.length === 0 && (
          <div className="p-8 text-center text-[12px] text-[var(--ox-text-muted)]">
            No fiscal years configured. Click "Create New Year" to begin.
          </div>
        )}
      </div>

      {/* CREATE FISCAL YEAR MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col"
            style={{ maxHeight: "90vh" }}
          >
            <div className="p-4 border-b border-[var(--ox-border)] flex items-center justify-between bg-gray-50 rounded-t-lg">
              <h2 className="text-[14px] font-semibold text-[var(--ox-text)] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--ds-action-primary)]" /> Create Fiscal Year
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-[var(--ox-text)] hover:text-[var(--ox-text)] text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <div className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-medium text-[var(--ox-text)] mb-1">
                      Label (e.g. 2081/2082) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="2081/82"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full h-8 px-2.5 text-[12px] border border-[var(--ox-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                    />
                  </div>

                  <div>
                    <NepaliDatePicker
                      label="Start Date"
                      value={formData.startDate}
                      onChange={handleStartDateChange}
                      required
                    />
                    {formData.startDateBS && (
                      <p className="text-[10px] text-[var(--ds-action-primary)] mt-0.5 ml-0.5">
                        BS: {formData.startDateBS}
                      </p>
                    )}
                  </div>

                  <div>
                    <NepaliDatePicker
                      label="End Date"
                      value={formData.endDate}
                      onChange={handleEndDateChange}
                      required
                    />
                    {formData.endDateBS && (
                      <p className="text-[10px] text-[var(--ds-action-primary)] mt-0.5 ml-0.5">
                        BS: {formData.endDateBS}
                      </p>
                    )}
                  </div>

                  <div className="bg-[var(--ds-surface-hover)] text-[var(--ox-text)] text-[11px] p-3 rounded border border-[var(--ox-border)] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      Fiscal year dates should not overlap. The new year will be marked as "future"
                      until activated.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--ox-border)]">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="h-8 px-4 bg-white border border-[var(--ox-border)] text-[var(--ox-text)] text-[12px] font-medium rounded-lg hover:bg-[var(--ox-surface-muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-8 px-4 bg-[var(--ox-primary)] hover:bg-[#2D5A1A] disabled:bg-[var(--ox-surface-muted)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Fiscal Year"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE YEAR MODAL */}
      {showCloseModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-red-100 flex items-center justify-between bg-red-50">
              <h2 className="text-[14px] font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Confirm Year-End Closure
              </h2>
            </div>
            <div className="p-4 text-[12px] text-[var(--ox-text)] space-y-3">
              <p>
                You are about to permanently close{" "}
                <b>{fiscalYears.find((f) => f.id === showCloseModal)?.name}</b>. This will:
              </p>
              <ul className="space-y-2 list-disc list-inside text-[var(--ox-text)]">
                <li>Mark the fiscal year as Closed.</li>
                <li>Record who closed it and when.</li>
                <li>Lock the year to prevent further changes.</li>
              </ul>
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded font-bold flex gap-2 items-center">
                <Lock className="w-4 h-4 shrink-0" /> This action is irreversible. Back up your data
                first.
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 bg-[var(--ox-surface-muted)] border-t border-[var(--ox-border)]">
              <button
                onClick={() => setShowCloseModal(null)}
                className="h-8 px-4 bg-white border border-[var(--ox-border)] text-[var(--ox-text)] text-[12px] font-medium rounded-lg hover:bg-[var(--ox-surface-muted)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCloseYear(showCloseModal)}
                className="h-8 px-4 bg-red-600 hover:bg-red-700 text-[var(--ox-text)] text-[12px] font-medium rounded-lg shadow-sm"
              >
                Proceed & Close Year
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
