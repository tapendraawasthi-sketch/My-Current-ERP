/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Input, Modal } from "./ui";
import Pagination from "./ui/Pagination";
import { Search, Plus, Phone, Mail, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { validatePAN } from "../lib/taxUtils";

const PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
];

const PartiesDirectory: React.FC = React.memo(() => {
  const { parties, addParty, updateParty } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [provinceFilter, setProvinceFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any | null>(null);

  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"customer" | "supplier" | "both">("customer");
  const [pan, setPan] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [wardNo, setWardNo] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const filteredData = useMemo(() => {
    return parties.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.pan && p.pan.toLowerCase().includes(searchTerm.toLowerCase()));
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
      if (provinceFilter !== "ALL" && p.province !== provinceFilter) return false;
      return matchesSearch;
    });
  }, [parties, searchTerm, typeFilter, provinceFilter]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [searchTerm, typeFilter, provinceFilter]);

  const resetForm = () => {
    setCode("");
    setName("");
    setType("customer");
    setPan("");
    setPhone("");
    setEmail("");
    setAddress("");
    setProvince("");
    setDistrict("");
    setMunicipality("");
    setWardNo("");
    setOpeningBalance(0);
    setIsActive(true);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (party: any) => {
    setSelectedParty(party);
    setCode(party.code || "");
    setName(party.name || "");
    setType(party.type || "customer");
    setPan(party.pan || "");
    setPhone(party.phone || "");
    setEmail(party.email || "");
    setAddress(party.address || "");
    setProvince(party.province || "");
    setDistrict(party.district || "");
    setMunicipality(party.city || "");
    setWardNo(party.wardNo || "");
    setOpeningBalance(party.openingBalance || 0);
    setIsActive(party.isActive !== false);
    setShowEditModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Party name is required");
      return;
    }
    if (pan && !validatePAN(pan)) {
      toast.error("Invalid PAN format. Must be 9 digits.");
      return;
    }
    if (phone && !/^(97|98)\d{8}$/.test(phone)) {
      toast.error("Invalid mobile format. Must start with 97 or 98 and be 10 digits.");
      return;
    }
    try {
      const payload = {
        code: code.trim() || undefined,
        name: name.trim(),
        type,
        pan: pan.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        province: province || undefined,
        district: district.trim() || undefined,
        city: municipality.trim() || undefined,
        wardNo: wardNo.trim() || undefined,
        openingBalance: Number(openingBalance) || 0,
        isActive,
      };

      if (showAddModal) {
        await addParty(payload);
        toast.success("Party added successfully");
        setShowAddModal(false);
      } else if (showEditModal && selectedParty) {
        await updateParty(selectedParty.id, payload);
        toast.success("Party updated successfully");
        setShowEditModal(false);
      }
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save party");
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Parties Directory</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage customers and suppliers accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add Party
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search parties..."
              className="search-input"
            />
          </div>
          <div className="flex items-center gap-1 ml-2">
            {["ALL", "customer", "supplier", "both"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTypeFilter(t);
                  setPage(1);
                }}
                className={`h-7 px-3 text-[11px] font-semibold rounded transition-colors ${
                  typeFilter === t ? "bg-[#1557b0] text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {t === "ALL" ? "All Parties" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="ml-4">
            <select
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="h-7 px-2 text-[11px] border border-gray-300 rounded focus:outline-none"
            >
              <option value="ALL">All Provinces</option>
              {PROVINCES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div
        className="flex items-center gap-4 px-4 py-2 bg-blue-50 border-b text-[11px] font-semibold"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-gray-600">{filteredData.length} parties</span>
        <span className="text-green-700">
          {filteredData.filter((p) => p.type === "customer").length} Customers
        </span>
        <span className="text-blue-700">
          {filteredData.filter((p) => p.type === "supplier").length} Suppliers
        </span>
      </div>

      {/* Table Container */}
      <Card border padding="none">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>PAN/VAT</th>
                <th>Province</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No parties found matching the search criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((party) => (
                  <tr
                    key={party.id}
                    onClick={() => handleOpenEdit(party)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="font-mono">{party.code || "-"}</td>
                    <td className="font-semibold text-gray-800">{party.name}</td>
                    <td>
                      <span className={`badge badge-${party.type}`}>{party.type}</span>
                    </td>
                    <td className="font-mono">{party.pan || "-"}</td>
                    <td>{party.province || "-"}</td>
                    <td>{party.phone || "-"}</td>
                    <td>{party.address || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          party.isActive !== false
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-105 text-gray-700"
                        }`}
                      >
                        {party.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalRecords={filteredData.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </Card>

      {/* ADD/EDIT MODALS */}
      {(showAddModal || showEditModal) && (
        <Modal
          isOpen={showAddModal || showEditModal}
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
          }}
          title={showAddModal ? "Add New Party" : "Edit Party Details"}
          size="md"
        >
          <form onSubmit={handleSave} className="flex flex-col gap-4 text-xs font-semibold select-none">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-gray-700 font-semibold">Party Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. C-101"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-700 font-semibold">Party Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="both">Both (Customer & Supplier)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-gray-700 font-semibold">Party Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
                required
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-gray-700 font-semibold">PAN / VAT Number</label>
                <input
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  placeholder="9-digit PAN"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-700 font-semibold">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 98XXXXXXXX"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-gray-700 font-semibold">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. info@party.com"
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-gray-700 font-semibold">Province</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="">Select Province</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-700 font-semibold">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Kathmandu"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-gray-700 font-semibold">Municipality / VDC</label>
                <input
                  type="text"
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  placeholder="e.g. KMC"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-gray-700 font-semibold">Ward No.</label>
                <input
                  type="text"
                  value={wardNo}
                  onChange={(e) => setWardNo(e.target.value)}
                  placeholder="e.g. 1"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-gray-700 font-semibold">Street / Local Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address details"
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-gray-700 font-semibold">Opening Balance (Rs.)</label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>

              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  id="isActiveParty"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActiveParty" className="text-slate-700 cursor-pointer">
                  Is Active Party
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Save Party
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
});

export default PartiesDirectory;
