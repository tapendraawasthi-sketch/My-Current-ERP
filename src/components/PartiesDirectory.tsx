// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import Pagination from "./ui/Pagination";
import { Search, Plus, Edit2, X, Save } from "lucide-react";
import toast from "react-hot-toast";
import { validatePAN } from "../lib/taxUtils";
import { ReportEmptyState } from "./ReportEmptyState";

const PROVINCES = ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"];

const th =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const typeBadge = (type: string) => {
  if (type === "customer") return "bg-blue-100 text-blue-700";
  if (type === "supplier") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
};

const PartiesDirectory: React.FC = React.memo(() => {
  const { parties, addParty, updateParty } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [provinceFilter, setProvinceFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [showForm, setShowForm] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any | null>(null);

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
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.pan && p.pan.toLowerCase().includes(q));
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

  const customerCount = useMemo(
    () => filteredData.filter((p) => p.type === "customer" || p.type === "both").length,
    [filteredData],
  );
  const supplierCount = useMemo(
    () => filteredData.filter((p) => p.type === "supplier" || p.type === "both").length,
    [filteredData],
  );

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
    setSelectedParty(null);
    setShowForm(false);
  };

  const handleOpenAdd = () => {
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
    setSelectedParty(null);
    setShowForm(true);
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
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Party name is required");
      return;
    }
    if (pan && !validatePAN(pan)) {
      toast.error("Invalid PAN format. Must be 9 digits.");
      return;
    }
    if (phone && !/^[\d\-]{7,15}$/.test(phone)) {
      toast.error("Invalid phone format. Must be 7-15 digits, can include dashes.");
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

      if (selectedParty) {
        await updateParty(selectedParty.id, payload);
        toast.success("Party updated successfully");
      } else {
        await addParty(payload);
        toast.success("Party added successfully");
      }
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save party");
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Parties Directory</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage customer and supplier accounts
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={handleOpenAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add party
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative max-w-xs flex-1 min-w-[180px]">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search parties..."
                className={`${inputCls} pl-8`}
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-0.5">
              {["ALL", "customer", "supplier", "both"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTypeFilter(t);
                    setPage(1);
                  }}
                  className={`h-7 px-2.5 text-[11px] font-medium rounded transition-colors ${
                    typeFilter === t
                      ? "bg-[#1557b0] text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t === "ALL" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <select
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="ALL">All provinces</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 mb-3 text-[11px] text-gray-500">
            <span>{filteredData.length} parties</span>
            <span className="text-green-700">{customerCount} customers</span>
            <span>{supplierCount} suppliers</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          {filteredData.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={
                  searchTerm || typeFilter !== "ALL" || provinceFilter !== "ALL"
                    ? "No parties match your filters"
                    : "No parties found"
                }
                hint={
                  searchTerm || typeFilter !== "ALL" || provinceFilter !== "ALL"
                    ? "Try adjusting search or filters."
                    : 'Click "Add party" to create your first party record.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className={th}>Code</th>
                      <th className={th}>Name</th>
                      <th className={th}>Type</th>
                      <th className={th}>PAN/VAT</th>
                      <th className={th}>Province</th>
                      <th className={th}>Phone</th>
                      <th className={th}>Address</th>
                      <th className={`${th} text-center`}>Status</th>
                      <th className={`${th} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((party) => (
                      <tr
                        key={party.id}
                        className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                        onClick={() => handleOpenEdit(party)}
                      >
                        <td className={`${td} font-mono text-gray-600`}>{party.code || "—"}</td>
                        <td className={`${td} font-medium text-gray-800`}>{party.name}</td>
                        <td className={td}>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${typeBadge(party.type)}`}
                          >
                            {party.type}
                          </span>
                        </td>
                        <td className={`${td} font-mono`}>{party.pan || "—"}</td>
                        <td className={`${td} text-gray-500`}>{party.province || "—"}</td>
                        <td className={td}>{party.phone || "—"}</td>
                        <td className={`${td} text-gray-500 max-w-[160px] truncate`}>
                          {party.address || "—"}
                        </td>
                        <td className={`${td} text-center`}>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              party.isActive !== false
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {party.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className={`${td} text-right`}>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(party);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
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
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[min(560px,100%)] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-800">
              {selectedParty ? "Edit party" : "Add party"}
            </span>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700"
              onClick={resetForm}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Party code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. C-101"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Party type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="both">Both (customer & supplier)</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Party name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>PAN / VAT number</label>
                <input
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  placeholder="9-digit PAN"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Phone number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 98XXXXXXXX"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. info@party.com"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Province</label>
                <select value={province} onChange={(e) => setProvince(e.target.value)} className={inputCls}>
                  <option value="">Select province</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Kathmandu"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Municipality / VDC</label>
                <input
                  type="text"
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  placeholder="e.g. KMC"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Ward no.</label>
                <input
                  type="text"
                  value={wardNo}
                  onChange={(e) => setWardNo(e.target.value)}
                  placeholder="e.g. 1"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Street / local address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address details"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className={labelCls}>Opening balance (Rs.)</label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  Active party
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
            <button type="button" className={btnPrimary} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {selectedParty ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default PartiesDirectory;
