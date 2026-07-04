import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { Plus, Edit2, Trash2, Search, X, Save } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";

const DEFAULT_FORM = {
  name: "",
  alias: "",
  isPrimary: false,
  underGroupId: "",
  stockAccountId: "",
  salesAccountId: "",
  purchaseAccountId: "",
  hsnCode: "",
  taxCategoryId: "",
};

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

export default function ItemGroupMaster() {
  const { itemGroups, taxCategories, accounts, addItemGroup, updateItemGroup, deleteItemGroup } =
    useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const filtered = useMemo(
    () =>
      (itemGroups || []).filter((g: any) =>
        g.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [itemGroups, search],
  );

  const ledgerAccounts = useMemo(
    () => (accounts || []).filter((a: any) => !a.isGroup),
    [accounts],
  );

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setSelected(null);
    setShowForm(false);
  };

  const handleEdit = (g: any) => {
    setSelected(g);
    setForm({
      name: g.name || "",
      alias: g.alias || "",
      isPrimary: g.isPrimary || false,
      underGroupId: g.underGroupId || "",
      stockAccountId: g.stockAccountId || "",
      salesAccountId: g.salesAccountId || "",
      purchaseAccountId: g.purchaseAccountId || "",
      hsnCode: g.hsnCode || "",
      taxCategoryId: g.taxCategoryId || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return alert("Group Name is required.");
    if (selected) {
      await updateItemGroup(selected.id, form);
      alert("Item Group updated.");
    } else {
      await addItemGroup(form);
      alert("Item Group saved.");
    }
    resetForm();
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Delete this item group?")) return;
    await deleteItemGroup(id);
    if (selected?.id === id) resetForm();
  };

  const parentName = (underGroupId: string) => {
    if (!underGroupId) return "—";
    return (itemGroups || []).find((p: any) => p.id === underGroupId)?.name || underGroupId;
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Item Groups</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Group stock items for reporting, defaults, and tax mapping
              </p>
            </div>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add group
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message="No item groups found"
                hint='Click "Add group" to create your first item group.'
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>#</th>
                    <th className={th}>Group name</th>
                    <th className={th}>Alias</th>
                    <th className={th}>Primary</th>
                    <th className={th}>Parent group</th>
                    <th className={th}>HSN code</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g: any, i: number) => (
                    <tr
                      key={g.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => handleEdit(g)}
                    >
                      <td className={td}>{i + 1}</td>
                      <td className={`${td} font-medium text-gray-800`}>{g.name}</td>
                      <td className={td}>{g.alias || "—"}</td>
                      <td className={td}>
                        {g.isPrimary ? (
                          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                            Yes
                          </span>
                        ) : (
                          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-100 text-gray-700">
                            No
                          </span>
                        )}
                      </td>
                      <td className={td}>{parentName(g.underGroupId)}</td>
                      <td className={td}>{g.hsnCode || "—"}</td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(g);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDelete(g.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {filtered.length} group{filtered.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[360px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-[13px] font-semibold text-gray-800">
              {selected ? "Edit item group" : "Add item group"}
            </span>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700"
              onClick={resetForm}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {[
              { label: "Group name", key: "name", required: true },
              { label: "Alias", key: "alias" },
              { label: "HSN code", key: "hsnCode" },
            ].map(({ label, key, required }) => (
              <div key={key}>
                <label className={labelCls}>
                  {label}
                  {required ? " *" : ""}
                </label>
                <input
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={inputCls}
                />
              </div>
            ))}

            <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) =>
                  setForm({ ...form, isPrimary: e.target.checked, underGroupId: "" })
                }
                className="rounded border-gray-300"
              />
              Primary group (top-level)
            </label>

            {!form.isPrimary && (
              <div>
                <label className={labelCls}>Under group</label>
                <select
                  value={form.underGroupId}
                  onChange={(e) => setForm({ ...form, underGroupId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select parent</option>
                  {(itemGroups || [])
                    .filter((g: any) => g.id !== selected?.id)
                    .map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {[
              { label: "Stock account", key: "stockAccountId" },
              { label: "Sales account", key: "salesAccountId" },
              { label: "Purchase account", key: "purchaseAccountId" },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <select
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={inputCls}
                >
                  <option value="">None</option>
                  {ledgerAccounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div>
              <label className={labelCls}>Tax category</label>
              <select
                value={form.taxCategoryId}
                onChange={(e) => setForm({ ...form, taxCategoryId: e.target.value })}
                className={inputCls}
              >
                <option value="">None</option>
                {(taxCategories || []).map((tc: any) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200">
            <button type="button" className={btnPrimary} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {selected ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
