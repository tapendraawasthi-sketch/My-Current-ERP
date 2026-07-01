// src/pages/BudgetMasterAdvanced.tsx
// Administration → Masters → Budget
// BUSY-style budget configuration with period-wise amount entry

import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Plus, Trash2, Save, X, Edit2 } from "lucide-react";

interface BudgetEntry {
  id: string;
  name: string;
  fiscalYearId: string;
  type: "account" | "group";
  accountId?: string;
  groupName?: string;
  period: "monthly" | "quarterly" | "yearly";
  amounts: Record<string, number>;
  isActive: boolean;
  createdAt: string;
}

const NEPALI_MONTHS = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

const inputCls = "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const BudgetMasterAdvanced: React.FC = () => {
  const { accounts, currentFiscalYear } = useStore() as any;
  const [budgets, setBudgets] = useState<BudgetEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("sutra_budgets_adv") || "[]"); } catch { return []; }
  });
  const [mode, setMode] = useState<"list" | "add" | "modify">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", type: "account" as "account" | "group",
    accountId: "", groupName: "",
    period: "monthly" as "monthly" | "quarterly" | "yearly",
    amounts: {} as Record<string, number>,
    isActive: true,
  });

  function save(data: BudgetEntry[]) {
    localStorage.setItem("sutra_budgets_adv", JSON.stringify(data));
  }

  function openAdd() {
    setForm({ name: "", type: "account", accountId: "", groupName: "", period: "monthly", amounts: {}, isActive: true });
    setEditingId(null);
    setMode("add");
  }

  function openModify(b: BudgetEntry) {
    setForm({ name: b.name, type: b.type, accountId: b.accountId || "", groupName: b.groupName || "", period: b.period, amounts: { ...b.amounts }, isActive: b.isActive });
    setEditingId(b.id);
    setMode("modify");
  }

  function handleSave() {
    if (!form.name.trim()) { toast.error("Budget name is required"); return; }
    if (form.type === "account" && !form.accountId) { toast.error("Select an account"); return; }
    const budget: BudgetEntry = {
      id: editingId || `bud-${Date.now()}`,
      name: form.name.trim(), type: form.type,
      accountId: form.type === "account" ? form.accountId : undefined,
      groupName: form.type === "group" ? form.groupName : undefined,
      fiscalYearId: currentFiscalYear?.id || "",
      period: form.period, amounts: form.amounts,
      isActive: form.isActive, createdAt: new Date().toISOString(),
    };
    const updated = editingId ? budgets.map(b => b.id === editingId ? budget : b) : [...budgets, budget];
    setBudgets(updated); save(updated);
    toast.success(`Budget "${budget.name}" ${editingId ? "updated" : "created"}.`);
    setMode("list");
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this budget?")) return;
    const updated = budgets.filter(b => b.id !== id);
    setBudgets(updated); save(updated);
    toast.success("Budget deleted.");
  }

  // Period keys
  const periodKeys = useMemo(() => {
    if (form.period === "monthly") return NEPALI_MONTHS;
    if (form.period === "quarterly") return ["Q1 (Baisakh-Ashadh)", "Q2 (Shrawan-Ashwin)", "Q3 (Kartik-Poush)", "Q4 (Magh-Chaitra)"];
    return ["Annual Total"];
  }, [form.period]);

  const totalBudget = useMemo(() => Object.values(form.amounts).reduce((s, v) => s + (v || 0), 0), [form.amounts]);

  const ledgerAccounts = useMemo(() => (accounts || []).filter((a: any) => !a.isGroup), [accounts]);

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Budget Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Administration → Masters → Budget — Configure budget vs actual tracking</p>
        </div>
        {mode !== "list" && <button onClick={() => setMode("list")} className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] rounded hover:bg-gray-50">← Back</button>}
      </div>

      {mode === "list" && (
        <div className="flex flex-col h-full">
          <div className="flex px-4 py-2 bg-[#f5f6fa] border-b border-gray-200">
            <button onClick={openAdd} className="h-7 px-3 bg-[#1557b0] text-white text-[11px] font-medium rounded flex items-center gap-1.5 hover:bg-[#0f4a96]">
              <Plus className="h-3.5 w-3.5" /> Add Budget
            </button>
          </div>
          <div className="grid grid-cols-[1fr_160px_100px_100px_80px] px-4 py-1.5 bg-[#c9deb5] border-b border-gray-200 text-[10px] font-bold text-gray-700 uppercase tracking-wide">
            <span>Budget Name</span><span>Account / Group</span><span>Period</span><span>Total Budget</span><span>Actions</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {budgets.length === 0 ? (
              <div className="text-center py-12 text-[12px] text-gray-500">No budgets configured. Click "Add Budget" to start.</div>
            ) : budgets.map(b => {
              const account = ledgerAccounts.find((a: any) => a.id === b.accountId);
              const total = Object.values(b.amounts).reduce((s: number, v: any) => s + (v || 0), 0);
              return (
                <div key={b.id} className="grid grid-cols-[1fr_160px_100px_100px_80px] items-center px-4 py-1.5 border-b border-gray-100 hover:bg-[#f0f5ff] group text-[12px]">
                  <span className="font-medium text-gray-800">{b.name}</span>
                  <span className="text-gray-600 text-[11px]">{account?.name || b.groupName || "—"}</span>
                  <span className="text-gray-600 text-[11px] capitalize">{b.period}</span>
                  <span className="font-mono text-[11px] text-gray-800">Rs. {total.toLocaleString("en-IN")}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => openModify(b)} className="p-1 rounded text-gray-500 hover:text-[#1557b0]"><Edit2 className="h-3 w-3" /></button>
                    <button onClick={() => handleDelete(b.id)} className="p-1 rounded text-gray-500 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(mode === "add" || mode === "modify") && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-[14px] font-bold text-gray-800 mb-4">{mode === "modify" ? "Modify Budget" : "Add Budget"}</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>Budget Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="e.g. Sales Budget FY 2081-82, Admin Expense Budget" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Budget For</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} className={inputCls}>
                    <option value="account">Specific Account (Ledger)</option>
                    <option value="group">Account Group</option>
                  </select>
                </div>
                {form.type === "account" ? (
                  <div>
                    <label className={labelCls}>Account <span className="text-red-500">*</span></label>
                    <select value={form.accountId} onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))} className={inputCls}>
                      <option value="">— Select Account —</option>
                      {ledgerAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Group Name</label>
                    <input value={form.groupName} onChange={e => setForm(p => ({ ...p, groupName: e.target.value }))} className={inputCls} placeholder="e.g. Direct Expenses, Indirect Expenses" />
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Budget Period</label>
                <div className="flex gap-2">
                  {(["monthly", "quarterly", "yearly"] as const).map(p => (
                    <button key={p} onClick={() => setForm(prev => ({ ...prev, period: p, amounts: {} }))}
                      className={`flex-1 h-8 text-[11px] font-semibold rounded border capitalize transition-colors ${form.period === p ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount entry grid */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-700">Budget Amounts</span>
                  <span className="text-[11px] font-mono font-semibold text-[#1557b0]">
                    Total: Rs. {totalBudget.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  {periodKeys.map(period => (
                    <div key={period}>
                      <label className="text-[10px] font-medium text-gray-600 block mb-0.5">{period}</label>
                      <input type="number" min={0} step={0.01}
                        value={form.amounts[period] || ""}
                        onChange={e => setForm(p => ({ ...p, amounts: { ...p.amounts, [period]: Number(e.target.value) || 0 } }))}
                        className="w-full h-7 px-2 text-[11px] text-right border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0]"
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button onClick={() => setMode("list")} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded hover:bg-gray-50 flex items-center gap-1.5">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button onClick={handleSave} className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded hover:bg-[#0f4a96] flex items-center gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save (F2)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetMasterAdvanced;
