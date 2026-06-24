import React, { useState } from "react";
import { ActionToolbar } from "../components/ui";
import { Plus, Edit2, Trash2, Package } from "lucide-react";

interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([
    {
      id: "1",
      code: "WH-MAIN",
      name: "Main Warehouse",
      address: "Kathmandu, Nepal",
      isDefault: true,
      isActive: true,
    },
    {
      id: "2",
      code: "WH-BKT",
      name: "Bhaktapur Branch",
      address: "Bhaktapur, Nepal",
      isDefault: false,
      isActive: true,
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    address: "",
    isDefault: false,
    isActive: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.isDefault) {
      setWarehouses(warehouses.map((w) => ({ ...w, isDefault: false })));
    }

    if (selectedWarehouse) {
      setWarehouses(
        warehouses.map((w) => (w.id === selectedWarehouse.id ? { ...w, ...formData } : w)),
      );
      alert("Warehouse updated successfully");
    } else {
      setWarehouses([
        ...warehouses,
        {
          id: Date.now().toString(),
          ...formData,
        },
      ]);
      alert("Warehouse added successfully");
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      address: "",
      isDefault: false,
      isActive: true,
    });
    setSelectedWarehouse(null);
    setShowForm(false);
  };

  const handleEdit = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setFormData({
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address,
      isDefault: warehouse.isDefault,
      isActive: warehouse.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const warehouse = warehouses.find((w) => w.id === id);
    if (warehouse?.isDefault) {
      alert("Cannot delete default warehouse. Set another warehouse as default first.");
      return;
    }

    if (confirm("Are you sure you want to delete this warehouse?")) {
      setWarehouses(warehouses.filter((w) => w.id !== id));
      alert("Warehouse deleted successfully");
    }
  };

  const filteredWarehouses = warehouses.filter(
    (w) =>
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <ActionToolbar title="Warehouses" subtitle="Stock storage locations" />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Warehouses</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Warehouse</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search warehouses..."
          className="input"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#EBF5E2]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                Default
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#000000] uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredWarehouses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[#000000]">
                  <Package className="w-12 h-12 mx-auto mb-4 text-[#000000]" />
                  <p>No warehouses found</p>
                </td>
              </tr>
            ) : (
              filteredWarehouses.map((warehouse) => (
                <tr key={warehouse.id} className="hover:bg-[#EBF5E2]">
                  <td className="px-6 py-4 text-sm font-medium text-[#000000]">{warehouse.code}</td>
                  <td className="px-6 py-4 text-sm text-[#000000]">{warehouse.name}</td>
                  <td className="px-6 py-4 text-sm text-[#000000]">{warehouse.address}</td>
                  <td className="px-6 py-4 text-sm">
                    {warehouse.isDefault ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Default
                      </span>
                    ) : (
                      <span className="text-[#000000]">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        warehouse.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {warehouse.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(warehouse)}
                        className="text-[#1557b0] hover:text-[#000000]"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(warehouse.id)}
                        className="text-red-600 hover:text-red-900"
                        disabled={warehouse.isDefault}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {selectedWarehouse ? "Edit Warehouse" : "Add Warehouse"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#000000] mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="input"
                  required
                  placeholder="WH-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#000000] mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                  placeholder="Main Warehouse"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#000000] mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="Full address"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-[#9DC07A]"
                />
                <label className="text-sm font-medium text-[#000000]">Set as Default</label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-[#9DC07A]"
                />
                <label className="text-sm font-medium text-[#000000]">Is Active</label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-[#9DC07A] rounded-lg hover:bg-[#EBF5E2]"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {selectedWarehouse ? "Update" : "Add"} Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
