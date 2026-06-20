import React, { useState } from "react";
import { ActionToolbar } from "../components/ui";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  DollarSign,
} from "lucide-react";

interface CostCenter {
  id: string;
  name: string;
  code: string;
  type: "Group" | "Center";
  parentId?: string;
  budget?: number;
  children?: CostCenter[];
}

export default function CostCenters() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([
    {
      id: "1",
      name: "Head Office",
      code: "HO",
      type: "Group",
      children: [
        {
          id: "1-1",
          name: "Administration",
          code: "HO-ADM",
          type: "Center",
          parentId: "1",
          budget: 500000,
        },
        {
          id: "1-2",
          name: "IT Department",
          code: "HO-IT",
          type: "Center",
          parentId: "1",
          budget: 300000,
        },
      ],
    },
    {
      id: "2",
      name: "Branch Offices",
      code: "BR",
      type: "Group",
      children: [
        {
          id: "2-1",
          name: "Kathmandu Branch",
          code: "BR-KTM",
          type: "Center",
          parentId: "2",
          budget: 750000,
        },
        {
          id: "2-2",
          name: "Pokhara Branch",
          code: "BR-PKR",
          type: "Center",
          parentId: "2",
          budget: 450000,
        },
      ],
    },
    {
      id: "3",
      name: "Projects",
      code: "PRJ",
      type: "Group",
      children: [
        {
          id: "3-1",
          name: "Project Alpha",
          code: "PRJ-ALPHA",
          type: "Center",
          parentId: "3",
          budget: 1000000,
        },
      ],
    },
  ]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["1", "2", "3"]));
  const [showForm, setShowForm] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<CostCenter | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "Center" as "Group" | "Center",
    parentId: "",
    budget: "",
  });

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCenter: CostCenter = {
      id: Date.now().toString(),
      name: formData.name,
      code: formData.code,
      type: formData.type,
      parentId: formData.parentId || undefined,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
      children: formData.type === "Group" ? [] : undefined,
    };

    if (selectedCenter) {
      // Update logic would go here
      alert("Cost center updated");
    } else {
      setCostCenters([...costCenters, newCenter]);
      alert("Cost center added");
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      type: "Center",
      parentId: "",
      budget: "",
    });
    setSelectedCenter(null);
    setShowForm(false);
  };

  const handleEdit = (center: CostCenter) => {
    setSelectedCenter(center);
    setFormData({
      name: center.name,
      code: center.code,
      type: center.type,
      parentId: center.parentId || "",
      budget: center.budget?.toString() || "",
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this cost center? This action cannot be undone.")) {
      // Delete logic would filter out the center
      alert("Cost center deleted");
    }
  };

  const renderTree = (nodes: CostCenter[], level: number = 0) => {
    return nodes.map((node) => (
      <div key={node.id} className="select-none">
        <div
          className="flex items-center space-x-2 py-2 px-3 hover:bg-gray-50 rounded cursor-pointer"
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          {node.type === "Group" && (
            <button
              onClick={() => toggleNode(node.id)}
              className="text-gray-500 hover:text-gray-700"
            >
              {expandedNodes.has(node.id) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
          {node.type === "Group" ? (
            expandedNodes.has(node.id) ? (
              <FolderOpen className="w-5 h-5 text-yellow-500" />
            ) : (
              <Folder className="w-5 h-5 text-yellow-500" />
            )
          ) : (
            <DollarSign className="w-5 h-5 text-green-500" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">{node.name}</span>
                <span className="text-xs text-gray-500 ml-2">({node.code})</span>
              </div>
              <div className="flex items-center space-x-4">
                {node.budget && (
                  <span className="text-sm text-gray-600">
                    Budget: Rs. {node.budget.toLocaleString()}
                  </span>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(node)}
                    className="text-[#1557b0] hover:text-indigo-900"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(node.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {node.children && expandedNodes.has(node.id) && renderTree(node.children, level + 1)}
      </div>
    ));
  };

  const getAllCenters = (nodes: CostCenter[], result: CostCenter[] = []): CostCenter[] => {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children) {
        getAllCenters(node.children, result);
      }
    });
    return result;
  };

  const totalBudget = getAllCenters(costCenters)
    .filter((c) => c.type === "Center" && c.budget)
    .reduce((sum, c) => sum + (c.budget || 0), 0);

  return (
    <div className="space-y-6">
      <ActionToolbar title="Cost Centers" subtitle="Departmental and project cost tracking" />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cost Centers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Cost Center</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Budget Summary</h2>
          <div className="text-2xl font-bold text-[#1557b0]">
            Rs. {totalBudget.toLocaleString()}
          </div>
        </div>
        <p className="text-sm text-gray-600">Total allocated budget across all cost centers</p>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">
            {selectedCenter ? "Edit Cost Center" : "New Cost Center"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                  placeholder="e.g., Kathmandu Branch"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="input"
                  required
                  placeholder="e.g., BR-KTM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as "Group" | "Center" })
                  }
                  className="input"
                >
                  <option value="Center">Cost Center</option>
                  <option value="Group">Group</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Group</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="input"
                >
                  <option value="">None (Root Level)</option>
                  {getAllCenters(costCenters)
                    .filter((c) => c.type === "Group")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              {formData.type === "Center" && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Budget (Annual)
                  </label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    className="input"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {selectedCenter ? "Update" : "Add"} Cost Center
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Cost Center Hierarchy</h2>
        </div>
        <div className="p-4">{renderTree(costCenters)}</div>
      </div>
    </div>
  );
}
