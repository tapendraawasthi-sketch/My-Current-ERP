// @ts-nocheck
import React, { useState, useMemo } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import { RecurringVoucher, RecurringFrequency, VoucherType, VoucherStatus } from "../lib/types";
import {
  Repeat,
  Plus,
  Edit,
  Pause,
  Play,
  Eye,
  PlayCircle,
  Trash2,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { Card, Button, Input, Select, Badge, ConfirmDialog } from "../components/ui";
import { NepaliDatePicker } from "../components/ui";
import { formatNumber } from "../lib/utils";
import { calculateNextDueDate } from "../lib/accounting";
import toast from "react-hot-toast";

const RecurringVouchers: React.FC = () => {
  const {
    recurringVouchers = [],
    vouchers,
    companySettings,
    currentUser,
    addRecurringVoucher,
    updateRecurringVoucher,
    deleteRecurringVoucher,
    runRecurringVoucher,
  } = useStore();

  const symbol = companySettings?.currencySymbol || "Rs.";

  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "paused">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    templateVoucherId: "",
    voucherType: VoucherType.JOURNAL as VoucherType,
    frequency: RecurringFrequency.MONTHLY as RecurringFrequency,
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    dayOfMonth: 1,
    autoPost: false,
    totalOccurrences: 0,
  });

  const availableTemplates = useMemo(
    () => vouchers.filter((v) => v.status === VoucherStatus.POSTED),
    [vouchers],
  );

  const templateOptions = availableTemplates.map((v) => ({
    value: v.id,
    label: `${v.voucherNo} - ${v.narration} (${symbol}${formatNumber(v.totalDebit)})`,
  }));

  const filteredRecurring = useMemo(() => {
    let filtered = recurringVouchers;

    if (filterActive === "active") {
      filtered = filtered.filter((r) => r.isActive);
    } else if (filterActive === "paused") {
      filtered = filtered.filter((r) => !r.isActive);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) => r.name.toLowerCase().includes(query) || r.voucherType.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [recurringVouchers, filterActive, searchQuery]);

  const resetForm = () => {
    setFormData({
      name: "",
      templateVoucherId: "",
      voucherType: VoucherType.JOURNAL,
      frequency: RecurringFrequency.MONTHLY,
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      dayOfMonth: 1,
      autoPost: false,
      totalOccurrences: 0,
    });
    setEditingId(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (recurring: RecurringVoucher) => {
    setFormData({
      name: recurring.name,
      templateVoucherId: recurring.templateVoucherId,
      voucherType: recurring.voucherType,
      frequency: recurring.frequency,
      startDate: recurring.startDate,
      endDate: recurring.endDate || "",
      dayOfMonth: recurring.dayOfMonth || 1,
      autoPost: recurring.autoPost,
      totalOccurrences: recurring.totalOccurrences || 0,
    });
    setEditingId(recurring.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.templateVoucherId) {
      toast.error("Template voucher is required");
      return;
    }

    try {
      const nextDue = calculateNextDueDate(
        formData.startDate,
        formData.frequency,
        formData.dayOfMonth,
      );

      if (editingId) {
        await updateRecurringVoucher(editingId, {
          ...formData,
          nextDueDate: nextDue,
        });
        toast.success("Recurring voucher updated");
      } else {
        await addRecurringVoucher({
          ...formData,
          nextDueDate: nextDue,
          lastGeneratedDate: undefined,
          completedOccurrences: 0,
          isActive: true,
          generatedVoucherIds: [],
          createdBy: currentUser?.id,
          createdAt: new Date().toISOString(),
        });
        toast.success("Recurring voucher created");
      }

      setShowModal(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to save recurring voucher");
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateRecurringVoucher(id, { isActive: !currentStatus });
      toast.success(currentStatus ? "Recurring voucher paused" : "Recurring voucher activated");
    } catch (error: any) {
      toast.error("Failed to update status");
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await runRecurringVoucher(id);
      toast.success("Voucher generated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate voucher");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecurringVoucher(id);
      toast.success("Recurring voucher deleted");
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error("Failed to delete recurring voucher");
    }
  };

  const getFrequencyLabel = (freq: RecurringFrequency) => {
    const labels = {
      [RecurringFrequency.DAILY]: "Daily",
      [RecurringFrequency.WEEKLY]: "Weekly",
      [RecurringFrequency.MONTHLY]: "Monthly",
      [RecurringFrequency.QUARTERLY]: "Quarterly",
      [RecurringFrequency.YEARLY]: "Yearly",
    };
    return labels[freq] || freq;
  };

  const getVoucherTypeLabel = (type: VoucherType) => {
    const labels: Record<string, string> = {
      [VoucherType.JOURNAL]: "Journal",
      [VoucherType.PAYMENT]: "Payment",
      [VoucherType.RECEIPT]: "Receipt",
      [VoucherType.CONTRA]: "Contra",
    };
    return labels[type] || type;
  };

  const historyRecurring = showHistory ? recurringVouchers.find((r) => r.id === showHistory) : null;
  const historyVouchers = historyRecurring
    ? vouchers.filter((v) => historyRecurring.generatedVoucherIds.includes(v.id))
    : [];

  const today = new Date().toISOString().split("T")[0];
  const dueManual = recurringVouchers.filter(
    (rv) => rv.isActive && !rv.autoPost && rv.nextDueDate <= today,
  );

  return (
    <div className="flex flex-col gap-5 p-6">
      <ActionToolbar title="Recurring Vouchers" subtitle="Automate repetitive journal entries" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#000000] dark:text-[#000000] flex items-center gap-2">
            <Repeat className="h-6 w-6 text-purple-600" />
            Recurring Vouchers & Standing Instructions
          </h1>
          <p className="text-sm text-[#000000] dark:text-[#000000] mt-1">
            Automate recurring transactions like rent, salary, and subscriptions
          </p>
        </div>
        <Button variant="primary" onClick={handleCreate} icon={<Plus className="h-4 w-4" />}>
          Create Template
        </Button>
      </div>

      {dueManual.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {dueManual.length} recurring voucher(s) are due for manual processing
            </p>
          </div>
          <button
            className="text-xs text-amber-700 border border-amber-300 px-3 py-1 rounded hover:bg-amber-100 font-bold"
            onClick={() => dueManual.forEach((rv) => runRecurringVoucher(rv.id))}
          >
            Run All Due
          </button>
        </div>
      )}

      {/* Filters */}
      <Card border padding="md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name or type..."
          />

          <Select
            label="Status"
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active Only" },
              { value: "paused", label: "Paused Only" },
            ]}
            value={filterActive}
            onChange={(v) => setFilterActive(v as any)}
          />
        </div>
      </Card>

      {/* List */}
      {filteredRecurring.length === 0 ? (
        <Card border padding="lg">
          <div className="text-center py-12">
            <Repeat className="h-16 w-16 text-[#000000] mx-auto mb-4" />
            <p className="text-[#000000] dark:text-[#000000]">
              {searchQuery
                ? "No recurring vouchers found matching your search"
                : "No recurring vouchers created yet"}
            </p>
            <Button variant="primary" onClick={handleCreate} className="mt-4">
              Create Your First Recurring Voucher
            </Button>
          </div>
        </Card>
      ) : (
        <Card border padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#EBF5E2] dark:bg-[#EBF5E2] border-b border-[#9DC07A] dark:border-[#9DC07A]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[#000000] dark:text-[#000000]">Name</th>
                  <th className="px-4 py-3 font-semibold text-[#000000] dark:text-[#000000]">Type</th>
                  <th className="px-4 py-3 font-semibold text-[#000000] dark:text-[#000000]">
                    Frequency
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#000000] dark:text-[#000000]">
                    Next Due
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#000000] dark:text-[#000000]">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#000000] dark:text-[#000000] text-center">
                    Occurrences
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#000000] dark:text-[#000000] text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                {filteredRecurring.map((recurring) => (
                  <tr key={recurring.id} className="hover:bg-[#EBF5E2] dark:hover:bg-[#EBF5E2]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#000000] dark:text-[#000000]">
                        {recurring.name}
                      </div>
                      {recurring.autoPost && (
                        <span className="text-xs text-[#000000]">Auto-post enabled</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{getVoucherTypeLabel(recurring.voucherType)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[#000000] dark:text-[#000000]">
                      {getFrequencyLabel(recurring.frequency)}
                      {recurring.frequency === RecurringFrequency.MONTHLY &&
                        recurring.dayOfMonth && (
                          <span className="text-xs block">Day {recurring.dayOfMonth}</span>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-[#000000] dark:text-[#000000]">
                        <Calendar className="h-3 w-3" />
                        {recurring.nextDueDate}
                      </div>
                      {recurring.endDate && (
                        <span className="text-xs text-[#000000]">Until {recurring.endDate}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {recurring.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Paused</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      <span className="font-bold">{recurring.completedOccurrences}</span>
                      {recurring.totalOccurrences ? ` / ${recurring.totalOccurrences}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleRunNow(recurring.id)}
                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                          title="Run Now"
                        >
                          <PlayCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(recurring.id, recurring.isActive)}
                          className="p-1.5 text-[#000000] hover:bg-[#D4EABD] dark:hover:bg-[#D4EABD]/20 rounded"
                          title={recurring.isActive ? "Pause" : "Activate"}
                        >
                          {recurring.isActive ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setShowHistory(recurring.id)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                          title="View History"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(recurring)}
                          className="p-1.5 text-[#000000] hover:bg-[#EBF5E2] dark:hover:bg-[#EBF5E2] rounded"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(recurring.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#EBF5E2] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-[#000000] dark:text-[#000000] mb-4">
                {editingId ? "Edit Recurring Voucher" : "Create Recurring Voucher"}
              </h2>

              <div className="space-y-4">
                <Input
                  label="Name"
                  value={formData.name}
                  onChange={(v) => setFormData({ ...formData, name: v })}
                  placeholder="e.g., Monthly Office Rent"
                  required
                />

                <Select
                  label="Template Voucher"
                  options={[
                    { value: "", label: "Select a voucher to use as template" },
                    ...templateOptions,
                  ]}
                  value={formData.templateVoucherId}
                  onChange={(v) => setFormData({ ...formData, templateVoucherId: v })}
                  searchable
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Frequency"
                    options={[
                      { value: RecurringFrequency.DAILY, label: "Daily" },
                      { value: RecurringFrequency.WEEKLY, label: "Weekly" },
                      { value: RecurringFrequency.MONTHLY, label: "Monthly" },
                      { value: RecurringFrequency.QUARTERLY, label: "Quarterly" },
                      { value: RecurringFrequency.YEARLY, label: "Yearly" },
                    ]}
                    value={formData.frequency}
                    onChange={(v) =>
                      setFormData({ ...formData, frequency: v as RecurringFrequency })
                    }
                  />

                  {formData.frequency === RecurringFrequency.MONTHLY && (
                    <Input
                      label="Day of Month"
                      type="number"
                      value={formData.dayOfMonth}
                      onChange={(v) => setFormData({ ...formData, dayOfMonth: parseInt(v) || 1 })}
                      min={1}
                      max={28}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <NepaliDatePicker
                    label="Start Date"
                    value={formData.startDate}
                    onChange={(v) => setFormData({ ...formData, startDate: v })}
                  />

                  <NepaliDatePicker
                    label="End Date (Optional)"
                    value={formData.endDate}
                    onChange={(v) => setFormData({ ...formData, endDate: v })}
                  />
                </div>

                <Input
                  label="Total Occurrences (Optional, 0 = unlimited)"
                  type="number"
                  value={formData.totalOccurrences}
                  onChange={(v) => setFormData({ ...formData, totalOccurrences: parseInt(v) || 0 })}
                  min={0}
                />

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.autoPost}
                    onChange={(e) => setFormData({ ...formData, autoPost: e.target.checked })}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span className="text-sm text-[#000000] dark:text-[#000000]">
                    Auto-post vouchers (directly post instead of saving as draft)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave}>
                  {editingId ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && historyRecurring && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#EBF5E2] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-[#000000] dark:text-[#000000] mb-4">
                History: {historyRecurring.name}
              </h2>

              {historyVouchers.length === 0 ? (
                <p className="text-[#000000] dark:text-[#000000] text-center py-8">
                  No vouchers generated yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#EBF5E2] dark:bg-[#EBF5E2]">
                      <tr>
                        <th className="px-3 py-2 text-left">Voucher No</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {historyVouchers.map((v) => (
                        <tr key={v.id}>
                          <td className="px-3 py-2 font-mono">{v.voucherNo}</td>
                          <td className="px-3 py-2">{v.dateNepali || v.date}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={v.status === VoucherStatus.POSTED ? "success" : "default"}
                            >
                              {v.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {symbol} {formatNumber(v.totalDebit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end mt-4">
                <Button variant="outline" onClick={() => setShowHistory(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Recurring Voucher?"
        message="This will delete the recurring voucher template. Already generated vouchers will not be affected."
        confirmText="Delete"
        cancelText="Cancel"
        danger
      />
    </div>
  );
};

export default RecurringVouchers;
