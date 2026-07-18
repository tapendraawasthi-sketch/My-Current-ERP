import React, { useMemo, useState } from "react";
import toast from "@/lib/appToast";
import { useStore } from "../store/useStore";
import type { DBWarehouse } from "../lib/db";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const emptyForm = {
  code: "",
  name: "",
  address: "",
  isDefault: false,
  isActive: true,
  branchId: "",
  branchName: "",
  branchCompanyCode: "",
  isMainBranch: false,
  allowNegativeStock: false,
  costCenterId: "",
  parentId: "",
  level: "main" as "main" | "sub",
};

const GodownMaster: React.FC = () => {
  const { warehouses, addWarehouse, updateWarehouse, costCenters } = useStore() as any;
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [form, setForm] = useState(() => ({
    ...emptyForm,
    branchId: readActiveBranchId() || "",
  }));
  const [editingId, setEditingId] = useState<string | null>(null);

  const visibleWarehouses = useMemo(
    () => (warehouses || []).filter((w: DBWarehouse) => matchBranch(w.branchId)),
    [warehouses, matchBranch, branchFilter],
  );

  const mainGodowns = useMemo(
    () => visibleWarehouses.filter((w: DBWarehouse) => !w.parentId),
    [visibleWarehouses],
  );

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Godown code and name are required.");
      return;
    }

    const activeBranch = readActiveBranchId();
    const branchMeta = branchOptions.find((b) => b.id === (form.branchId || activeBranch));
    const payload = {
      ...form,
      branchId: form.branchId || activeBranch || undefined,
      branchName: form.branchName || branchMeta?.name || undefined,
      parentId: form.parentId || undefined,
      costCenterId: form.costCenterId || undefined,
      isMainBranch: !!form.isMainBranch,
      allowNegativeStock: !!form.allowNegativeStock,
      isDefault: !!form.isDefault,
      isActive: !!form.isActive,
      level: form.parentId ? "sub" : "main",
    };

    if (editingId) {
      await updateWarehouse(editingId, payload);
      toast.success("Godown updated.");
    } else {
      await addWarehouse(payload);
      toast.success("Godown created.");
    }

    setForm({ ...emptyForm, branchId: readActiveBranchId() || "" });
    setEditingId(null);
  };

  const edit = (warehouse: DBWarehouse) => {
    setEditingId(warehouse.id);
    setForm({
      code: warehouse.code || "",
      name: warehouse.name || "",
      address: warehouse.address || "",
      isDefault: !!warehouse.isDefault,
      isActive: !!warehouse.isActive,
      branchId: warehouse.branchId || "",
      branchName: warehouse.branchName || "",
      branchCompanyCode: warehouse.branchCompanyCode || "",
      isMainBranch: !!warehouse.isMainBranch,
      allowNegativeStock: !!warehouse.allowNegativeStock,
      costCenterId: warehouse.costCenterId || "",
      parentId: warehouse.parentId || "",
      level: warehouse.parentId ? "sub" : "main",
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Godown Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Multi-branch and hierarchical godown setup
          </p>
        </div>
        {branchOptions.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            aria-label="Branch"
          >
            <option value="all">All branches</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.code || b.id}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input
          label="Godown Code"
          value={form.code}
          onChange={(v) => setForm({ ...form, code: v })}
        />
        <Input
          label="Godown Name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
        />
        <Input
          label="Branch Company Code"
          value={form.branchCompanyCode}
          onChange={(v) => setForm({ ...form, branchCompanyCode: v })}
        />

        {branchOptions.length > 0 ? (
          <div>
            <label className="text-[11px] font-medium text-gray-600">Branch</label>
            <select
              value={form.branchId}
              onChange={(e) => {
                const b = branchOptions.find((x) => x.id === e.target.value);
                setForm({
                  ...form,
                  branchId: e.target.value,
                  branchName: b?.name || "",
                });
              }}
              className="mt-1 h-8 px-2.5 text-[12px] border border-gray-300 rounded-md w-full"
            >
              <option value="">Active / none</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Input
            label="Branch ID"
            value={form.branchId}
            onChange={(v) => setForm({ ...form, branchId: v })}
          />
        )}
        <Input
          label="Branch Name"
          value={form.branchName}
          onChange={(v) => setForm({ ...form, branchName: v })}
        />

        <div>
          <label className="text-[11px] font-medium text-gray-600">Parent Godown</label>
          <select
            value={form.parentId}
            onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            className="mt-1 h-8 px-2.5 text-[12px] border border-gray-300 rounded-md w-full"
          >
            <option value="">Main Godown</option>
            {mainGodowns.map((w: DBWarehouse) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Address"
          value={form.address}
          onChange={(v) => setForm({ ...form, address: v })}
        />

        <div>
          <label className="text-[11px] font-medium text-gray-600">Cost Center</label>
          <select
            value={form.costCenterId}
            onChange={(e) => setForm({ ...form, costCenterId: e.target.value })}
            className="mt-1 h-8 px-2.5 text-[12px] border border-gray-300 rounded-md w-full"
          >
            <option value="">Not linked</option>
            {(costCenters || []).map((cc: any) => (
              <option key={cc.id} value={cc.id}>
                {cc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-5 pt-6">
          <Check
            label="Default"
            checked={form.isDefault}
            onChange={(v) => setForm({ ...form, isDefault: v })}
          />
          <Check
            label="Active"
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
          />
          <Check
            label="Main Branch"
            checked={form.isMainBranch}
            onChange={(v) => setForm({ ...form, isMainBranch: v })}
          />
          <Check
            label="Allow Negative"
            checked={form.allowNegativeStock}
            onChange={(v) => setForm({ ...form, allowNegativeStock: v })}
          />
        </div>

        <div className="md:col-span-3 flex justify-end gap-2">
          <button
            onClick={() => {
              setForm({ ...emptyForm, branchId: readActiveBranchId() || "" });
              setEditingId(null);
            }}
            className="h-8 px-3 bg-white border border-gray-300 rounded-md text-[12px]"
          >
            Clear
          </button>
          <button
            onClick={save}
            className="h-8 px-3 bg-[var(--ds-action-primary)] text-white rounded-md text-[12px]"
          >
            {editingId ? "Update Godown" : "Create Godown"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-[#f5f6fa]">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Godown</th>
              <th className="px-3 py-2 text-left">Parent</th>
              <th className="px-3 py-2 text-left">Branch</th>
              <th className="px-3 py-2 text-left">Negative Stock</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleWarehouses.map((w: DBWarehouse) => {
              const parent = (warehouses || []).find((x: DBWarehouse) => x.id === w.parentId);
              return (
                <tr
                  key={w.id}
                  onClick={() => edit(w)}
                  className="border-t cursor-pointer hover:bg-yellow-50"
                >
                  <td className="px-3 py-2 font-mono">{w.code}</td>
                  <td className="px-3 py-2 font-semibold">
                    <span style={{ paddingLeft: w.parentId ? 18 : 0 }}>
                      {w.parentId ? "↳ " : ""}
                      {w.name}
                    </span>
                  </td>
                  <td className="px-3 py-2">{parent?.name || "Main"}</td>
                  <td className="px-3 py-2">{w.branchName || "—"}</td>
                  <td className="px-3 py-2">{w.allowNegativeStock ? "Allowed" : "Denied"}</td>
                  <td className="px-3 py-2">{w.isActive ? "Active" : "Inactive"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Input = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div>
    <label className="text-[11px] font-medium text-gray-600">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 h-8 px-2.5 text-[12px] border border-gray-300 rounded-md w-full"
    />
  </div>
);

const Check = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex items-center gap-1 text-[12px]">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

export default GodownMaster;
