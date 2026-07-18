import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import { Party, PartyType } from "../lib/types";
import PartyForm from "../components/party/PartyForm";
import { Plus, Edit2, Users, Search } from "lucide-react";
import { useSutraAiStore } from "@/store/sutraAiStore";
import { consumeAiPartyDraft, peekAiPartyDraft } from "@/ai/actions/partyDraft";
import type { AiPartyDraft } from "@/ai/types";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

export default function Parties() {
  const { parties, addParty, updateParty } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const pendingPartyEdit = useSutraAiStore((s) => s.pendingPartyEdit);
  const clearPendingPartyEdit = useSutraAiStore((s) => s.clearPendingPartyEdit);
  const [showForm, setShowForm] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [aiPrefill, setAiPrefill] = useState<AiPartyDraft | null>(null);

  const handleOpenCreate = () => {
    setEditingParty(null);
    setAiPrefill(null);
    setShowForm(true);
  };

  const handleOpenEdit = (party: Party) => {
    setEditingParty(party);
    setAiPrefill(null);
    setShowForm(true);
  };

  useEffect(() => {
    const draft = peekAiPartyDraft();
    if (!draft && !pendingPartyEdit) return;
    if (!draft) return;

    const party = parties.find((p) => p.id === draft.partyId);
    if (party) {
      setEditingParty(party);
      setAiPrefill(consumeAiPartyDraft());
      setShowForm(true);
    } else if (draft.partyName) {
      setSearchTerm(draft.partyName);
    }
    clearPendingPartyEdit();
  }, [pendingPartyEdit, parties, clearPendingPartyEdit]);

  const handleSave = async (partyData: any) => {
    try {
      const payload = {
        ...partyData,
        branchId: partyData.branchId || readActiveBranchId() || undefined,
      };
      if (editingParty) {
        await updateParty(editingParty.id, payload);
      } else {
        await addParty(payload);
      }
      setShowForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      if (!matchBranch((p as { branchId?: string }).branchId)) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.pan?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q)
      );
    });
  }, [parties, searchTerm, matchBranch, branchFilter]);

  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--ds-text-default)]">Customers & suppliers</h1>
          <p className="text-[11px] text-[var(--ds-text-muted)] mt-0.5">People you trade with.</p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Party
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, code, PAN or phone…"
            className="h-8 pl-8 pr-3 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-64"
          />
        </div>
        <span className="text-[12px] text-gray-500 font-medium">
          {filteredParties.length} of {parties.length} parties
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>PAN / VAT</th>
              <th>Contact</th>
              <th className="th-right">Balance</th>
              <th className="th-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredParties.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <Users className="empty-state-icon h-8 w-8 mx-auto opacity-30" />
                    <p className="empty-state-title">
                      {searchTerm ? "No parties match your search" : "No parties found"}
                    </p>
                    <p className="empty-state-sub">
                      {searchTerm ? "Try a different search term." : "Create your first party."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredParties.map((p) => (
                <tr key={p.id}>
                  <td className="text-[12px] text-gray-700">{p.code || "—"}</td>
                  <td className="font-medium text-gray-700 text-[12px]">{p.name}</td>
                  <td>
                    <span
                      className={`badge ${
                        p.type === PartyType.CUSTOMER
                          ? "badge-customer"
                          : p.type === PartyType.SUPPLIER
                            ? "badge-supplier"
                            : "badge-both"
                      }`}
                    >
                      {p.type === PartyType.CUSTOMER
                        ? "Customer"
                        : p.type === PartyType.SUPPLIER
                          ? "Supplier"
                          : "Both"}
                    </span>
                  </td>
                  <td className="text-[12px] text-gray-700">{p.pan || p.vatNo || "—"}</td>
                  <td className="text-[12px] text-gray-700">{p.phone || p.email || "—"}</td>
                  <td className="number-cell">
                    {Number(p.balance || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        title="Edit"
                        className="text-gray-400 hover:text-[var(--ds-action-primary)] transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for PartyForm */}
      {showForm && (
        <div className="fixed inset-0 z-[var(--ds-z-modal)] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg sticky top-0 z-10">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {editingParty ? "Edit Party" : "New Party"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-700 font-bold text-[16px] leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <PartyForm
                partyId={editingParty?.id}
                prefillPhone={aiPrefill?.phone}
                focusPhone={aiPrefill?.focusPhone}
                onClose={() => {
                  setShowForm(false);
                  setAiPrefill(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
