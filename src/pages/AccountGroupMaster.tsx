// src/pages/AccountGroupMaster.tsx
// BUSY-style Account Group Master — Add / Modify / Delete / List with full hierarchy

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import {
  Plus, Edit2, Trash2, Search, ChevronRight, ChevronDown,
  FolderOpen, Folder, Copy, Save, X, AlertTriangle, Info
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AccountGroup {
  id: string;
  name: string;
  alias?: string;
  isPrimary: boolean;
  parentGroupId?: string;
  narration?: string;
  isSystem: boolean;
  nature: "debit" | "credit";
  sortOrder?: number;
  children?: AccountGroup[];
  depth?: number;
}

// ── Predefined Primary Groups (BUSY-style) ────────────────────────────────────
const PREDEFINED_GROUPS: Omit<AccountGroup, "children" | "depth">[] = [
  { id: "pg-capital", name: "Capital Account", alias: "Capital", isPrimary: true, isSystem: true, nature: "credit" },
  { id: "pg-reserves", name: "Reserves & Surplus", alias: "Reserves", isPrimary: true, isSystem: true, nature: "credit" },
  { id: "pg-loans-liability", name: "Loans (Liability)", alias: "Loans-L", isPrimary: true, isSystem: true, nature: "credit" },
  { id: "pg-current-liability", name: "Current Liabilities", alias: "Curr-L", isPrimary: true, isSystem: true, nature: "credit" },
  { id: "pg-provisions", name: "Provisions", alias: "Prov", isPrimary: true, isSystem: true, nature: "credit" },
  { id: "pg-fixed-assets", name: "Fixed Assets", alias: "FA", isPrimary: true, isSystem: true, nature: "debit" },
  { id: "pg-current-assets", name: "Current Assets", alias: "Curr-A", isPrimary: true, isSystem: true, nature: "debit" },
  { id: "pg-investments", name: "Investments", alias: "Invest", isPrimary: true, isSystem: true, nature: "debit" },
  { id: "pg-loans-asset", name: "Loans & Advances (Asset)", alias: "Loans-A", isPrimary: true, isSystem: true, nature: "debit" },
  { id: "pg-direct-income", name: "Direct Income", alias: "Dir-Inc", isPrimary: true, isSystem: true, nature: "credit" },
  { id: "pg-indirect-income", name: "Indirect Income", alias: "Indir-Inc", isPrimary: true, isSystem: true, nature: "credit" },
  { id: "pg-direct-expense", name: "Direct Expenses (Mfg.)", alias: "Dir-Exp", isPrimary: true, isSystem: true, nature: "debit" },
  { id: "pg-indirect-expense", name: "Indirect Expenses (Admn.)", alias: "Indir-Exp", isPrimary: true, isSystem: true, nature: "debit" },
  { id: "pg-purchase", name: "Purchase Accounts", alias: "Purchase", isPrimary: true, isSystem: true, nature: "debit" },
  { id: "pg-suspense", name: "Suspense Account", alias: "Suspense", isPrimary: true, isSystem: true, nature: "debit" },
];

// ── Mode type ─────────────────────────────────────────────────────────────────
type Mode = "list" | "add" | "modify";

// ── Helpers ───────────────────────────────────────────────────────────────────
const NATURE_LABEL: Record<string, string> = {
  debit: "Debit (Asset/Expense)",
  credit: "Credit (Liability/Income)",
};

const inputCls = "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

// ── Main Component ────────────────────────────────────────────────────────────
const AccountGroupMaster: React.FC = () => {
  const { accounts, addAccount, updateAccount } = useStore() as any;
  
  // Local group state (loaded from store + predefined)
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [mode, setMode] = useState<Mode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["root"]));
  const [clipboardGroup, setClipboardGroup] = useState<AccountGroup | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    alias: "",
    isPrimary: false,
    parentGroupId: "",
    narration: "",
    nature: "debit" as "debit" | "credit",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  // Initialize with predefined groups + any stored groups
  useEffect(() => {
    const stored = loadGroupsFromStorage();
    const all = mergePredefinedWithStored(PREDEFINED_GROUPS, stored);
    setGroups(all);
    // Expand all primary groups by default
    const ids = new Set<string>(PREDEFINED_GROUPS.map(g => g.id));
    setExpandedIds(ids);
  }, []);

  function loadGroupsFromStorage(): AccountGroup[] {
    try {
      const raw = localStorage.getItem("sutra_account_groups");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveGroupsToStorage(grps: AccountGroup[]) {
    const userGroups = grps.filter(g => !g.isSystem);
    localStorage.setItem("sutra_account_groups", JSON.stringify(userGroups));
  }

  function mergePredefinedWithStored(predefined: typeof PREDEFINED_GROUPS, stored: AccountGroup[]): AccountGroup[] {
    const all: AccountGroup[] = [...predefined as AccountGroup[]];
    for (const g of stored) {
      if (!all.find(a => a.id === g.id)) all.push(g);
    }
    return all;
  }

  // Build tree structure
  const tree = useMemo(() => {
    const map = new Map<string, AccountGroup>();
    groups.forEach(g => map.set(g.id, { ...g, children: [] }));
    const roots: AccountGroup[] = [];
    map.forEach(g => {
      if (!g.parentGroupId || !map.has(g.parentGroupId)) {
        g.depth = 0;
        roots.push(g);
      } else {
        const parent = map.get(g.parentGroupId)!;
        if (!parent.children) parent.children = [];
        g.depth = (parent.depth ?? 0) + 1;
        parent.children.push(g);
      }
    });
    return roots.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [groups]);

  // Flatten for display
  function flattenTree(nodes: AccountGroup[], result: AccountGroup[] = []): AccountGroup[] {
    for (const n of nodes) {
      result.push(n);
      if (expandedIds.has(n.id) && n.children?.length) {
        flattenTree(n.children, result);
      }
    }
    return result;
  }

  const flatList = useMemo(() => {
    const raw = flattenTree(tree);
    if (!searchTerm.trim()) return raw;
    const q = searchTerm.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.alias || "").toLowerCase().includes(q)
    ).map(g => ({ ...g, depth: 0 }));
  }, [tree, expandedIds, searchTerm, groups]);

  // Form reset
  function resetForm() {
    setForm({ name: "", alias: "", isPrimary: false, parentGroupId: "", narration: "", nature: "debit" });
    setErrors({});
  }

  // Open Add
  function openAdd() {
    resetForm();
    setEditingId(null);
    setMode("add");
    setTimeout(() => nameRef.current?.focus(), 100);
  }

  // Open Modify
  function openModify(g: AccountGroup) {
    setForm({
      name: g.name,
      alias: g.alias || "",
      isPrimary: g.isPrimary,
      parentGroupId: g.parentGroupId || "",
      narration: g.narration || "",
      nature: g.nature,
    });
    setEditingId(g.id);
    setErrors({});
    setMode("modify");
    setTimeout(() => nameRef.current?.focus(), 100);
  }

  // Validate
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Group Name is required";
    if (!form.isPrimary && !form.parentGroupId) e.parentGroupId = "Select parent group (Under Group)";
    if (groups.find(g => g.name.toLowerCase() === form.name.trim().toLowerCase() && g.id !== editingId)) {
      e.name = "A group with this name already exists";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // Save group
  function handleSave(andNew = false) {
    if (!validate()) return;
    const newGroup: AccountGroup = {
      id: editingId || `grp-${Date.now()}`,
      name: form.name.trim(),
      alias: form.alias.trim() || undefined,
      isPrimary: form.isPrimary,
      parentGroupId: form.isPrimary ? undefined : form.parentGroupId || undefined,
      narration: form.narration.trim() || undefined,
      isSystem: false,
      nature: form.nature,
      sortOrder: groups.length,
    };

    let updated: AccountGroup[];
    if (editingId && mode === "modify") {
      updated = groups.map(g => g.id === editingId ? { ...g, ...newGroup } : g);
      toast.success(`Group "${newGroup.name}" updated.`);
    } else {
      updated = [...groups, newGroup];
      toast.success(`Group "${newGroup.name}" created.`);
    }
    setGroups(updated);
    saveGroupsToStorage(updated);
    
    if (andNew) {
      resetForm();
      setEditingId(null);
      setMode("add");
      setTimeout(() => nameRef.current?.focus(), 50);
    } else {
      setMode("list");
    }
  }

  // Delete group
  function handleDelete(g: AccountGroup) {
    if (g.isSystem) {
      toast.error("Predefined system groups cannot be deleted.");
      return;
    }
    const hasChildren = groups.some(x => x.parentGroupId === g.id);
    if (hasChildren) {
      toast.error("Cannot delete: This group has sub-groups under it. Delete sub-groups first.");
      return;
    }
    // Check if accounts use this group
    const hasAccounts = accounts?.some?.((a: any) => a.groupId === g.id || a.group === g.name);
    if (hasAccounts) {
      toast.error("Cannot delete: Accounts are using this group. Re-assign or delete accounts first.");
      return;
    }
    if (!confirm(`Delete group "${g.name}"? This cannot be undone.`)) return;
    const updated = groups.filter(x => x.id !== g.id);
    setGroups(updated);
    saveGroupsToStorage(updated);
    toast.success(`Group "${g.name}" deleted.`);
  }

  // Copy group
  function handleCopy(g: AccountGroup) {
    setClipboardGroup(g);
    toast.success(`"${g.name}" copied to clipboard. Use Paste to create duplicate.`);
  }

  function handlePaste() {
    if (!clipboardGroup) return;
    setForm({
      name: `${clipboardGroup.name} (Copy)`,
      alias: clipboardGroup.alias || "",
      isPrimary: clipboardGroup.isPrimary,
      parentGroupId: clipboardGroup.parentGroupId || "",
      narration: clipboardGroup.narration || "",
      nature: clipboardGroup.nature,
    });
    setEditingId(null);
    setMode("add");
  }

  // Toggle expand
  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Get all groups for parent dropdown (excluding self and children when editing)
  const parentOptions = useMemo(() => {
    if (!editingId) return groups;
    // Exclude self and all descendants
    const descendants = new Set<string>();
    function collectDesc(id: string) {
      descendants.add(id);
      groups.filter(g => g.parentGroupId === id).forEach(c => collectDesc(c.id));
    }
    if (editingId) collectDesc(editingId);
    return groups.filter(g => !descendants.has(g.id));
  }, [groups, editingId]);

  // ── RENDER: List Mode ─────────────────────────────────────────────────────
  const renderList = () => (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#f5f6fa] border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button onClick={openAdd}
            className="h-7 px-3 bg-[#1557b0] text-white text-[11px] font-medium rounded flex items-center gap-1.5 hover:bg-[#0f4a96]">
            <Plus className="h-3.5 w-3.5" /> Add (F3)
          </button>
          <button onClick={() => { if (expandedIds.size) setExpandedIds(new Set()); else setExpandedIds(new Set(groups.map(g=>g.id))); }}
            className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-50">
            {expandedIds.size ? "Collapse All" : "Expand All"}
          </button>
          {clipboardGroup && (
            <button onClick={handlePaste}
              className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-50">
              Paste Copy
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-7 pl-8 pr-3 text-[11px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] w-48"
          />
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_120px_100px_80px_80px] gap-0 px-4 py-1.5 bg-[#c9deb5] border-b border-gray-200 text-[10px] font-bold text-gray-700 uppercase tracking-wide">
        <span>Group Name</span>
        <span>Under Group</span>
        <span>Primary</span>
        <span>Nature</span>
        <span>Actions</span>
      </div>

      {/* Tree rows */}
      <div className="flex-1 overflow-y-auto">
        {flatList.length === 0 && (
          <div className="text-center py-12 text-[12px] text-gray-500">
            No account groups found.
          </div>
        )}
        {flatList.map(g => {
          const hasChildren = groups.some(x => x.parentGroupId === g.id);
          const isExpanded = expandedIds.has(g.id);
          const depth = g.depth ?? 0;
          const parentGroup = groups.find(x => x.id === g.parentGroupId);

          return (
            <div
              key={g.id}
              className="grid grid-cols-[1fr_120px_100px_80px_80px] items-center px-4 py-1.5 border-b border-gray-100 hover:bg-[#f0f5ff] group cursor-pointer text-[12px]"
              style={{ paddingLeft: `${16 + depth * 20}px` }}
              onClick={() => openModify(g)}
            >
              {/* Name */}
              <div className="flex items-center gap-1.5">
                {hasChildren ? (
                  <button
                    onClick={e => { e.stopPropagation(); toggleExpand(g.id); }}
                    className="p-0.5 text-gray-500 hover:text-gray-800"
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                ) : <span className="w-5" />}
                {hasChildren
                  ? <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  : <Folder className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                }
                <span className={`font-medium ${g.isPrimary ? "text-[#1557b0] font-semibold" : "text-gray-800"}`}>
                  {g.name}
                </span>
                {g.alias && <span className="text-[10px] text-gray-400">({g.alias})</span>}
                {g.isSystem && (
                  <span className="ml-1 px-1 py-0 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold rounded uppercase">System</span>
                )}
              </div>

              {/* Under Group */}
              <span className="text-gray-500 text-[11px]">{parentGroup?.name || "—"}</span>

              {/* Primary */}
              <span className={`text-[11px] font-semibold ${g.isPrimary ? "text-[#1557b0]" : "text-gray-500"}`}>
                {g.isPrimary ? "Yes" : "No"}
              </span>

              {/* Nature */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${g.nature === "credit" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                {g.nature === "credit" ? "Cr" : "Dr"}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); openModify(g); }}
                  className="p-1 rounded text-gray-500 hover:text-[#1557b0] hover:bg-blue-50"
                  title="Modify (Enter)"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleCopy(g); }}
                  className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  title="Copy (F12)"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {!g.isSystem && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(g); }}
                    className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                    title="Delete (F8)"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      <div className="px-4 py-1 bg-[#d4eabd] border-t border-gray-200 text-[10px] text-gray-600 flex items-center gap-4">
        <span>Total Groups: <strong>{groups.length}</strong></span>
        <span>Primary: <strong>{groups.filter(g => g.isPrimary).length}</strong></span>
        <span>Sub-Groups: <strong>{groups.filter(g => !g.isPrimary).length}</strong></span>
        <span className="ml-auto">F3=Add · Enter=Modify · F8=Delete · F12=Copy</span>
      </div>
    </div>
  );

  // ── RENDER: Add / Modify Mode ─────────────────────────────────────────────
  const renderForm = () => {
    const isModify = mode === "modify";
    const editingGroup = isModify ? groups.find(g => g.id === editingId) : null;
    const isSystemGroup = editingGroup?.isSystem ?? false;

    return (
      <div className="p-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
          <h2 className="text-[14px] font-bold text-gray-800">
            {isModify ? `Modify Account Group — ${editingGroup?.name}` : "Add Account Group"}
          </h2>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            {isModify && isSystemGroup && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" /> System group — limited editing
              </span>
            )}
            <span>F2=Save · Esc=Cancel</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Group Name <span className="text-red-500">*</span></label>
            <input
              ref={nameRef}
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              disabled={isSystemGroup}
              className={`${inputCls} ${errors.name ? "border-red-400" : ""} ${isSystemGroup ? "bg-gray-50 cursor-not-allowed" : ""}`}
              placeholder="e.g. Office Equipment, Secured Loans"
              onKeyDown={e => { if (e.key === "F2") { e.preventDefault(); handleSave(); } }}
            />
            {errors.name && <p className="text-[11px] text-red-600 mt-0.5">{errors.name}</p>}
          </div>

          {/* Alias */}
          <div>
            <label className={labelCls}>Alias / Short Name (optional)</label>
            <input
              type="text"
              value={form.alias}
              onChange={e => setForm(p => ({ ...p, alias: e.target.value }))}
              disabled={isSystemGroup}
              className={`${inputCls} ${isSystemGroup ? "bg-gray-50 cursor-not-allowed" : ""}`}
              placeholder="e.g. Off-Equip, Bank-OD"
            />
          </div>

          {/* Primary Group toggle */}
          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center gap-3">
              <label className="text-[12px] font-medium text-gray-700">Is Primary Group?</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => !isSystemGroup && setForm(p => ({ ...p, isPrimary: true, parentGroupId: "" }))}
                  disabled={isSystemGroup}
                  className={`px-3 py-1 text-[11px] font-semibold rounded border transition-colors ${form.isPrimary ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} ${isSystemGroup ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  Y (Top-level)
                </button>
                <button
                  type="button"
                  onClick={() => !isSystemGroup && setForm(p => ({ ...p, isPrimary: false }))}
                  disabled={isSystemGroup}
                  className={`px-3 py-1 text-[11px] font-semibold rounded border transition-colors ${!form.isPrimary ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} ${isSystemGroup ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  N (Sub-group)
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Primary = Top-most level group. Non-primary = Sub-group under an existing group.
            </p>
          </div>

          {/* Under Group (only for sub-groups) */}
          {!form.isPrimary && (
            <div>
              <label className={labelCls}>Under Group <span className="text-red-500">*</span></label>
              <select
                value={form.parentGroupId}
                onChange={e => setForm(p => ({ ...p, parentGroupId: e.target.value }))}
                disabled={isSystemGroup}
                className={`${inputCls} ${errors.parentGroupId ? "border-red-400" : ""} ${isSystemGroup ? "bg-gray-50 cursor-not-allowed" : ""}`}
              >
                <option value="">— Select Parent Group —</option>
                {parentOptions.map(g => (
                  <option key={g.id} value={g.id} style={{ paddingLeft: `${(g.depth ?? 0) * 16}px` }}>
                    {"\u00A0".repeat((g.depth ?? 0) * 2)}{g.name}
                    {g.isPrimary ? " (Primary)" : ""}
                  </option>
                ))}
              </select>
              {errors.parentGroupId && <p className="text-[11px] text-red-600 mt-0.5">{errors.parentGroupId}</p>}
            </div>
          )}

          {/* Nature */}
          <div>
            <label className={labelCls}>Nature of Group</label>
            <div className="flex gap-3">
              {(["debit", "credit"] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => !isSystemGroup && setForm(p => ({ ...p, nature: n }))}
                  disabled={isSystemGroup}
                  className={`px-4 py-1.5 text-[11px] font-semibold rounded border transition-colors ${form.nature === n ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} ${isSystemGroup ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {n === "debit" ? "Debit (Assets/Expenses)" : "Credit (Liabilities/Income)"}
                </button>
              ))}
            </div>
          </div>

          {/* Narration */}
          <div>
            <label className={labelCls}>Narration / Description (optional)</label>
            <textarea
              value={form.narration}
              onChange={e => setForm(p => ({ ...p, narration: e.target.value }))}
              rows={2}
              className="w-full px-2.5 py-1.5 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] resize-none"
              placeholder="Internal description of this group..."
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="flex gap-2">
              {isModify && !isSystemGroup && (
                <button
                  onClick={() => editingGroup && handleDelete(editingGroup)}
                  className="h-8 px-3 bg-red-600 text-white text-[12px] font-medium rounded hover:bg-red-700 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete (F8)
                </button>
              )}
              {editingGroup && (
                <button
                  onClick={() => handleCopy(editingGroup)}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy (F12)
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("list")}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded hover:bg-gray-50 flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Cancel (Esc)
              </button>
              {!isSystemGroup && (
                <>
                  <button
                    onClick={() => handleSave(true)}
                    className="h-8 px-3 bg-gray-200 border border-gray-300 text-gray-700 text-[12px] font-medium rounded hover:bg-gray-300 flex items-center gap-1.5"
                  >
                    Save & New
                  </button>
                  <button
                    onClick={() => handleSave(false)}
                    className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded hover:bg-[#0f4a96] flex items-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Save (F2)
                  </button>
                </>
              )}
              {isSystemGroup && (
                <button onClick={() => setMode("list")} className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded">
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Keyboard handling ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (mode === "list") {
        if (e.key === "F3") { e.preventDefault(); openAdd(); }
      }
      if (mode === "add" || mode === "modify") {
        if (e.key === "Escape") setMode("list");
        if (e.key === "F2") { e.preventDefault(); handleSave(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, form]);

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Account Group Master</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage the hierarchy of account groups (Administration → Masters → Account Group)
          </p>
        </div>
        {mode !== "list" && (
          <button onClick={() => setMode("list")} className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-50 flex items-center gap-1.5">
            ← Back to List
          </button>
        )}
      </div>

      {/* Mode sub-tabs */}
      {mode === "list" && (
        <div className="flex items-center gap-0 px-4 pt-2 bg-white border-b border-gray-200">
          {["Add", "List"].map(m => (
            <button
              key={m}
              onClick={() => m === "Add" ? openAdd() : setMode("list")}
              className={`px-4 py-1.5 text-[11px] font-medium border-b-2 -mb-px transition-colors ${
                (m === "List" && mode === "list") ? "border-[#1557b0] text-[#1557b0]" : "border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden bg-white">
        {mode === "list" && renderList()}
        {(mode === "add" || mode === "modify") && (
          <div className="h-full overflow-y-auto">
            {renderForm()}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountGroupMaster;
