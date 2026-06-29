// @ts-nocheck
import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "../store";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Plus, Edit2,
  Trash2, ChevronRight, User, Shield, RotateCcw, X, Settings,
  FileText, Filter, Download
} from "lucide-react";
import * as XLSX from "xlsx";

type Tab = "inbox" | "policies" | "history" | "audit";
type StatusFilter = "all" | "pending" | "approved" | "rejected" | "cancelled";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_CONFIG = {
  pending:   { color: "yellow", icon: Clock,        label: "Pending"   },
  approved:  { color: "green",  icon: CheckCircle,  label: "Approved"  },
  rejected:  { color: "red",    icon: XCircle,      label: "Rejected"  },
  cancelled: { color: "gray",   icon: XCircle,      label: "Cancelled" },
};

const VOUCHER_TYPES = ["payment","receipt","journal","purchase","sales","credit-note","debit-note","contra","*"];
const ROLES = ["accountant","senior-accountant","manager","finance-manager","director","cfo","admin"];

export default function ApprovalWorkflow() {
  const {
    approvalPolicies = [], approvalRequests = [], approvalActions = [],
    loadApprovalData, addApprovalPolicy, updateApprovalPolicy,
    deleteApprovalPolicy, submitForApproval, takeApprovalAction,
    companySettings,
  } = useStore();

  const [activeTab, setActiveTab]       = useState<Tab>("inbox");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showTestModal, setShowTestModal]     = useState(false);
  const [editPolicy, setEditPolicy]     = useState<any>(null);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionType, setActionType]     = useState<"approved"|"rejected"|"returned">("approved");
  const [actionComments, setActionComments] = useState("");
  // Simulate current user (in a real app this comes from auth context)
  const [currentUser] = useState({ id: "user-1", name: "Current User", role: "manager" });

  // Policy form
  const [policyForm, setPolicyForm] = useState<any>({
    voucherType: "payment", minimumAmount: 0,
    description: "", isActive: true,
    levels: [{ level: 1, approverRole: "manager", isRequired: true }],
  });

  // Test request form
  const [testForm, setTestForm] = useState({
    voucherType: "payment", voucherAmount: 0,
    voucherNarration: "Test voucher for approval", voucherDate: new Date().toISOString().slice(0,10),
  });

  useEffect(() => { loadApprovalData?.(); }, []);

  // ── Filtered requests ─────────────────────────────────────────────────────
  const filteredRequests = useMemo(() =>
    approvalRequests
      .filter(r => statusFilter === "all" || r.status === statusFilter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [approvalRequests, statusFilter]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    pending:  approvalRequests.filter(r => r.status === "pending").length,
    approved: approvalRequests.filter(r => r.status === "approved").length,
    rejected: approvalRequests.filter(r => r.status === "rejected").length,
    total:    approvalRequests.length,
  }), [approvalRequests]);

  // ── Get actions for a request ─────────────────────────────────────────────
  const getRequestActions = (requestId: number) =>
    approvalActions.filter(a => a.requestId === requestId).sort((a,b)=>a.actionAt.localeCompare(b.actionAt));

  // ── Find matching policy for a voucher ───────────────────────────────────
  const findPolicy = (voucherType: string, amount: number) =>
    approvalPolicies.find(p =>
      p.isActive &&
      (p.voucherType === voucherType || p.voucherType === "*") &&
      amount >= p.minimumAmount
    );

  // ── Save policy ───────────────────────────────────────────────────────────
  const handleSavePolicy = async () => {
    const now = new Date().toISOString();
    if (editPolicy?.id) {
      await updateApprovalPolicy(editPolicy.id, { ...policyForm, updatedAt: now });
    } else {
      await addApprovalPolicy({ ...policyForm, createdAt: now, updatedAt: now });
    }
    setShowPolicyModal(false);
    setEditPolicy(null);
    setPolicyForm({ voucherType:"payment", minimumAmount:0, description:"", isActive:true,
      levels:[{ level:1, approverRole:"manager", isRequired:true }] });
  };

  // ── Submit test voucher ───────────────────────────────────────────────────
  const handleTestSubmit = async () => {
    const policy = findPolicy(testForm.voucherType, testForm.voucherAmount);
    if (!policy) { alert("No active approval policy found for this voucher type and amount."); return; }
    await submitForApproval({
      voucherId: Math.floor(Math.random() * 100000),
      voucherType: testForm.voucherType,
      voucherDate: testForm.voucherDate,
      voucherAmount: testForm.voucherAmount,
      voucherNarration: testForm.voucherNarration,
      currentLevel: 1,
      totalLevels: policy.levels.length,
      status: "pending",
      makerUserId: currentUser.id,
      makerName: currentUser.name,
      policyId: policy.id!,
    });
    setShowTestModal(false);
    setActiveTab("inbox");
  };

  // ── Take action on a request ──────────────────────────────────────────────
  const handleTakeAction = async () => {
    if (!selectedRequest) return;
    await takeApprovalAction(
      selectedRequest.id!, actionType,
      currentUser.id, currentUser.name, actionComments
    );
    setShowActionModal(false);
    setSelectedRequest(null);
    setActionComments("");
  };

  // ── Export audit trail ────────────────────────────────────────────────────
  const exportAudit = () => {
    const data = approvalActions.map(a => {
      const req = approvalRequests.find(r => r.id === a.requestId);
      return {
        "Request ID": a.requestId,
        "Voucher Type": req?.voucherType || "",
        "Amount": req?.voucherAmount || "",
        "Level": a.level,
        "Action": a.action,
        "By": a.actionByName,
        "Comments": a.comments,
        "Date": a.actionAt,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Trail");
    XLSX.writeFile(wb, `ApprovalAuditTrail_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // ── Policy level helpers ──────────────────────────────────────────────────
  const addLevel = () => setPolicyForm((f: any) => ({
    ...f, levels: [...f.levels, { level: f.levels.length + 1, approverRole: "manager", isRequired: true }]
  }));
  const removeLevel = (idx: number) => setPolicyForm((f: any) => ({
    ...f, levels: f.levels.filter((_: any, i: number) => i !== idx).map((l: any, i: number) => ({ ...l, level: i + 1 }))
  }));
  const updateLevel = (idx: number, field: string, value: any) => setPolicyForm((f: any) => ({
    ...f, levels: f.levels.map((l: any, i: number) => i === idx ? { ...l, [field]: value } : l)
  }));

  const tabs = [
    { id: "inbox",    label: "Approval Inbox",  icon: Clock    },
    { id: "policies", label: "Policies",         icon: Settings },
    { id: "history",  label: "History",          icon: FileText },
    { id: "audit",    label: "Audit Trail",      icon: Shield   },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Maker-Checker Approval Workflow</h1>
          <p className="text-sm text-gray-500 mt-1">
            Multi-level voucher approval with configurable policies and tamper-evident audit trail
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTestModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <Plus className="w-4 h-4"/> Submit for Approval
          </button>
          {activeTab === "audit" && (
            <button onClick={exportAudit}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
              <Download className="w-4 h-4"/> Export
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Approval", value: stats.pending,  color: "yellow", icon: Clock       },
          { label: "Approved",         value: stats.approved, color: "green",  icon: CheckCircle },
          { label: "Rejected",         value: stats.rejected, color: "red",    icon: XCircle     },
          { label: "Active Policies",  value: approvalPolicies.filter(p=>p.isActive).length, color: "blue", icon: Shield },
        ].map(card => (
          <div key={card.label} className={`bg-${card.color}-50 rounded-xl p-4 border border-${card.color}-100`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{card.label}</span>
              <card.icon className={`w-4 h-4 text-${card.color}-500`}/>
            </div>
            <div className={`text-2xl font-bold text-${card.color}-700`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
              activeTab === t.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
            <t.icon className="w-4 h-4"/> {t.label}
            {t.id === "inbox" && stats.pending > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {stats.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── INBOX TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "inbox" && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2">
            {(["all","pending","approved","rejected"] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border capitalize transition-all ${
                  statusFilter === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
                {s} {s !== "all" && `(${approvalRequests.filter(r=>r.status===s).length})`}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredRequests.map(req => {
              const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              const actions = getRequestActions(req.id!);
              const policy = approvalPolicies.find(p => p.id === req.policyId);

              return (
                <div key={req.id} className={`bg-white rounded-xl border shadow-sm p-4 ${
                  req.status === "pending" ? "border-yellow-200" :
                  req.status === "approved" ? "border-green-200" :
                  "border-red-200"}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-${cfg.color}-50`}>
                        <Icon className={`w-5 h-5 text-${cfg.color}-600`}/>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800 capitalize">{req.voucherType} Voucher</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs bg-${cfg.color}-100 text-${cfg.color}-700`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-0.5">{req.voucherNarration}</div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span>Amount: <span className="font-medium text-gray-700">{fmt(req.voucherAmount)}</span></span>
                          <span>Date: {req.voucherDate}</span>
                          <span>By: {req.makerName}</span>
                          <span>Submitted: {new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Approval level progress */}
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: req.totalLevels }).map((_, i) => (
                          <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                            i + 1 < req.currentLevel ? "bg-green-500 border-green-500 text-white" :
                            i + 1 === req.currentLevel && req.status === "pending" ? "bg-yellow-400 border-yellow-400 text-white animate-pulse" :
                            req.status === "approved" ? "bg-green-500 border-green-500 text-white" :
                            "bg-gray-100 border-gray-300 text-gray-400"}`}>
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-400">Level {req.currentLevel} of {req.totalLevels}</div>
                    </div>
                  </div>

                  {/* Action history timeline */}
                  {actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3 overflow-x-auto">
                      {actions.map((a, i) => (
                        <div key={i} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
                          a.action === "approved" ? "bg-green-50 text-green-700" :
                          a.action === "rejected" ? "bg-red-50 text-red-700" :
                          "bg-blue-50 text-blue-700"}`}>
                          {a.action === "approved" ? <CheckCircle className="w-3 h-3"/> :
                           a.action === "rejected" ? <XCircle className="w-3 h-3"/> :
                           <RotateCcw className="w-3 h-3"/>}
                          L{a.level}: {a.actionByName}
                        </div>
                      ))}
                    </div>
                  )}

                  {req.rejectionReason && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">
                      Rejection reason: {req.rejectionReason}
                    </div>
                  )}

                  {/* Action buttons for pending requests */}
                  {req.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => { setSelectedRequest(req); setActionType("approved"); setShowActionModal(true); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                        <CheckCircle className="w-3.5 h-3.5"/> Approve
                      </button>
                      <button onClick={() => { setSelectedRequest(req); setActionType("returned"); setShowActionModal(true); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                        <RotateCcw className="w-3.5 h-3.5"/> Return
                      </button>
                      <button onClick={() => { setSelectedRequest(req); setActionType("rejected"); setShowActionModal(true); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">
                        <XCircle className="w-3.5 h-3.5"/> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredRequests.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                <div className="font-medium">No {statusFilter === "all" ? "" : statusFilter} requests</div>
                <div className="text-sm mt-1">Use "Submit for Approval" to create a test request.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── POLICIES TAB ──────────────────────────────────────────────────── */}
      {activeTab === "policies" && (
        <div className="space-y-4">
          <button onClick={() => { setEditPolicy(null); setShowPolicyModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4"/> Add Policy
          </button>

          <div className="space-y-3">
            {approvalPolicies.map(policy => (
              <div key={policy.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 capitalize">{policy.voucherType === "*" ? "All Voucher Types" : policy.voucherType}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${policy.isActive?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>
                        {policy.isActive?"Active":"Inactive"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">{policy.description}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Applies when amount ≥ {fmt(policy.minimumAmount)} · {policy.levels?.length || 0} approval level(s)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditPolicy(policy); setPolicyForm({...policy, levels: policy.levels || []}); setShowPolicyModal(true); }}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={() => deleteApprovalPolicy(policy.id!)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>

                {/* Levels visualization */}
                {policy.levels && policy.levels.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">Flow:</span>
                    <div className="flex items-center gap-1">
                      <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">Maker</div>
                    </div>
                    {policy.levels.map((lvl: any, i: number) => (
                      <React.Fragment key={i}>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400"/>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${lvl.isRequired?"bg-orange-50 text-orange-700":"bg-gray-50 text-gray-600"}`}>
                          L{lvl.level}: {lvl.approverRole}
                          {lvl.isRequired && <span className="ml-1 text-orange-400">*</span>}
                        </div>
                      </React.Fragment>
                    ))}
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400"/>
                    <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">Posted</div>
                  </div>
                )}
              </div>
            ))}

            {approvalPolicies.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No approval policies configured. Add a policy to enable the maker-checker workflow.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Ref","Type","Amount","Date","Maker","Levels","Status","Last Action","Updated"]
                  .map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {approvalRequests.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(req => {
                const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                const lastAction = getRequestActions(req.id!).slice(-1)[0];
                return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{req.id}</td>
                    <td className="px-4 py-3 capitalize font-medium">{req.voucherType}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(req.voucherAmount)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{req.voucherDate}</td>
                    <td className="px-4 py-3 text-gray-600">{req.makerName}</td>
                    <td className="px-4 py-3 text-center">{req.totalLevels}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-${cfg.color}-100 text-${cfg.color}-700 w-fit`}>
                        <Icon className="w-3 h-3"/>{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {lastAction ? `${lastAction.action} by ${lastAction.actionByName}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(req.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {approvalRequests.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No approval requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AUDIT TRAIL TAB ───────────────────────────────────────────────── */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
            <Shield className="w-4 h-4 inline mr-1"/> This audit trail is append-only. Every approval action is permanently recorded with timestamp, user, level, and comments.
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Timestamp","Request","Voucher Type","Amount","Level","Action","By","Comments"]
                    .map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {approvalActions.slice().sort((a,b)=>b.actionAt.localeCompare(a.actionAt)).map(a => {
                  const req = approvalRequests.find(r => r.id === a.requestId);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{new Date(a.actionAt).toLocaleString()}</td>
                      <td className="px-4 py-2 font-mono text-xs">#{a.requestId}</td>
                      <td className="px-4 py-2 capitalize">{req?.voucherType || "—"}</td>
                      <td className="px-4 py-2 text-right">{req ? fmt(req.voucherAmount) : "—"}</td>
                      <td className="px-4 py-2 text-center font-bold text-gray-600">L{a.level}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.action==="approved"?"bg-green-100 text-green-700":
                          a.action==="rejected"?"bg-red-100 text-red-700":
                          "bg-blue-100 text-blue-700"}`}>
                          {a.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-700">{a.actionByName}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 max-w-48 truncate">{a.comments || "—"}</td>
                    </tr>
                  );
                })}
                {approvalActions.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No audit actions recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── POLICY MODAL ──────────────────────────────────────────────────── */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{editPolicy ? "Edit Policy" : "Add Approval Policy"}</h2>
              <button onClick={() => setShowPolicyModal(false)}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Type</label>
                  <select value={policyForm.voucherType} onChange={e=>setPolicyForm({...policyForm,voucherType:e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {VOUCHER_TYPES.map(t=><option key={t} value={t}>{t==="*"?"All Types":t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Amount (NPR)</label>
                  <input type="number" value={policyForm.minimumAmount} onChange={e=>setPolicyForm({...policyForm,minimumAmount:+e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={policyForm.description} onChange={e=>setPolicyForm({...policyForm,description:e.target.value})}
                  placeholder="e.g. Payments above NPR 50,000 require manager approval"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={policyForm.isActive} onChange={e=>setPolicyForm({...policyForm,isActive:e.target.checked})} className="w-4 h-4 rounded"/>
                Active
              </label>

              {/* Approval Levels */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Approval Levels</label>
                  <button onClick={addLevel}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                    <Plus className="w-3 h-3"/> Add Level
                  </button>
                </div>
                <div className="space-y-2">
                  {policyForm.levels.map((lvl: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {lvl.level}
                      </div>
                      <select value={lvl.approverRole} onChange={e=>updateLevel(i,"approverRole",e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                        {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
                        <input type="checkbox" checked={lvl.isRequired} onChange={e=>updateLevel(i,"isRequired",e.target.checked)} className="w-3 h-3"/>
                        Required
                      </label>
                      <button onClick={()=>removeLevel(i)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                        <X className="w-4 h-4"/>
                      </button>
                    </div>
                  ))}
                  {policyForm.levels.length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-3">No levels added yet.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end sticky bottom-0 bg-white">
              <button onClick={()=>setShowPolicyModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSavePolicy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save Policy</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION MODAL ──────────────────────────────────────────────────── */}
      {showActionModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold capitalize">{actionType} Voucher</h2>
              <button onClick={()=>setShowActionModal(false)}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{selectedRequest.voucherType}</span></div>
                <div><span className="text-gray-500">Amount:</span> <span className="font-semibold">{fmt(selectedRequest.voucherAmount)}</span></div>
                <div><span className="text-gray-500">Narration:</span> {selectedRequest.voucherNarration}</div>
                <div><span className="text-gray-500">Level:</span> {selectedRequest.currentLevel} of {selectedRequest.totalLevels}</div>
              </div>
              <div className="flex gap-2">
                {(["approved","returned","rejected"] as const).map(a => (
                  <button key={a} onClick={() => setActionType(a)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-all ${
                      actionType === a
                        ? a==="approved"?"bg-green-600 text-white border-green-600":
                          a==="rejected"?"bg-red-600 text-white border-red-600":
                          "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}>
                    {a}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments {actionType === "rejected" && <span className="text-red-500">* (required for rejection)</span>}
                </label>
                <textarea value={actionComments} onChange={e=>setActionComments(e.target.value)}
                  rows={3} placeholder="Add comments or reason…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"/>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button onClick={()=>setShowActionModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleTakeAction}
                className={`px-6 py-2 text-white rounded-lg text-sm font-medium ${
                  actionType==="approved"?"bg-green-600 hover:bg-green-700":
                  actionType==="rejected"?"bg-red-600 hover:bg-red-700":
                  "bg-blue-600 hover:bg-blue-700"}`}>
                Confirm {actionType}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TEST SUBMISSION MODAL ─────────────────────────────────────────── */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Submit Voucher for Approval</h2>
              <button onClick={()=>setShowTestModal(false)}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Type</label>
                  <select value={testForm.voucherType} onChange={e=>setTestForm({...testForm,voucherType:e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {VOUCHER_TYPES.filter(t=>t!=="*").map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={testForm.voucherDate} onChange={e=>setTestForm({...testForm,voucherDate:e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (NPR)</label>
                <input type="number" value={testForm.voucherAmount} onChange={e=>setTestForm({...testForm,voucherAmount:+e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Narration</label>
                <input value={testForm.voucherNarration} onChange={e=>setTestForm({...testForm,voucherNarration:e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              {(() => {
                const policy = findPolicy(testForm.voucherType, testForm.voucherAmount);
                return policy ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
                    ✓ Policy matched: {policy.description || policy.voucherType} · {policy.levels?.length} level(s) required
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                    ⚠ No matching policy found. Add a policy first.
                  </div>
                );
              })()}
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button onClick={()=>setShowTestModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleTestSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
