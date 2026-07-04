// @ts-nocheck
import React, { useState, useMemo } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Building2,
  MapPin,
  User,
  Save,
  X,
} from "lucide-react";
import { useStore } from "../store";
import { CostCenterLevel, CostCenter } from "../lib/types";
import toast from "react-hot-toast";
import { ReportEmptyState } from "../components/ReportEmptyState";

const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

export default function CostCenters() {
  const { costCenters, addCostCenter, updateCostCenter, deleteCostCenter, vouchers } = useStore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["root"]));
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    parentId: "",
    description: "",
    responsiblePerson: "",
    isActive: true,
  });

  const costCenterBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    vouchers
      .filter((v) => v.status === "POSTED")
      .forEach((v) => {
        v.lines.forEach((l) => {
          if (l.costCenterId) {
            balances[l.costCenterId] = (balances[l.costCenterId] || 0) + (l.debit - l.credit);
          }
        });
      });

    const rollup = { ...balances };

    const resolveBalance = (id: string): number => {
      const children = costCenters.filter((c) => c.parentId === id);
      let sum = balances[id] || 0;
      for (const child of children) {
        sum += resolveBalance(child.id);
      }
      rollup[id] = sum;
      return sum;
    };

    const rootNodes = costCenters.filter((c) => !c.parentId);
    rootNodes.forEach((rn) => resolveBalance(rn.id));

    return rollup;
  }, [vouchers, costCenters]);

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedNodes(newExpanded);
  };

  const handleAddNew = () => {
    setFormData({
      name: "",
      code: "",
      parentId: selectedCenterId || "",
      description: "",
      responsiblePerson: "",
      isActive: true,
    });
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEdit = (c: CostCenter) => {
    setFormData({
      name: c.name,
      code: c.code,
      parentId: c.parentId || "",
      description: c.description || "",
      responsiblePerson: c.responsiblePerson || "",
      isActive: c.isActive,
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (costCenters.some((c) => c.parentId === id)) {
      toast.error("Cannot delete a cost center with active sub-centers.");
      return;
    }
    if (confirm("Are you sure you want to delete this cost center?")) {
      await deleteCostCenter(id);
      if (selectedCenterId === id) setSelectedCenterId(null);
      toast.success("Cost center deleted");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && selectedCenterId) {
        if (formData.parentId === selectedCenterId) {
          toast.error("A cost center cannot be its own parent.");
          return;
        }
        await updateCostCenter({
          id: selectedCenterId,
          ...formData,
          level: formData.parentId ? CostCenterLevel.SECONDARY : CostCenterLevel.PRIMARY,
        });
        toast.success("Cost Center updated");
      } else {
        await addCostCenter({
          code: formData.code,
          name: formData.name,
          parentId: formData.parentId || undefined,
          description: formData.description,
          responsiblePerson: formData.responsiblePerson,
          isActive: formData.isActive,
          level: formData.parentId ? CostCenterLevel.SECONDARY : CostCenterLevel.PRIMARY,
        });
        toast.success("Cost Center created");
      }
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save Cost Center");
    }
  };

  const renderTree = (parentId?: string, depth = 0) => {
    const nodes = costCenters.filter((c) => c.parentId === parentId);
    if (nodes.length === 0) return null;

    return (
      <ul
        className={`flex flex-col gap-1 ${depth > 0 ? "ml-4 pl-4 border-l border-gray-200 mt-1" : ""}`}
      >
        {nodes.map((node) => {
          const hasChildren = costCenters.some((c) => c.parentId === node.id);
          const isExpanded = expandedNodes.has(node.id);
          const isSelected = selectedCenterId === node.id;
          const balance = costCenterBalances[node.id] || 0;

          return (
            <li key={node.id}>
              <div
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer group transition-colors border ${
                  isSelected
                    ? "bg-blue-50 border-[#1557b0]/30 border-l-[3px] border-l-[#1557b0]"
                    : "hover:bg-gray-50 border-transparent hover:border-gray-200"
                }`}
                onClick={() => setSelectedCenterId(node.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-5 h-5 flex items-center justify-center shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNode(node.id);
                    }}
                  >
                    {hasChildren ? (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )
                    ) : (
                      <span className="w-4 h-4 inline-block" />
                    )}
                  </div>
                  <div
                    className={`p-1.5 rounded-md shrink-0 ${
                      !node.parentId ? "bg-blue-100 text-[#1557b0]" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {!node.parentId ? (
                      <Building2 className="w-3.5 h-3.5" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-gray-800 flex items-center gap-2">
                      <span className="truncate">{node.name}</span>
                      {!node.isActive && (
                        <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-red-100 text-red-700 shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">{node.code}</div>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-gray-600 flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                  <span
                    className={
                      balance > 0 ? "text-[#059669]" : balance < 0 ? "text-red-600" : ""
                    }
                  >
                    Rs. {Math.abs(balance).toLocaleString()}{" "}
                    {balance > 0 ? "Dr" : balance < 0 ? "Cr" : ""}
                  </span>
                </div>
              </div>
              {hasChildren && isExpanded && renderTree(node.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  const selectedCenter = costCenters.find((c) => c.id === selectedCenterId);
  const balance = selectedCenter ? costCenterBalances[selectedCenter.id] || 0 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f6fa] overflow-hidden">
      <div className="p-4 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Cost Centers</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Manage hierarchical cost centers, departments, and branches
            </p>
          </div>
          <button type="button" className={btnPrimary} onClick={handleAddNew}>
            <Plus className="h-3.5 w-3.5" />
            Add cost center
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden px-4 pb-4 min-h-0">
        <div className="w-[55%] min-w-0 bg-white rounded-md border border-gray-200 flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-200 bg-[#f5f6fa] shrink-0">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Cost center hierarchy
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {costCenters.length === 0 ? (
              <ReportEmptyState
                message="No cost centers configured"
                hint='Click "Add cost center" to create your first cost center.'
                icon={<Building2 size={28} strokeWidth={1.5} />}
              />
            ) : (
              renderTree()
            )}
          </div>
          {costCenters.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500 shrink-0">
              {costCenters.length} cost center{costCenters.length === 1 ? "" : "s"}
            </div>
          )}
        </div>

        <div className="w-[45%] min-w-0 bg-white rounded-md border border-gray-200 flex flex-col overflow-hidden">
          {showForm ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
                <span className="text-[13px] font-semibold text-gray-800">
                  {isEditing ? "Edit cost center" : "New cost center"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div>
                    <label className={labelCls}>
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className={`${inputCls} uppercase font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Parent cost center</label>
                    <select
                      value={formData.parentId}
                      onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">None (root level)</option>
                      {costCenters
                        .filter((c) => c.id !== selectedCenterId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] resize-none"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Responsible person</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={formData.responsiblePerson}
                        onChange={(e) =>
                          setFormData({ ...formData, responsiblePerson: e.target.value })
                        }
                        placeholder="e.g. Ram Sharma"
                        className={`${inputCls} pl-8`}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    Active cost center
                  </label>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-gray-200 shrink-0">
                  <button type="button" className={btnOutline} onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={btnPrimary}>
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </button>
                </div>
              </form>
            </>
          ) : selectedCenter ? (
            <div className="flex flex-col h-full overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between shrink-0">
                <div className="min-w-0">
                  <h2 className="text-[13px] font-semibold text-gray-800 truncate">
                    {selectedCenter.name}
                  </h2>
                  <span className="mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-700 font-mono">
                    {selectedCenter.code}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(selectedCenter)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedCenter.id)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#f5f6fa] p-3 rounded-md border border-gray-200">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Status
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        selectedCenter.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {selectedCenter.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="bg-[#f5f6fa] p-3 rounded-md border border-gray-200">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Responsible person
                    </div>
                    <div className="text-[12px] text-gray-700">
                      {selectedCenter.responsiblePerson || "—"}
                    </div>
                  </div>
                </div>

                <div className="bg-[#eef2ff] p-3 rounded-md border border-[#c7d2fe]">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Current net balance
                  </div>
                  <div className="text-[12px] font-mono font-bold text-gray-800">
                    Rs. {Math.abs(balance).toLocaleString()}
                    <span className="text-[11px] font-medium ml-1 text-gray-600">
                      {balance > 0 ? "Dr" : balance < 0 ? "Cr" : ""}
                    </span>
                  </div>
                </div>

                {selectedCenter.description && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Description
                    </h4>
                    <p className="text-[12px] text-gray-700 leading-relaxed bg-[#f5f6fa] p-3 rounded-md border border-gray-200">
                      {selectedCenter.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <ReportEmptyState
                message="Select a cost center"
                hint="Click any node in the tree to view its details."
                icon={<Building2 size={28} strokeWidth={1.5} />}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
