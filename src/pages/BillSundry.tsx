import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, Edit2, X, AlertTriangle } from "lucide-react";
import { useStore } from "../store/useStore";
import { Button, Input, Select, AccountSelect, Badge, ConfirmDialog } from "../components/ui";
import { BillSundry, BillSundryType, BillSundryNature, BillSundryCalculationBasis, BillSundryRateType } from "../lib/types";
import toast from "react-hot-toast";

const BillSundryPage: React.FC = () => {
  const { billSundries, loadBillSundries, addBillSundry, updateBillSundry, deleteBillSundry, invoices } = useStore();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BillSundry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<BillSundry>>({
    code: "",
    name: "",
    type: "additive",
    nature: "other",
    calculationBasis: "total",
    rateType: "percentage",
    defaultRate: 0,
    accountId: "",
    affectsCostOfGoods: false,
    printOnInvoice: true,
    applyVAT: false,
    sortOrder: 10,
    isActive: true,
  });

  useEffect(() => {
    loadBillSundries();
  }, [loadBillSundries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return billSundries.filter(
      (bs) =>
        bs.name.toLowerCase().includes(q) ||
        bs.code.toLowerCase().includes(q)
    ).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [billSundries, search]);

  const handleOpenCreate = () => {
    setEditing(null);
    setFormData({
      code: "",
      name: "",
      type: "additive",
      nature: "other",
      calculationBasis: "total",
      rateType: "percentage",
      defaultRate: 0,
      accountId: "",
      affectsCostOfGoods: false,
      printOnInvoice: true,
      applyVAT: false,
      sortOrder: 10,
      isActive: true,
    });
    setFormOpen(true);
  };

  const handleEdit = (bs: BillSundry) => {
    setEditing(bs);
    setFormData(bs);
    setFormOpen(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.accountId) {
      toast.error("Account ledger is required");
      return;
    }
    if (Number(formData.defaultRate) < 0) {
      toast.error("Rate cannot be negative");
      return;
    }

    try {
      if (editing) {
        await updateBillSundry(editing.id, formData);
        toast.success("Bill Sundry updated");
      } else {
        await addBillSundry(formData as Omit<BillSundry, "id">);
        toast.success("Bill Sundry created");
      }
      setFormOpen(false);
      loadBillSundries();
    } catch (err: any) {
      toast.error(err.message || "Failed to save Bill Sundry");
    }
  };

  const handleDelete = async (id: string) => {
    const isUsed = invoices.some(inv => 
      inv.additionalCharges && JSON.stringify(inv.additionalCharges).includes(id)
    );
    if (isUsed) {
      toast.error("Cannot delete Bill Sundry. It is used in one or more invoices.");
      setConfirmDeleteId(null);
      return;
    }

    try {
      await deleteBillSundry(id);
      toast.success("Bill Sundry deleted");
      loadBillSundries();
    } catch (err: any) {
      toast.error("Failed to delete");
    }
    setConfirmDeleteId(null);
  };

  return (
    <div className="page-wrapper flex relative overflow-hidden h-[calc(100vh-3.5rem)]">
      <div className={`flex-1 transition-all duration-300 overflow-y-auto ${formOpen ? "mr-[400px]" : ""}`}>
        <div className="page-toolbar flex justify-between items-center mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Bill Sundry Master</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Manage additive/subtractive charges like freight, discount, etc.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search bill sundry..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input w-64 pl-8"
              />
            </div>
            <Button className="h-8 px-3 text-[12px]" onClick={handleOpenCreate}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add New
            </Button>
          </div>
        </div>

        <div className="page-content-area bg-white rounded-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead className="sticky-thead">
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Nature</th>
                  <th className="text-right">Rate</th>
                  <th>Basis</th>
                  <th className="text-center">Print</th>
                  <th className="text-center">Active</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-500 text-[12px]">
                      No bill sundries found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((bs) => (
                    <tr key={bs.id}>
                      <td className="font-medium">{bs.code}</td>
                      <td>{bs.name}</td>
                      <td>
                        <Badge variant={bs.type === "additive" ? "success" : "danger"}
                        >
                          {bs.type === "additive" ? "Additive" : "Subtractive"}
                        </Badge>
                      </td>
                      <td className="capitalize">{bs.nature}</td>
                      <td className="text-right font-mono">
                        {bs.defaultRate > 0 ? (
                          <>
                            {bs.defaultRate}
                            {bs.rateType === "percentage" ? "%" : ""}
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="capitalize">
                        {bs.calculationBasis === "taxableAmount" ? "Taxable Amt" : bs.calculationBasis}
                      </td>
                      <td className="text-center">
                        {bs.printOnInvoice ? "Yes" : "No"}
                      </td>
                      <td className="text-center">
                        <span className={bs.isActive ? "badge-active" : "badge-inactive"}>
                          {bs.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(bs)}
                            className="p-1 text-gray-500 hover:text-[#1557b0] transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(bs.id)}
                            className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {formOpen && (
        <div className="fixed top-0 right-0 w-[400px] h-screen bg-white border-l border-gray-200 shadow-2xl flex flex-col z-40 animate-slide-in">
          <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50 shrink-0">
            <h2 className="text-[14px] font-bold text-gray-800">
              {editing ? "Edit Bill Sundry" : "New Bill Sundry"}
            </h2>
            <button
              onClick={() => setFormOpen(false)}
              className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <form id="sundry-form" onSubmit={handleSave} className="space-y-4">
              <div className="form-grid-2">
                <Input
                  label="Short Code"
                  value={formData.code || ""}
                  onChange={(v) => setFormData({ ...formData, code: v.toUpperCase() })}
                  placeholder="e.g. FRT"
                />
                <Input
                  label="Sort Order"
                  type="number"
                  value={String(formData.sortOrder ?? 0)}
                  onChange={(v) => setFormData({ ...formData, sortOrder: Number(v) })}
                />
              </div>

              <Input
                label="Sundry Name *"
                value={formData.name || ""}
                onChange={(v) => setFormData({ ...formData, name: v })}
                placeholder="e.g. Freight Charges"
                required
              />

              <div className="form-grid-2">
                <Select
                  label="Type"
                  value={formData.type as any}
                  onChange={(v) => setFormData({ ...formData, type: v as BillSundryType })}
                  options={[
                    { value: "additive", label: "Additive (+)" },
                    { value: "subtractive", label: "Subtractive (-)" },
                  ]}
                />
                <Select
                  label="Nature"
                  value={formData.nature as any}
                  onChange={(v) => setFormData({ ...formData, nature: v as BillSundryNature })}
                  options={[
                    { value: "freight", label: "Freight/Transport" },
                    { value: "discount", label: "Discount" },
                    { value: "tax", label: "Tax/Duty" },
                    { value: "other", label: "Other Charges" },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-700">Account Ledger *</label>
                <AccountSelect
                  value={formData.accountId || ""}
                  onChange={(val) => setFormData({ ...formData, accountId: val })}
                />
              </div>

              <div className="form-grid-2">
                <Select
                  label="Rate Type"
                  value={formData.rateType as any}
                  onChange={(v) => setFormData({ ...formData, rateType: v as BillSundryRateType })}
                  options={[
                    { value: "percentage", label: "Percentage (%)" },
                    { value: "fixed", label: "Fixed Amount" },
                  ]}
                />
                <Input
                  label="Default Rate"
                  type="number"
                  step={0.01}
                  min={0}
                  value={String(formData.defaultRate ?? 0)}
                  onChange={(v) => setFormData({ ...formData, defaultRate: Number(v) })}
                />
              </div>

              <div className="space-y-1.5">
                <Select
                  label="Calculation Basis"
                  value={formData.calculationBasis as any}
                  onChange={(v) => setFormData({ ...formData, calculationBasis: v as BillSundryCalculationBasis })}
                  options={[
                    { value: "total", label: "On Basic Total" },
                    { value: "taxableAmount", label: "On Taxable Amount" },
                    { value: "previousAmount", label: "On Previous Amount" },
                    { value: "fixed", label: "Fixed Amount (Manual)" },
                  ]}
                />
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.affectsCostOfGoods || false}
                    onChange={(e) => setFormData({ ...formData, affectsCostOfGoods: e.target.checked })}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  <span className="text-[12px] text-gray-700">Affects Cost of Goods (Inventory)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.printOnInvoice ?? true}
                    onChange={(e) => setFormData({ ...formData, printOnInvoice: e.target.checked })}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  <span className="text-[12px] text-gray-700">Print on Invoice</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.applyVAT || false}
                    onChange={(e) => setFormData({ ...formData, applyVAT: e.target.checked })}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  <span className="text-[12px] text-gray-700">Subject to VAT</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive ?? true}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  <span className="text-[12px] text-gray-700">Status Active</span>
                </label>
              </div>
            </form>
          </div>

          <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="h-8">
              {editing ? "Update" : "Save"} Sundry
            </Button>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          isOpen={!!confirmDeleteId}
          title="Delete Bill Sundry"
          message="Are you sure you want to delete this bill sundry? This action cannot be undone."
          confirmText="Delete"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onClose={() => setConfirmDeleteId(null)}
          danger
        />
      )}
    </div>
  );
};

export default BillSundryPage;
