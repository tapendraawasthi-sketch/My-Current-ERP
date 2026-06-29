// @ts-nocheck
import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "../store";
import {
  RefreshCw, Plus, Edit2, Trash2, Play, Clock,
  CheckCircle, AlertTriangle, Calendar, Download,
  ChevronDown, ChevronUp, X, Copy, Bell
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  computeNextDueDate, daysUntilDue,
  frequencyLabel, FREQUENCY_OPTIONS, TEMPLATE_PRESETS
} from "../lib/recurringUtils";

type Tab = "templates" | "due-today" | "history";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const VOUCHER_TYPES = ["journal","payment","receipt","purchase","sales","contra","debit-note","credit-note"];

export default function RecurringVouchers() {
  const {
    recurringTemplates = [], recurringPostings = [],
    accounts = [],
    loadRecurringData, addRecurringTemplate, updateRecurringTemplate,
    deleteRecurringTemplate, postRecurringTemplate,
  } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>("templates");
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [postingId, setPostingId]   = useState<number | null>(null);
  const [postDate, setPostDate]     = useState(new Date().toISOString().slice(0, 10));
  const [postNotes, setPostNotes]   = useState("");

  // ── Template form state ───────────────────────────────────────────────────
  const emptyForm = () => ({
    name: "", description: "", voucherType: "journal",
    frequency: "monthly" as any, startDate: new Date().toISOString().slice(0,10),
    endDate: "", nextDueDate: new Date().toISOString().slice(0,10),
    totalAmount: 0, isActive: true, autoPost: false, reminderDaysBefore: 3,
    lines: [
      { accountId: "", accountName: "", debit: 0, credit: 0, narration: "" },
      { accountId: "", accountName: "", debit: 0, credit: 0, narration: "" },
    ],
  });

  const [form, setForm] = useState<any>(emptyForm());

  useEffect(() => { loadRecurringData?.(); }, []);

  // ── Due / overdue templates ───────────────────────────────────────────────
  const dueTemplates = useMemo(() =>
    recurringTemplates.filter(t => {
      if (!t.isActive) return false;
      const days = daysUntilDue(t.nextDueDate);
      return days <= (t.reminderDaysBefore || 3);
    }).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)),
    [recurringTemplates]);

  const overdueCount = dueTemplates.filter(t => daysUntilDue(t.nextDueDate) < 0).length;

  // ── Line helpers ──────────────────────────────────────────────────────────
  const addLine = () => setForm((f: any) => ({
    ...f, lines: [...f.lines, { accountId:"", accountName:"", debit:0, credit:0, narration:"" }]
  }));
  const removeLine = (i: number) => setForm((f: any) => ({
    ...f, lines: f.lines.filter((_: any, idx: number) => idx !== i)
  }));
  const updateLine = (i: number, field: string, value: any) => setForm((f: any) => ({
    ...f, lines: f.lines.map((l: any, idx: number) => idx === i ? { ...l, [field]: value } : l)
  }));

  // ── Balance check ─────────────────────────────────────────────────────────
  const totalDebit  = form.lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  // ── Save template ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    const nextDue = computeNextDueDate(form.startDate, form.frequency);
    const payload = {
      ...form,
      nextDueDate: form.nextDueDate || nextDue,
      totalAmount: totalDebit,
      postingCount: editTemplate?.postingCount || 0,
    };
    if (editTemplate?.id) {
      await updateRecurringTemplate(editTemplate.id, payload);
    } else {
      await addRecurringTemplate(payload);
    }
    setShowModal(false);
    setEditTemplate(null);
    setForm(emptyForm());
  };

  // ── Apply preset ──────────────────────────────────────────────────────────
  const applyPreset = (preset: any) => {
    setForm((f: any) => ({
      ...f,
      name: preset.name,
      description: preset.description,
      voucherType: preset.voucherType,
      frequency: preset.frequency,
    }));
  };

  // ── Post template ─────────────────────────────────────────────────────────
  const handlePost = async (templateId: number) => {
    await postRecurringTemplate(templateId, postDate, postNotes);
    setPostingId(null);
    setPostDate(new Date().toISOString().slice(0,10));
    setPostNotes("");
  };

  // ── Export history ────────────────────────────────────────────────────────
  const exportHistory = () => {
    const data = recurringPostings.map(p => ({
      "Template": p.templateName,
      "Posted Date": p.postedDate,
      "Status": p.status,
      "Notes": p.notes,
      "Created At": p.createdAt,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recurring History");
    XLSX.writeFile(wb, `RecurringHistory_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // ── Due-days badge ────────────────────────────────────────────────────────
  function DueBadge({ nextDueDate }: { nextDueDate: string }) {
    const days = daysUntilDue(nextDueDate);
    if (days < 0)  return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">{Math.abs(days)}d overdue</span>;
    if (days === 0) return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium animate-pulse">Due today</span>;
    if (days <= 3)  return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">Due in {days}d</span>;
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">{nextDueDate}</span>;
  }

  const tabs = [
    { id: "templates", label: "All Templates",  icon: RefreshCw },
    { id: "due-today", label: `Due / Overdue ${dueTemplates.length > 0 ? `(${dueTemplates.length})` : ""}`, icon: Bell },
    { id: "history",   label: "Posting History", icon: CheckCircle },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Recurring Vouchers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Journal templates with auto-scheduling for rent, depreciation, salaries, subscriptions and more
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "history" && (
            <button onClick={exportHistory}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
              <Download className="w-4 h-4"/> Export History
            </button>
          )}
          <button onClick={() => { setEditTemplate(null); setForm(emptyForm()); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4"/> New Template
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Templates",  value: recurringTemplates.filter(t=>t.isActive).length,   color: "blue"   },
          { label: "Due / Overdue",     value: dueTemplates.length,                               color: overdueCount>0?"red":"yellow" },
          { label: "Total Postings",    value: recurringPostings.length,                          color: "green"  },
          { label: "Auto-Post Enabled", value: recurringTemplates.filter(t=>t.autoPost).length,  color: "purple" },
        ].map(card => (
          <div key={card.label} className={`bg-${card.color}-50 rounded-xl p-4 border border-${card.color}-100`}>
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className={`text-2xl font-bold text-${card.color}-700`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Overdue alert banner */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3 text-sm text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0"/>
          <span><span className="font-semibold">{overdueCount} recurring voucher(s) are overdue</span> and have not been posted yet. Go to the Due / Overdue tab to post them now.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
            <t.icon className="w-4 h-4"/> {t.label}
          </button>
        ))}
      </div>

      {/* ── ALL TEMPLATES TAB ─────────────────────────────────────────────── */}
      {activeTab === "templates" && (
        <div className="space-y-3">
          {recurringTemplates.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <div className="font-medium">No recurring templates yet</div>
              <div className="text-sm mt-1">Create a template to automate monthly journals, rent, depreciation, and more.</div>
            </div>
          )}
          {recurringTemplates.map(t => {
            const days = daysUntilDue(t.nextDueDate);
            const isExpanded = expandedId === t.id;
            const historyCount = recurringPostings.filter(p => p.templateId === t.id).length;

            return (
              <div key={t.id} className={`bg-white rounded-xl shadow-sm border transition-shadow hover:shadow-md ${
                !t.isActive ? "border-gray-200 opacity-60" :
                days < 0    ? "border-red-300" :
                days <= 3   ? "border-yellow-300" : "border-gray-200"}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${t.autoPost?"bg-green-50":"bg-blue-50"}`}>
                        <RefreshCw className={`w-5 h-5 ${t.autoPost?"text-green-600":"text-blue-600"}`}/>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{t.name}</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs capitalize">{t.voucherType}</span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{frequencyLabel(t.frequency)}</span>
                          {t.autoPost && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Auto-Post</span>}
                          {!t.isActive && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Inactive</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span>Amount: <span className="font-medium text-gray-700">{fmt(t.totalAmount)}</span></span>
                          <span>Posted {t.postingCount || 0} time(s)</span>
                          {t.lastPostedDate && <span>Last: {t.lastPostedDate}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DueBadge nextDueDate={t.nextDueDate}/>
                      {t.isActive && (
                        <button onClick={() => { setPostingId(t.id!); setPostDate(t.nextDueDate); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                          <Play className="w-3 h-3"/> Post Now
                        </button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : t.id!)}
                        className="p-1.5 text-gray-400 hover:text-gray-600">
                        {isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                      </button>
                      <button onClick={() => { setEditTemplate(t); setForm({...t, lines: t.lines||[]}); setShowModal(true); }}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={() => deleteRecurringTemplate(t.id!)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>

                  {/* Expanded lines */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Journal Lines</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-left py-1">Account</th>
                            <th className="text-right py-1 w-28">Debit</th>
                            <th className="text-right py-1 w-28">Credit</th>
                            <th className="text-left py-1 pl-4">Narration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(t.lines || []).map((line: any, i: number) => (
                            <tr key={i} className="border-t border-gray-50">
                              <td className="py-1.5 font-medium text-gray-700">{line.accountName || line.accountId}</td>
                              <td className="py-1.5 text-right text-blue-700 font-mono">{line.debit > 0 ? fmt(line.debit) : "—"}</td>
                              <td className="py-1.5 text-right text-green-700 font-mono">{line.credit > 0 ? fmt(line.credit) : "—"}</td>
                              <td className="py-1.5 pl-4 text-gray-500">{line.narration}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-200 font-bold text-xs">
                            <td className="py-1.5">TOTAL</td>
                            <td className="py-1.5 text-right text-blue-700 font-mono">{fmt((t.lines||[]).reduce((s:number,l:any)=>s+(Number(l.debit)||0),0))}</td>
                            <td className="py-1.5 text-right text-green-700 font-mono">{fmt((t.lines||[]).reduce((s:number,l:any)=>s+(Number(l.credit)||0),0))}</td>
                            <td/>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-2 text-xs text-gray-400">
                        {historyCount} posting(s) on record · Next due: {t.nextDueDate} · Reminder: {t.reminderDaysBefore}d before
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DUE TODAY TAB ─────────────────────────────────────────────────── */}
      {activeTab === "due-today" && (
        <div className="space-y-3">
          {dueTemplates.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300"/>
              <div className="font-medium text-green-600">All up to date!</div>
              <div className="text-sm mt-1">No recurring vouchers are due within the reminder window.</div>
            </div>
          )}
          {dueTemplates.map(t => {
            const days = daysUntilDue(t.nextDueDate);
            return (
              <div key={t.id} className={`bg-white rounded-xl border shadow-sm p-5 ${
                days < 0 ? "border-red-300 bg-red-50/30" : "border-yellow-300 bg-yellow-50/20"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800">{t.name}</span>
                      <DueBadge nextDueDate={t.nextDueDate}/>
                      <span className="text-xs text-gray-400">{frequencyLabel(t.frequency)}</span>
                    </div>
                    <div className="text-sm text-gray-500">{t.description}</div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span>Amount: <span className="font-medium text-gray-700">{fmt(t.totalAmount)}</span></span>
                      <span>Due: <span className="font-medium text-red-600">{t.nextDueDate}</span></span>
                      <span className="capitalize">{t.voucherType} voucher</span>
                    </div>
                  </div>
                  <button onClick={() => { setPostingId(t.id!); setPostDate(t.nextDueDate); }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 shadow-sm">
                    <Play className="w-4 h-4"/> Post Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Template","Posted Date","Status","Notes","Posted At"]
                  .map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recurringPostings.slice().sort((a,b)=>b.postedDate.localeCompare(a.postedDate)).map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.templateName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.postedDate}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      p.status==="posted"?"bg-green-100 text-green-700":
                      p.status==="skipped"?"bg-yellow-100 text-yellow-700":"bg-red-100 text-red-700"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.notes || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {recurringPostings.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No postings yet. Post a template to see history here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── POST CONFIRMATION MODAL ───────────────────────────────────────── */}
      {postingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Play className="w-5 h-5 text-green-600"/> Post Recurring Voucher
              </h2>
              <button onClick={() => setPostingId(null)}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              {(() => {
                const t = recurringTemplates.find(r => r.id === postingId);
                return t ? (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                    <div><span className="text-gray-500">Template:</span> <span className="font-medium">{t.name}</span></div>
                    <div><span className="text-gray-500">Amount:</span> <span className="font-semibold">{fmt(t.totalAmount)}</span></div>
                    <div><span className="text-gray-500">Type:</span> <span className="capitalize">{t.voucherType}</span></div>
                    <div><span className="text-gray-500">Lines:</span> {(t.lines||[]).length}</div>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Posting Date</label>
                <input type="date" value={postDate} onChange={e=>setPostDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input value={postNotes} onChange={e=>setPostNotes(e.target.value)}
                  placeholder="e.g. March 2082 rent posting"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button onClick={() => setPostingId(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={() => handlePost(postingId)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                Confirm Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATE MODAL ────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{editTemplate?"Edit Template":"New Recurring Template"}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Presets */}
              {!editTemplate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quick Presets</label>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_PRESETS.map(p => (
                      <button key={p.name} onClick={() => applyPreset(p)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-full hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all">
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                  <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
                    placeholder="e.g. Monthly Office Rent"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Type</label>
                  <select value={form.voucherType} onChange={e=>setForm({...form,voucherType:e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {VOUCHER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {FREQUENCY_OPTIONS.map(f=><option key={f} value={f}>{frequencyLabel(f)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value,nextDueDate:e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                  <input type="date" value={form.endDate||""} onChange={e=>setForm({...form,endDate:e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reminder (days before)</label>
                  <input type="number" value={form.reminderDaysBefore} min={0} max={30}
                    onChange={e=>setForm({...form,reminderDaysBefore:+e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                    placeholder="Purpose of this recurring entry"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div className="col-span-2 flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})} className="w-4 h-4 rounded"/>
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.autoPost} onChange={e=>setForm({...form,autoPost:e.target.checked})} className="w-4 h-4 rounded"/>
                    Auto-Post (no manual confirmation needed)
                  </label>
                </div>
              </div>

              {/* Journal Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Journal Lines</label>
                  <button onClick={addLine}
                    className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                    <Plus className="w-3 h-3"/> Add Line
                  </button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line: any, i: number) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <select value={line.accountId}
                          onChange={e => {
                            const acc = accounts.find((a: any) => String(a.id) === e.target.value);
                            updateLine(i, "accountId", e.target.value);
                            updateLine(i, "accountName", acc?.name || "");
                          }}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                          <option value="">Select Account</option>
                          {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" placeholder="Debit" value={line.debit||""} min={0}
                          onChange={e=>updateLine(i,"debit",+e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right"/>
                      </div>
                      <div className="col-span-2">
                        <input type="number" placeholder="Credit" value={line.credit||""} min={0}
                          onChange={e=>updateLine(i,"credit",+e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right"/>
                      </div>
                      <div className="col-span-3">
                        <input placeholder="Narration" value={line.narration||""}
                          onChange={e=>updateLine(i,"narration",e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"/>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={()=>removeLine(i)} className="text-red-400 hover:text-red-600">
                          <X className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Balance indicator */}
                <div className={`mt-3 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                  isBalanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  <span>{isBalanced ? "✓ Balanced" : "⚠ Unbalanced – debits must equal credits"}</span>
                  <span>Dr: {fmt(totalDebit)} | Cr: {fmt(totalCredit)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={!form.name || !isBalanced}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
