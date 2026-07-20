// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "@/lib/appToast";
import { Plus, X, Save, Search } from "lucide-react";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const btnDanger =
  "h-8 px-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const textareaCls =
  "w-full px-2.5 py-2 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";
const sectionTitle = "text-[11px] font-medium text-gray-500";

const NEPAL_PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
];

const BRANCH_TYPES = [
  "Head Office",
  "Regional Branch",
  "Sales Outlet",
  "Godown",
  "Manufacturing Unit",
];

const BRANCH_PAGE_IDS = ["branches", "branch-master"];

const emptyForm = () => ({
  code: "",
  name: "",
  nameNepali: "",
  type: "Regional Branch",
  province: "Bagmati",
  district: "",
  city: "",
  wardNo: "",
  address: "",
  postalCode: "",
  phone: "",
  mobile: "",
  email: "",
  manager: "",
  warehouseId: "",
  costCenterId: "",
  openingDate: new Date().toISOString().split("T")[0],
  isActive: true,
  notes: "",
});

export default function BranchMaster() {
  const { warehouses, costCenters, vouchers, invoices, employees } = useStore();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const pageId = route.pageId === "branches" ? "branches" : "branch-master";

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [defaultBranchId, setDefaultBranchId] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("erp_default_branch") : null,
  );

  const reloadBranches = async () => {
    const db = getDB();
    const updatedBranches = await db.branches.toArray();
    setBranches(updatedBranches);
    useStore.setState({ branches: updatedBranches });
    window.dispatchEvent(new Event("orbix-branch-changed"));
  };

  useEffect(() => {
    getDB()
      .branches.toArray()
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredBranches = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return branches.filter((branch) => {
      if (!q) return true;
      return (
        branch.code?.toLowerCase().includes(q) ||
        branch.name?.toLowerCase().includes(q) ||
        branch.district?.toLowerCase().includes(q) ||
        branch.city?.toLowerCase().includes(q)
      );
    });
  }, [branches, searchTerm]);

  const applyBranchToForm = (branch) => {
    setForm({
      code: branch.code,
      name: branch.name,
      nameNepali: branch.nameNepali || "",
      type: branch.type || "Regional Branch",
      province: branch.province || "Bagmati",
      district: branch.district || "",
      city: branch.city || "",
      wardNo: branch.wardNo || "",
      address: branch.address || "",
      postalCode: branch.postalCode || "",
      phone: branch.phone || "",
      mobile: branch.mobile || "",
      email: branch.email || "",
      manager: branch.manager || "",
      warehouseId: branch.warehouseId || "",
      costCenterId: branch.costCenterId || "",
      openingDate: branch.openingDate || new Date().toISOString().split("T")[0],
      isActive: branch.isActive !== undefined ? branch.isActive : true,
      notes: branch.notes || "",
    });
    setEditingId(branch.id);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    clearEntity(pageId);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
    openEntity(pageId, "new");
  };

  const handleOpenEdit = (branch) => {
    applyBranchToForm(branch);
    setShowForm(true);
    openEntity(pageId, branch.id);
  };

  // Deep link: /app/branches/:id | /app/branch-master/new
  useEffect(() => {
    if (!BRANCH_PAGE_IDS.includes(route.pageId)) return;
    if (route.entityId === "new") {
      setEditingId(null);
      setForm(emptyForm());
      setShowForm(true);
      return;
    }
    if (route.entityId) {
      const branch = branches.find((b) => b.id === route.entityId);
      if (branch) {
        applyBranchToForm(branch);
        setShowForm(true);
      }
      return;
    }
    if (showForm) setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, branches]);

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast.error("Branch Code is required");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Branch Name is required");
      return;
    }
    const existing = branches.find(
      (b) => b.code.toUpperCase() === form.code.toUpperCase() && b.id !== editingId,
    );
    if (existing) {
      toast.error("Branch code already exists");
      return;
    }

    const db = getDB();
    const branchData = {
      ...form,
      code: form.code.toUpperCase(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingId) {
        await db.branches.update(editingId, branchData);
        toast.success("Branch updated successfully");
      } else {
        await db.branches.put({
          id: generateId(),
          ...branchData,
          createdAt: new Date().toISOString(),
        });
        toast.success("Branch created successfully");
      }

      await reloadBranches();
      resetForm();
    } catch (error) {
      console.error("Error saving branch:", error);
      toast.error("Failed to save branch");
    }
  };

  const handleDelete = async (branchOrId) => {
    const id = typeof branchOrId === "string" ? branchOrId : branchOrId?.id || editingId;
    if (!id) return;

    const snapshot = branches.find((b) => b.id === id) || branchOrId;
    if (!snapshot?.id) return;

    try {
      const db = getDB();
      await db.branches.delete(id);
      await reloadBranches();
      toast.undo(`"${snapshot.name}" deleted`, async () => {
        try {
          await getDB().branches.put(snapshot);
          await reloadBranches();
        } catch (err) {
          toast.error("Failed to restore branch.");
        }
      });
      resetForm();
    } catch (error) {
      console.error("Error deleting branch:", error);
      toast.error("Failed to delete branch");
    }
  };

  const handleSetAsDefault = (branchId) => {
    localStorage.setItem("erp_default_branch", branchId);
    setDefaultBranchId(branchId);
    window.dispatchEvent(new Event("orbix-branch-changed"));
    toast.success("Default branch set successfully");
  };

  const getBranchStats = (branchId) => {
    const branchVouchers = vouchers.filter((v) => v.branchId === branchId);
    const branchInvoices = invoices.filter((i) => i.branchId === branchId);
    const branchEmployees = employees.filter((e) => e.branchId === branchId);

    return {
      totalVouchers: branchVouchers.length,
      totalSales: branchInvoices.reduce(
        (sum, inv) => sum + (inv.type === "sales-invoice" ? inv.grandTotal : 0),
        0,
      ),
      totalPurchase: branchInvoices.reduce(
        (sum, inv) => sum + (inv.type === "purchase-invoice" ? inv.grandTotal : 0),
        0,
      ),
      activeEmployees: branchEmployees.filter((e) => e.isActive).length,
      linkedWarehouses: warehouses.filter((w) => w.branchId === branchId),
    };
  };

  const columns = useMemo(
    () => [
      {
        id: "code",
        header: "Code",
        cell: (branch) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">{branch.code || "—"}</span>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: (branch) => (
          <div>
            <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{branch.name}</span>
            {branch.nameNepali ? (
              <span className="block text-[11px] text-[var(--ds-text-muted)]">{branch.nameNepali}</span>
            ) : null}
            {branch.id === defaultBranchId ? (
              <span className="mt-0.5 inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                Default
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        cell: (branch) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{branch.type || "—"}</span>
        ),
      },
      {
        id: "location",
        header: "Location",
        cell: (branch) => (
          <span className="text-[12px] text-[var(--ds-text-muted)]">
            {[branch.district, branch.city, branch.province].filter(Boolean).join(", ") || "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (branch) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              branch.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {branch.isActive !== false ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [defaultBranchId],
  );

  const editingStats = editingId ? getBranchStats(editingId) : null;

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Branch Master"
            description="Manage company branches, locations, and default branch settings"
            meta={
              <PageMeta>
                {filteredBranches.length} of {branches.length} branches
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenCreate}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                New branch
              </Button>
            }
          />

          <div className="relative max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <EnterpriseDataTable
            columns={columns}
            rows={filteredBranches}
            getRowId={(branch) => branch.id}
            loading={loading}
            emptyTitle={searchTerm ? "No branches match your search" : "No branches found"}
            emptyDescription={
              searchTerm
                ? "Try a different search term."
                : 'Click "New branch" to create your first branch.'
            }
            emptyAction={
              !searchTerm ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleOpenCreate}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  New branch
                </Button>
              ) : undefined
            }
            onRowClick={handleOpenEdit}
            rowActions={(branch) => [
              { label: "Edit", onSelect: () => handleOpenEdit(branch) },
              ...(branch.id !== defaultBranchId
                ? [{ label: "Set as default", onSelect: () => handleSetAsDefault(branch.id) }]
                : []),
              { label: "Delete", destructive: true, onSelect: () => handleDelete(branch) },
            ]}
            caption="Branches"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[min(640px,100%)] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-700">
              {editingId ? "Edit branch" : "New branch"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className={sectionTitle}>Basic details</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Branch code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => handleInputChange("code", e.target.value.toUpperCase())}
                    maxLength={10}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Branch name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Branch name (Nepali)</label>
                  <input
                    type="text"
                    value={form.nameNepali}
                    onChange={(e) => handleInputChange("nameNepali", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Branch type</label>
                  <select
                    value={form.type}
                    onChange={(e) => handleInputChange("type", e.target.value)}
                    className={inputCls}
                  >
                    {BRANCH_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <p className={sectionTitle}>Address</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Province</label>
                  <select
                    value={form.province}
                    onChange={(e) => handleInputChange("province", e.target.value)}
                    className={inputCls}
                  >
                    {NEPAL_PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>District</label>
                  <input
                    type="text"
                    value={form.district}
                    onChange={(e) => handleInputChange("district", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>City / municipality</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Ward no.</label>
                  <input
                    type="text"
                    value={form.wardNo}
                    onChange={(e) => handleInputChange("wardNo", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Full address</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    rows={2}
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Postal code</label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => handleInputChange("postalCode", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className={sectionTitle}>Contact</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Mobile</label>
                  <input
                    type="text"
                    value={form.mobile}
                    onChange={(e) => handleInputChange("mobile", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="text"
                    value={form.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Branch manager</label>
                  <input
                    type="text"
                    value={form.manager}
                    onChange={(e) => handleInputChange("manager", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className={sectionTitle}>Links & settings</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Linked warehouse</label>
                  <select
                    value={form.warehouseId}
                    onChange={(e) => handleInputChange("warehouseId", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.code} - {wh.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Default cost center</label>
                  <select
                    value={form.costCenterId}
                    onChange={(e) => handleInputChange("costCenterId", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select cost center</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.code} - {cc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Opening date</label>
                  <input
                    type="date"
                    value={form.openingDate}
                    onChange={(e) => handleInputChange("openingDate", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 self-end">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => handleInputChange("isActive", e.target.checked)}
                    className="rounded border-[var(--ds-border-default)] text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                  />
                  <span className="text-[12px] font-medium text-gray-700">Active</span>
                </label>
                <div className="col-span-2">
                  <label className={labelCls}>Notes / description</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={2}
                    className={textareaCls}
                  />
                </div>
              </div>
            </div>

            {editingId && editingStats && (
              <div>
                <p className={sectionTitle}>Branch statistics</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[11px] text-gray-500 mb-1">Total vouchers</div>
                    <div className="text-[15px] font-semibold text-gray-800">{editingStats.totalVouchers}</div>
                  </div>
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[11px] text-gray-500 mb-1">Total sales</div>
                    <div className="font-mono text-[15px] font-semibold text-gray-800 text-right">
                      {editingStats.totalSales.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[11px] text-gray-500 mb-1">Total purchase</div>
                    <div className="font-mono text-[15px] font-semibold text-gray-800 text-right">
                      {editingStats.totalPurchase.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[11px] text-gray-500 mb-1">Active employees</div>
                    <div className="text-[15px] font-semibold text-gray-800">{editingStats.activeEmployees}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-[11px] font-medium text-gray-600 mb-1">Linked warehouses</div>
                  <div className="flex flex-wrap gap-2">
                    {editingStats.linkedWarehouses.length > 0 ? (
                      editingStats.linkedWarehouses.map((wh) => (
                        <span
                          key={wh.id}
                          className="rounded px-2 py-0.5 text-[11px] bg-gray-100 text-gray-700 border border-gray-200"
                        >
                          {wh.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-gray-500">No warehouses linked to this branch</span>
                    )}
                  </div>
                </div>

                {editingId !== defaultBranchId && (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="h-8 px-3 bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-medium rounded-md"
                      onClick={() => handleSetAsDefault(editingId)}
                    >
                      Set as default
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
            <button type="button" className={btnPrimary} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {editingId ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
            {editingId && (
              <button type="button" className={btnDanger} onClick={() => handleDelete(editingId)}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
