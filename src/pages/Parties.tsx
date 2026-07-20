import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import { Party, PartyType } from "../lib/types";
import PartyForm from "../components/party/PartyForm";
import { Plus, Search, Users } from "lucide-react";
import { useSutraAiStore } from "@/store/sutraAiStore";
import { consumeAiPartyDraft, peekAiPartyDraft } from "@/ai/actions/partyDraft";
import type { AiPartyDraft } from "@/ai/types";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import { useNavCrumbStore } from "../routing/navCrumbStore";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  type EnterpriseColumnDef,
} from "@/design-system";
import { formatCurrency } from "../lib/utils";

export default function Parties() {
  const { parties, initLifecycle, setCurrentPage, setReportFilters } = useStore();
  const { branchFilter, matchBranch } = useBranchFilter();
  const pendingPartyEdit = useSutraAiStore((s) => s.pendingPartyEdit);
  const clearPendingPartyEdit = useSutraAiStore((s) => s.clearPendingPartyEdit);
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const [showForm, setShowForm] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [aiPrefill, setAiPrefill] = useState<AiPartyDraft | null>(null);

  const pageId = route.pageId === "party-master" ? "party-master" : "parties";

  const handleOpenCreate = () => {
    setEditingParty(null);
    setAiPrefill(null);
    setShowForm(true);
    openEntity(pageId, "new");
  };

  const handleOpenEdit = (party: Party) => {
    setEditingParty(party);
    setAiPrefill(null);
    setShowForm(true);
    openEntity(pageId, party.id);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setAiPrefill(null);
    clearEntity(pageId);
  };

  // Deep link: /app/parties/:id | /app/parties/new
  useEffect(() => {
    if (route.pageId !== "parties" && route.pageId !== "party-master") return;
    if (route.entityId === "new") {
      setEditingParty(null);
      setShowForm(true);
      return;
    }
    if (route.entityId) {
      const party = parties.find((p) => p.id === route.entityId);
      if (party) {
        setEditingParty(party);
        setShowForm(true);
      }
      return;
    }
    if (showForm) setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, parties]);

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

  const columns = useMemo<EnterpriseColumnDef<Party>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        cell: (p) => <span className="text-[12px] text-[var(--ds-text-default)]">{p.code || "—"}</span>,
      },
      {
        id: "name",
        header: "Name",
        cell: (p) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{p.name}</span>
        ),
      },
      {
        id: "type",
        header: "Type",
        cell: (p) => (
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
        ),
      },
      {
        id: "pan",
        header: "PAN / VAT",
        cell: (p) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{p.pan || p.vatNo || "—"}</span>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        cell: (p) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{p.phone || p.email || "—"}</span>
        ),
      },
      {
        id: "balance",
        header: "Balance",
        align: "right",
        financial: true,
        cell: (p) => (
          <span className="ds-financial-value">{formatCurrency(p.balance || 0)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4 select-none pb-8">
      <PageHeader
        title="Customers & suppliers"
        description="People you trade with."
        meta={
          <PageMeta>
            {filteredParties.length} of {parties.length} parties
          </PageMeta>
        }
        primaryAction={
          <Button
            variant="primary"
            size="small"
            onClick={handleOpenCreate}
            startIcon={<Plus className="h-3.5 w-3.5" />}
          >
            New Party
          </Button>
        }
      />

      <div className="relative w-fit">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)] pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, code, PAN or phone…"
          className="h-8 pl-8 pr-3 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-64"
        />
      </div>

      <EnterpriseDataTable
        columns={columns}
        rows={filteredParties}
        getRowId={(p) => p.id}
        loading={initLifecycle === "loading"}
        emptyIcon={<Users className="h-4 w-4" aria-hidden />}
        emptyTitle={searchTerm ? "No parties match your search" : "No parties yet"}
        emptyDescription={
          searchTerm
            ? "Nothing matches that search. Clear it or try a different name, code, or PAN."
            : "Add customers and suppliers so invoices and statements have someone to post against."
        }
        emptyAction={
          searchTerm ? (
            <Button variant="secondary" size="small" onClick={() => setSearchTerm("")}>
              Clear search
            </Button>
          ) : (
            <Button
              variant="primary"
              size="small"
              onClick={handleOpenCreate}
              startIcon={<Plus className="h-3.5 w-3.5" />}
            >
              New party
            </Button>
          )
        }
        onRowClick={handleOpenEdit}
        rowActions={(p) => [
          { label: "Edit", onSelect: () => handleOpenEdit(p) },
          {
            label: "Statement",
            onSelect: () => {
              setReportFilters({ partyId: p.id });
              setCurrentPage("party-statement");
              // After Breadcrumb page-sync, restore Parties → Statement path (STEP 3.4)
              setTimeout(() => {
                useNavCrumbStore.getState().reset([
                  { page: "parties", label: "Parties" },
                  {
                    page: "party-statement",
                    label: p.name || "Party statement",
                    entityId: p.id,
                  },
                ]);
              }, 0);
            },
          },
        ]}
        caption="Customers and suppliers"
      />

      <Dialog open={showForm} onOpenChange={(open) => !open && handleCloseForm()}>
        <DialogContent size="extra-large" showClose>
          <DialogHeader>
            <DialogTitle>{editingParty ? "Edit Party" : "New Party"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="p-0 px-0">
            <PartyForm
              partyId={editingParty?.id}
              prefillPhone={aiPrefill?.phone}
              focusPhone={aiPrefill?.focusPhone}
              onClose={handleCloseForm}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
