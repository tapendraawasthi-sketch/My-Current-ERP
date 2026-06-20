import React, { useState } from "react";
import { ActionToolbar } from "../components/ui";
import { Plus, Edit2, Trash2, Ruler } from "lucide-react";

interface Unit {
  id: string;
  code: string;
  symbol: string;
  name: string;
  isActive: boolean;
}

export default function Units() {
  const [units, setUnits] = useState<Unit[]>([
    { id: "1", code: "PCS", symbol: "Pcs", name: "Pieces", isActive: true },
    { id: "2", code: "KG", symbol: "Kg", name: "Kilogram", isActive: true },
    { id: "3", code: "G", symbol: "g", name: "Gram", isActive: true },
    { id: "4", code: "L", symbol: "L", name: "Liter", isActive: true },
    { id: "5", code: "ML", symbol: "mL", name: "Milliliter", isActive: true },
    { id: "6", code: "M", symbol: "m", name: "Meter", isActive: true },
    { id: "7", code: "CM", symbol: "cm", name: "Centimeter", isActive: true },
    { id: "8", code: "FT", symbol: "ft", name: "Feet", isActive: true },
    { id: "9", code: "IN", symbol: "in", name: "Inch", isActive: true },
    { id: "10", code: "BOX", symbol: "Box", name: "Box", isActive: true },
    { id: "11", code: "CTN", symbol: "Ctn", name: "Carton", isActive: true },
    { id: "12", code: "DOZ", symbol: "Doz", name: "Dozen", isActive: true },
    { id: "13", code: "SET", symbol: "Set", name: "Set", isActive: true },
    { id: "14", code: "BAG", symbol: "Bag", name: "Bag", isActive: true },
    { id: "15", code: "BTL", symbol: "Btl", name: "Bottle", isActive: true },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    code: "",
    symbol: "",
    name: "",
    isActive: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedUnit) {
      setUnits(units.map((u) => (u.id === selectedUnit.id ? { ...u, ...formData } : u)));
      alert("Unit updated successfully");
    } else {
      setUnits([
        ...units,
        {
          id: Date.now().toString(),
          ...formData,
        },
      ]);
      alert("Unit added successfully");
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      code: "",
      symbol: "",
      name: "",
      isActive: true,
    });
    setSelectedUnit(null);
    setShowForm(false);
  };

  const handleEdit = (unit: Unit) => {
    setSelectedUnit(unit);
    setFormData({
      code: unit.code,
      symbol: unit.symbol,
      name: unit.name,
      isActive: unit.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this unit?")) {
      setUnits(units.filter((u) => u.id !== id));
      alert("Unit deleted successfully");
    }
  };

  const filteredUnits = units.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.symbol.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <ActionToolbar title="Units of Measure" subtitle="Quantity units for items" />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Units of Measurement</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Unit</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search units..."
          className="input"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUnits.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <Ruler className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No units found</p>
                </td>
              </tr>
            ) : (
              filteredUnits.map((unit) => (
                <tr key={unit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{unit.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{unit.symbol}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{unit.name}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        unit.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {unit.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(unit)}
                        className="text-[#1557b0] hover:text-indigo-900"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(unit.id)}
                        className="text-red-600 hover:text-red-900"
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
              {selectedUnit ? "Edit Unit" : "Add Unit"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="input"
                  required
                  placeholder="KG"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symbol *</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  className="input"
                  required
                  placeholder="Kg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                  placeholder="Kilogram"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label className="text-sm font-medium text-gray-700">Is Active</label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {selectedUnit ? "Update" : "Add"} Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
