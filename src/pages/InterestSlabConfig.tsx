import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { InterestSlab } from "../lib/types";
import { Card, Button, Input, Modal, Badge, ConfirmDialog } from "../components/ui";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

const InterestSlabConfig: React.FC = () => {
  const { interestSlabs, addInterestSlab, updateInterestSlab, deleteInterestSlab } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [basisType, setBasisType] = useState<"day" | "amount">("day");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [slabs, setSlabs] = useState<{
    fromDays?: number;
    toDays?: number;
    fromAmount?: number;
    toAmount?: number;
    ratePercent: number;
    id: string; // for list key
  }[]>([]);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleOpenNew = () => {
    setEditingId(null);
    setName("");
    setBasisType("day");
    setIsDefault(false);
    setIsActive(true);
    setSlabs([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (slab: InterestSlab) => {
    setEditingId(slab.id);
    setName(slab.name);
    setBasisType(slab.basisType);
    setIsDefault(slab.isDefault);
    setIsActive(slab.isActive);
    setSlabs(
      slab.slabs.map((s) => ({ ...s, id: Math.random().toString(36).slice(2) }))
    );
    setIsModalOpen(true);
  };

  const handleAddSlabRow = () => {
    setSlabs([
      ...slabs,
      {
        fromDays: basisType === "day" ? 0 : undefined,
        toDays: basisType === "day" ? 0 : undefined,
        fromAmount: basisType === "amount" ? 0 : undefined,
        toAmount: basisType === "amount" ? 0 : undefined,
        ratePercent: 0,
        id: Math.random().toString(36).slice(2),
      },
    ]);
  };

  const handleRemoveSlabRow = (id: string) => {
    setSlabs(slabs.filter((s) => s.id !== id));
  };

  const updateSlabRow = (id: string, field: string, val: number | undefined) => {
    setSlabs(slabs.map((s) => (s.id === id ? { ...s, [field]: val } : s)));
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (slabs.length === 0) return toast.error("Add at least one slab row");

    const cleanSlabs = slabs.map((s) => {
      const row: any = { ratePercent: Number(s.ratePercent) || 0 };
      if (basisType === "day") {
        row.fromDays = Number(s.fromDays) || 0;
        row.toDays = Number(s.toDays) || 0;
      } else {
        row.fromAmount = Number(s.fromAmount) || 0;
        row.toAmount = Number(s.toAmount) || 0;
      }
      return row;
    });

    const payload: Partial<InterestSlab> = {
      name,
      basisType,
      isDefault,
      isActive,
      slabs: cleanSlabs,
    };

    try {
      if (editingId) {
        await updateInterestSlab(editingId, payload);
        toast.success("Interest slab updated");
      } else {
        await addInterestSlab(payload as InterestSlab);
        toast.success("Interest slab created");
      }
      setIsModalOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteInterestSlab(deleteId);
      toast.success("Deleted successfully");
    } catch (e: any) {
      toast.error("Failed to delete");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none text-xs page-wrapper">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Interest Slabs Config</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Configure interest rate slabs by days or amount
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleOpenNew} icon={<Plus className="h-4 w-4" />}>
          New Slab
        </Button>
      </div>

      <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
        <table className="data-table w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Name
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Basis Type
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                Rules Count
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center">
                Status
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center">
                Default
              </th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150">
            {interestSlabs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-400">
                  No interest slabs found. Click 'New Slab' to create one.
                </td>
              </tr>
            ) : (
              interestSlabs.map((slab) => (
                <tr key={slab.id} className="hover:bg-[#e8eeff] bg-white transition-colors">
                  <td className="px-3 py-2 text-[12px] text-gray-700 font-bold">{slab.name}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700 capitalize">{slab.basisType}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{slab.slabs.length}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={slab.isActive ? "success" : "default"} size="sm">
                      {slab.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {slab.isDefault && (
                      <Badge variant="info" size="sm">
                        Default
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(slab)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(slab.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Edit Interest Slab" : "New Interest Slab"}
        size="lg"
      >
        <div className="flex flex-col gap-4 p-1">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Slab Name"
              value={name}
              onChange={setName}
              placeholder="e.g. Standard 15 Days"
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-gray-700">Basis Type</label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                value={basisType}
                onChange={(e) => {
                  setBasisType(e.target.value as "day" | "amount");
                  setSlabs([]);
                }}
              >
                <option value="day">By Overdue Days</option>
                <option value="amount">By Outstanding Amount</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-[#1557b0]"
              />
              <span className="text-[12px] font-semibold text-gray-700">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 accent-[#1557b0]"
              />
              <span className="text-[12px] font-semibold text-gray-700">Set as Default</span>
            </label>
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden mt-2">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#eef1f8] border-b-2 border-[#c5cad8] text-[#4b5563] uppercase tracking-[0.06em] font-bold">
                <tr>
                  <th className="px-3 py-2">
                    {basisType === "day" ? "From (Days)" : "From (Amount)"}
                  </th>
                  <th className="px-3 py-2">
                    {basisType === "day" ? "To (Days)" : "To (Amount)"}
                  </th>
                  <th className="px-3 py-2">Rate (%)</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {slabs.map((slab) => (
                  <tr key={slab.id}>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className="w-full h-7 px-2 text-right border border-gray-300 rounded focus:border-[#1557b0] focus:outline-none"
                        value={basisType === "day" ? slab.fromDays : slab.fromAmount}
                        onChange={(e) =>
                          updateSlabRow(
                            slab.id,
                            basisType === "day" ? "fromDays" : "fromAmount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className="w-full h-7 px-2 text-right border border-gray-300 rounded focus:border-[#1557b0] focus:outline-none"
                        value={basisType === "day" ? slab.toDays : slab.toAmount}
                        onChange={(e) =>
                          updateSlabRow(
                            slab.id,
                            basisType === "day" ? "toDays" : "toAmount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className="w-full h-7 px-2 text-right border border-gray-300 rounded focus:border-[#1557b0] focus:outline-none"
                        value={slab.ratePercent}
                        onChange={(e) => updateSlabRow(slab.id, "ratePercent", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => handleRemoveSlabRow(slab.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-2 bg-gray-50 border-t border-gray-200">
              <Button variant="outline" size="xs" onClick={handleAddSlabRow} icon={<Plus className="h-3 w-3" />}>
                Add Rule
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Save Slab
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Interest Slab"
        message="Are you sure you want to delete this interest slab? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default InterestSlabConfig;
