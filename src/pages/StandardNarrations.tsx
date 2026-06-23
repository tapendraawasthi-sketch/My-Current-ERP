import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, Edit2, X, AlertTriangle } from "lucide-react";
import { useStore } from "../store/useStore";
import { Button, Input, Select, Badge, ConfirmDialog } from "../components/ui";
import { StandardNarration } from "../lib/types";
import toast from "react-hot-toast";

const getCategoryColor = (category: string) => {
  switch (category) {
    case "sales": return "bg-blue-100 text-blue-700";
    case "payment": return "bg-amber-100 text-amber-700";
    case "receipt": return "bg-green-100 text-green-700";
    case "journal": return "bg-gray-100 text-gray-700";
    case "purchase": return "bg-orange-100 text-orange-700";
    default: return "bg-slate-100 text-slate-700";
  }
};

const StandardNarrationsPage: React.FC = () => {
  const { standardNarrations, loadStandardNarrations, addStandardNarration, updateStandardNarration, deleteStandardNarration } = useStore();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StandardNarration | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<StandardNarration>>({
    code: "",
    text: "",
    category: "general",
    isActive: true,
  });

  useEffect(() => {
    loadStandardNarrations();
  }, [loadStandardNarrations]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return standardNarrations
      .filter((sn) => {
        if (categoryFilter !== "all" && sn.category !== categoryFilter) return false;
        if (!q) return true;
        return sn.code.toLowerCase().includes(q) || sn.text.toLowerCase().includes(q);
      })
      .sort((a, b) => b.usageCount - a.usageCount);
  }, [standardNarrations, search, categoryFilter]);

  const handleOpenCreate = () => {
    setEditing(null);
    setFormData({
      code: "",
      text: "",
      category: "general",
      isActive: true,
    });
    setFormOpen(true);
  };

  const handleEdit = (sn: StandardNarration) => {
    setEditing(sn);
    setFormData(sn);
    setFormOpen(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.code?.trim()) {
      toast.error("Short Code is required");
      return;
    }
    if (!formData.text?.trim()) {
      toast.error("Narration text is required");
      return;
    }

    // Unique code validation (case-insensitive)
    const codeUpper = formData.code.trim().toUpperCase();
    const isDuplicate = standardNarrations.some(
      sn => sn.code.toUpperCase() === codeUpper && sn.id !== editing?.id
    );

    if (isDuplicate) {
      toast.error("Short Code must be unique");
      return;
    }

    try {
      const finalData = {
        ...formData,
        code: codeUpper,
        usageCount: editing ? editing.usageCount : 0,
      } as StandardNarration;

      if (editing) {
        await updateStandardNarration(editing.id, finalData);
        toast.success("Standard Narration updated");
      } else {
        await addStandardNarration(finalData);
        toast.success("Standard Narration created");
      }
      setFormOpen(false);
      loadStandardNarrations();
    } catch (err: any) {
      toast.error("Failed to save Narration");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStandardNarration(id);
      toast.success("Standard Narration deleted");
      loadStandardNarrations();
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
            <h1 className="text-[15px] font-semibold text-gray-800">Standard Narrations</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Manage commonly used narrations with placeholders.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val as string)}
              options={[
                { value: "all", label: "All Categories" },
                { value: "payment", label: "Payment" },
                { value: "receipt", label: "Receipt" },
                { value: "journal", label: "Journal" },
                { value: "sales", label: "Sales" },
                { value: "purchase", label: "Purchase" },
                { value: "general", label: "General" },
              ]}
              className="w-40"
            />
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search code or text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input w-56 pl-8"
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
                  <th>Narration Text</th>
                  <th>Category</th>
                  <th className="text-right">Usage</th>
                  <th className="text-center">Active</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 text-[12px]">
                      No standard narrations found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((sn) => (
                    <tr key={sn.id}>
                      <td className="font-medium">{sn.code}</td>
                      <td className="max-w-md truncate" title={sn.text}>
                        {sn.text.length > 80 ? `${sn.text.substring(0, 80)}...` : sn.text}
                      </td>
                      <td className="capitalize">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${getCategoryColor(sn.category)}`}>
                          {sn.category}
                        </span>
                      </td>
                      <td className="text-right">{sn.usageCount}</td>
                      <td className="text-center">
                        <span className={sn.isActive ? "badge-active" : "badge-inactive"}>
                          {sn.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(sn)}
                            className="p-1 text-gray-500 hover:text-[#1557b0] transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(sn.id)}
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
              {editing ? "Edit Narration" : "New Narration"}
            </h2>
            <button
              onClick={() => setFormOpen(false)}
              className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <form id="narration-form" onSubmit={handleSave} className="space-y-4">
              <div className="form-grid-2">
                <Input
                  label="Short Code *"
                  value={formData.code || ""}
                  onChange={(v) => setFormData({ ...formData, code: v })}
                  placeholder="e.g. RENT"
                  required
                />
                <Select
                  label="Category *"
                  value={formData.category as string}
                  onChange={(v) => setFormData({ ...formData, category: v as any })}
                  options={[
                    { value: "payment", label: "Payment" },
                    { value: "receipt", label: "Receipt" },
                    { value: "journal", label: "Journal" },
                    { value: "sales", label: "Sales" },
                    { value: "purchase", label: "Purchase" },
                    { value: "general", label: "General" },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-600">Narration Text *</label>
                <textarea
                  value={formData.text || ""}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  placeholder="e.g. Being payment of rent for {month}"
                  className="w-full h-24 p-2 text-[12px] border border-gray-300 rounded-md focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] outline-none resize-none"
                  required
                  maxLength={500}
                />
                <p className="text-[10px] text-gray-500">
                  Tip: Use placeholders like {'{party}'}, {'{amount}'}, {'{date}'}, {'{month}'}, {'{ref}'}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200">
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
              {editing ? "Update" : "Save"} Narration
            </Button>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          isOpen={!!confirmDeleteId}
          title="Delete Standard Narration"
          message="Are you sure you want to delete this narration? This action cannot be undone."
          confirmText="Delete"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onClose={() => setConfirmDeleteId(null)}
          danger
        />
      )}
    </div>
  );
};

export default StandardNarrationsPage;
