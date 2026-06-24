// @ts-nocheck
import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Building2, MapPin, User, Save, X } from "lucide-react";
import { useStore } from "../store";
import { CostCenterLevel, CostCenter } from "../lib/types";
import { generateId } from "../lib/db";
import toast from "react-hot-toast";

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

  // Calculate balances per cost center
  const costCenterBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    vouchers.filter(v => v.status === "POSTED").forEach(v => {
      v.lines.forEach(l => {
        if (l.costCenterId) {
          balances[l.costCenterId] = (balances[l.costCenterId] || 0) + (l.debit - l.credit);
        }
      });
    });

    // Roll up balances to parents
    const rollup = { ...balances };
    
    const resolveBalance = (id: string): number => {
      const children = costCenters.filter(c => c.parentId === id);
      let sum = balances[id] || 0;
      for (const child of children) {
        sum += resolveBalance(child.id);
      }
      rollup[id] = sum;
      return sum;
    };

    const rootNodes = costCenters.filter(c => !c.parentId);
    rootNodes.forEach(rn => resolveBalance(rn.id));

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
    if (costCenters.some(c => c.parentId === id)) {
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
    const nodes = costCenters.filter(c => c.parentId === parentId);
    if (nodes.length === 0) return null;

    return (
      <ul className={`flex flex-col gap-1 ${depth > 0 ? "ml-4 pl-4 border-l border-[#9DC07A] mt-1" : ""}`}>
        {nodes.map(node => {
          const hasChildren = costCenters.some(c => c.parentId === node.id);
          const isExpanded = expandedNodes.has(node.id);
          const isSelected = selectedCenterId === node.id;
          const balance = costCenterBalances[node.id] || 0;

          return (
            <li key={node.id}>
              <div 
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer group transition-colors ${isSelected ? "bg-[#D4EABD] border border-[#9DC07A]" : "hover:bg-[#EBF5E2] border border-transparent"}`}
                onClick={() => setSelectedCenterId(node.id)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0" onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}>
                    {hasChildren ? (
                      isExpanded ? <ChevronDown className="w-4 h-4 text-[#000000] hover:text-[#000000]" /> : <ChevronRight className="w-4 h-4 text-[#000000] hover:text-[#000000]" />
                    ) : <span className="w-4 h-4 inline-block" />}
                  </div>
                  <div className={`p-1.5 rounded-md ${!node.parentId ? "bg-[#D4EABD] text-[#1557b0]" : "bg-[#EBF5E2] text-[#000000]"}`}>
                    {!node.parentId ? <Building2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-[#000000] flex items-center gap-2">
                      {node.name}
                      {!node.isActive && <span className="px-1.5 py-0.5 text-[9px] bg-red-100 text-red-600 rounded uppercase font-bold">Inactive</span>}
                    </div>
                    <div className="text-[10px] text-[#000000] font-mono">{node.code}</div>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-[#000000] flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className={balance > 0 ? "text-green-600" : balance < 0 ? "text-red-600" : ""}>
                    Rs. {Math.abs(balance).toLocaleString()} {balance > 0 ? "Dr" : balance < 0 ? "Cr" : ""}
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

  const selectedCenter = costCenters.find(c => c.id === selectedCenterId);

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4 h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-[#000000]">Cost Centers</h1>
          <p className="text-[11px] text-[#000000] mt-0.5">Manage hierarchical cost centers, departments, and branches</p>
        </div>
        <button onClick={handleAddNew} className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> Add Cost Center
        </button>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* Left Panel: Tree */}
        <div className="w-[55%] bg-white rounded-lg shadow-sm border border-[#9DC07A] flex flex-col">
          <div className="p-3 border-b border-[#9DC07A] bg-[#f5f6fa] shrink-0">
            <h3 className="text-[11px] font-bold text-[#000000] uppercase tracking-wide">Cost Center Hierarchy</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {costCenters.length === 0 ? (
              <div className="text-center text-[#000000] text-[12px] py-8">No cost centers configured. Click Add Cost Center to begin.</div>
            ) : renderTree()}
          </div>
        </div>

        {/* Right Panel: Details or Form */}
        <div className="w-[45%] bg-white rounded-lg shadow-sm border border-[#9DC07A] flex flex-col overflow-y-auto">
          {showForm ? (
            <div className="p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 border-b border-[#9DC07A] pb-3">
                <h3 className="text-[13px] font-semibold text-[#000000]">{isEditing ? "Edit Cost Center" : "New Cost Center"}</h3>
                <button onClick={() => setShowForm(false)} className="text-[#000000] hover:text-[#000000]"><X className="w-4 h-4" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Name <span className="text-red-500">*</span></label>
                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Code <span className="text-red-500">*</span></label>
                    <input type="text" required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0] uppercase" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Parent Cost Center</label>
                    <select value={formData.parentId} onChange={e => setFormData({...formData, parentId: e.target.value})} className="w-full h-8 px-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0] bg-white">
                      <option value="">-- None (Root Level) --</option>
                      {costCenters.filter(c => c.id !== selectedCenterId).map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Description</label>
                    <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-2 py-1.5 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0] resize-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Responsible Person</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#000000] absolute left-2 top-2" />
                      <input type="text" value={formData.responsiblePerson} onChange={e => setFormData({...formData, responsiblePerson: e.target.value})} placeholder="e.g. Ram Sharma" className="w-full h-8 pl-8 pr-2 text-[12px] border border-[#9DC07A] rounded focus:outline-none focus:border-[#1557b0]" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="rounded border-[#9DC07A] text-[#1557b0] focus:ring-[#1557b0]" />
                    <label htmlFor="isActive" className="text-[12px] text-[#000000] font-medium">Active Cost Center</label>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#9DC07A] flex justify-end gap-2 shrink-0">
                  <button type="button" onClick={() => setShowForm(false)} className="h-8 px-4 bg-white border border-[#9DC07A] text-[#000000] text-[12px] font-medium rounded hover:bg-[#EBF5E2]">Cancel</button>
                  <button type="submit" className="h-8 px-4 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded flex items-center gap-1.5 shadow-sm">
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </form>
            </div>
          ) : selectedCenter ? (
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-[18px] font-bold text-[#000000] mb-1">{selectedCenter.name}</h2>
                  <div className="text-[12px] font-mono text-[#000000] bg-[#EBF5E2] px-2 py-0.5 rounded inline-block">{selectedCenter.code}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(selectedCenter)} className="p-1.5 bg-white border border-[#9DC07A] text-[#000000] hover:text-[#1557b0] hover:border-[#1557b0] rounded shadow-sm transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(selectedCenter.id)} className="p-1.5 bg-white border border-[#9DC07A] text-[#000000] hover:text-red-600 hover:border-red-600 rounded shadow-sm transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#EBF5E2] p-3 rounded border border-[#9DC07A]">
                  <div className="text-[10px] font-bold text-[#000000] uppercase mb-1">Status</div>
                  <div className={`text-[12px] font-medium ${selectedCenter.isActive ? "text-green-600" : "text-red-600"}`}>{selectedCenter.isActive ? "Active" : "Inactive"}</div>
                </div>
                <div className="bg-[#EBF5E2] p-3 rounded border border-[#9DC07A]">
                  <div className="text-[10px] font-bold text-[#000000] uppercase mb-1">Responsible Person</div>
                  <div className="text-[12px] font-medium text-[#000000]">{selectedCenter.responsiblePerson || "Not Assigned"}</div>
                </div>
                <div className="bg-[#D4EABD] p-3 rounded border border-[#9DC07A] col-span-2 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-[#000000] uppercase mb-1">Current Net Balance</div>
                    <div className="text-[16px] font-mono font-bold text-[#000000]">
                      Rs. {Math.abs(costCenterBalances[selectedCenter.id] || 0).toLocaleString()} 
                      <span className="text-[12px] ml-1">{costCenterBalances[selectedCenter.id] > 0 ? "Dr" : costCenterBalances[selectedCenter.id] < 0 ? "Cr" : ""}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedCenter.description && (
                <div className="mb-6">
                  <h4 className="text-[11px] font-bold text-[#000000] uppercase mb-2">Description</h4>
                  <p className="text-[12px] text-[#000000] leading-relaxed bg-[#EBF5E2] p-3 rounded border border-[#9DC07A]">{selectedCenter.description}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#000000] p-8">
              <Building2 className="w-16 h-16 mb-4 text-[#000000]" />
              <p className="text-[14px] font-medium text-[#000000]">Select a Cost Center</p>
              <p className="text-[11px] text-[#000000] mt-1">Click on any node in the tree to view its details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

