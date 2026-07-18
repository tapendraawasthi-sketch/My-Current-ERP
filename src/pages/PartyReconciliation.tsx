import React, { useMemo, useState } from "react";
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  FileText,
  Printer,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import * as XLSX from "xlsx";
import { useBranchFilter } from "@/hooks/useBranchFilter";

interface PartyOutstanding {
  partyId: string;
  partyName: string;
  partyType: "customer" | "vendor";
  panNo: string;
  phone: string;
  invoices: OutstandingInvoice[];
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  overdueAmount: number;
  creditDays: number;
}

interface OutstandingInvoice {
  invoiceId: string;
  invoiceNo: string;
  date: string;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  isOverdue: boolean;
  daysOverdue: number;
  status: "unpaid" | "partial" | "paid";
}

interface ReconciliationEntry {
  id: string;
  partyId: string;
  date: string;
  description: string;
  ourBalance: number;
  partyBalance: number;
  difference: number;
  status: "matched" | "unmatched" | "disputed";
  notes: string;
}

const RECON_KEY = "sutra_reconciliation";

function readReconciliation(): ReconciliationEntry[] {
  try {
    const raw = localStorage.getItem(RECON_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReconciliation(entries: ReconciliationEntry[]): void {
  try {
    localStorage.setItem(RECON_KEY, JSON.stringify(entries));
  } catch {
    // no-op
  }
}

function text(value: any): string {
  return String(value ?? "");
}

function lower(value: any): string {
  return text(value).toLowerCase();
}

function money(value: number): string {
  return Number(value || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) return dateStr || "";
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function diffDays(from: string, to: Date): number {
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return 0;
  d.setHours(0, 0, 0, 0);
  const t = new Date(to);
  t.setHours(0, 0, 0, 0);
  return Math.floor((t.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function isCustomerAccount(account: any): boolean {
  const group = lower(account?.group ?? account?.groupName ?? account?.parentName);
  return group.includes("debtor") || group.includes("sundry debtor") || group.includes("customer");
}

function isVendorAccount(account: any): boolean {
  const group = lower(account?.group ?? account?.groupName ?? account?.parentName);
  return (
    group.includes("creditor") ||
    group.includes("sundry creditor") ||
    group.includes("vendor") ||
    group.includes("supplier")
  );
}

function invoicePartyId(inv: any): string {
  return text(
    inv?.partyId ?? inv?.accountId ?? inv?.ledgerId ?? inv?.customerId ?? inv?.supplierId,
  );
}

function invoicePartyName(inv: any): string {
  return text(
    inv?.partyName ?? inv?.accountName ?? inv?.ledgerName ?? inv?.customerName ?? inv?.supplierName,
  );
}

function invoiceNo(inv: any): string {
  return text(inv?.invoiceNo ?? inv?.voucherNo ?? inv?.no ?? inv?.id);
}

function invoiceAmount(inv: any): number {
  return Number(inv?.grandTotal ?? inv?.totalAmount ?? inv?.amount ?? 0);
}

function invoicePaid(inv: any): number {
  return Number(inv?.paidAmount ?? inv?.receivedAmount ?? inv?.settledAmount ?? 0);
}

function invoiceBalance(inv: any): number {
  const explicit = inv?.balanceAmount ?? inv?.outstandingAmount;
  if (explicit !== undefined && explicit !== null) return Math.max(0, Number(explicit || 0));
  return Math.max(0, invoiceAmount(inv) - invoicePaid(inv));
}

function isInvoicePaid(inv: any): boolean {
  return lower(inv?.paymentStatus) === "paid" || invoiceBalance(inv) <= 0;
}

function statusForInvoice(inv: any): "unpaid" | "partial" | "paid" {
  if (isInvoicePaid(inv)) return "paid";
  if (invoicePaid(inv) > 0) return "partial";
  return "unpaid";
}

function computeOutstanding(accounts: any[], vouchers: any[], invoices: any[]): PartyOutstanding[] {
  try {
    const partyAccounts = (accounts ?? []).filter(
      (acc) => isCustomerAccount(acc) || isVendorAccount(acc),
    );

    const map = new Map<string, PartyOutstanding>();

    for (const acc of partyAccounts) {
      const partyId = text(acc?.id);
      if (!partyId) continue;

      const partyType: "customer" | "vendor" = isVendorAccount(acc) ? "vendor" : "customer";

      map.set(partyId, {
        partyId,
        partyName: text(acc?.name ?? "Unnamed Party"),
        partyType,
        panNo: text(acc?.pan ?? acc?.panNo ?? acc?.vatNumber),
        phone: text(acc?.phone ?? acc?.mobile),
        invoices: [],
        totalDebit: 0,
        totalCredit: 0,
        netBalance: 0,
        overdueAmount: 0,
        creditDays: Number(acc?.creditDays ?? 30),
      });
    }

    for (const inv of invoices ?? []) {
      const pId = invoicePartyId(inv);
      const pName = invoicePartyName(inv);

      let party = pId ? map.get(pId) : undefined;

      if (!party && pName) {
        party = Array.from(map.values()).find((x) => lower(x.partyName) === lower(pName));
      }

      if (!party && (pId || pName)) {
        const fallbackId = pId || pName;
        party = {
          partyId: fallbackId,
          partyName: pName || fallbackId,
          partyType: lower(inv?.type).includes("purchase") ? "vendor" : "customer",
          panNo: text(inv?.partyPan ?? inv?.pan),
          phone: text(inv?.phone),
          invoices: [],
          totalDebit: 0,
          totalCredit: 0,
          netBalance: 0,
          overdueAmount: 0,
          creditDays: Number(inv?.creditDays ?? 30),
        };
        map.set(fallbackId, party);
      }

      if (!party) continue;

      const originalAmount = invoiceAmount(inv);
      const paidAmount = invoicePaid(inv);
      const balanceAmount = invoiceBalance(inv);

      const baseDate = text(
        inv?.date ?? inv?.invoiceDate ?? new Date().toISOString().split("T")[0],
      );
      const dueDate = text(inv?.dueDate) || addDays(baseDate, party.creditDays);
      const daysOverdue = Math.max(0, diffDays(dueDate, new Date()));
      const isOverdue = balanceAmount > 0 && daysOverdue > 0;

      const row: OutstandingInvoice = {
        invoiceId: text(inv?.id ?? invoiceNo(inv)),
        invoiceNo: invoiceNo(inv),
        date: text(inv?.dateNepali ?? inv?.bsDate ?? baseDate),
        dueDate: text(inv?.dueDateNepali ?? inv?.dueDateBS ?? dueDate),
        originalAmount,
        paidAmount,
        balanceAmount,
        isOverdue,
        daysOverdue,
        status: statusForInvoice(inv),
      };

      party.invoices.push(row);
      if (isOverdue) party.overdueAmount += balanceAmount;
    }

    for (const voucher of vouchers ?? []) {
      const lines = Array.isArray(voucher?.lines) ? voucher.lines : [];

      for (const line of lines) {
        const accountId = text(line?.accountId ?? line?.ledgerId);
        const accountName = text(line?.accountName ?? line?.ledgerName);

        let party = accountId ? map.get(accountId) : undefined;

        if (!party && accountName) {
          party = Array.from(map.values()).find((x) => lower(x.partyName) === lower(accountName));
        }

        if (!party) continue;

        party.totalDebit += Number(line?.debit ?? line?.dr ?? 0);
        party.totalCredit += Number(line?.credit ?? line?.cr ?? 0);
      }
    }

    for (const party of map.values()) {
      if (party.totalDebit === 0 && party.totalCredit === 0) {
        const invoiceBalanceSum = party.invoices.reduce((s, inv) => s + inv.balanceAmount, 0);
        if (party.partyType === "customer") {
          party.totalDebit = invoiceBalanceSum;
        } else {
          party.totalCredit = invoiceBalanceSum;
        }
      }

      party.netBalance = party.totalDebit - party.totalCredit;
    }

    return Array.from(map.values()).sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
  } catch {
    return [];
  }
}

function statusBadge(party: PartyOutstanding) {
  if (party.overdueAmount > 0) {
    return (
      <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold uppercase">
        Overdue
      </span>
    );
  }

  if (party.netBalance > 0) {
    return (
      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase">
        Outstanding
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-semibold uppercase">
      Clear
    </span>
  );
}

function reconciliationStatusBadge(status: ReconciliationEntry["status"]) {
  if (status === "matched") {
    return (
      <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-semibold uppercase">
        Matched
      </span>
    );
  }

  if (status === "disputed") {
    return (
      <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold uppercase">
        Disputed
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase">
      Unmatched
    </span>
  );
}

export default function PartyReconciliation() {
  const store = useStore() as any;
  const accounts = store.accounts ?? [];
  const vouchers = store.vouchers ?? [];
  const invoices = store.invoices ?? [];
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();

  const [selectedParty, setSelectedParty] = useState("");
  const [partyType, setPartyType] = useState<"ALL" | "customer" | "vendor">("ALL");
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<"outstanding" | "reconcile" | "statement">(
    "outstanding",
  );
  const [reconciliationEntries, setReconciliationEntries] = useState<ReconciliationEntry[]>(() =>
    readReconciliation(),
  );
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<ReconciliationEntry>>({});
  const [expandedParty, setExpandedParty] = useState<string | null>(null);
  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState("");

  const scopedVouchers = useMemo(
    () => vouchers.filter((v: any) => matchBranch(v?.branchId)),
    [vouchers, matchBranch, branchFilter],
  );
  const scopedInvoices = useMemo(
    () => invoices.filter((inv: any) => matchBranch(inv?.branchId)),
    [invoices, matchBranch, branchFilter],
  );

  const outstanding = useMemo(
    () => computeOutstanding(accounts, scopedVouchers, scopedInvoices),
    [accounts, scopedVouchers, scopedInvoices],
  );

  const filteredOutstanding = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return outstanding.filter((party) => {
      if (partyType !== "ALL" && party.partyType !== partyType) return false;
      if (
        q &&
        !party.partyName.toLowerCase().includes(q) &&
        !party.panNo.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [outstanding, partyType, searchText]);

  const selectedPartyRow = useMemo(
    () => outstanding.find((x) => x.partyId === selectedParty),
    [outstanding, selectedParty],
  );

  const summary = useMemo(() => {
    const customersOutstanding = outstanding
      .filter((p) => p.partyType === "customer")
      .reduce((s, p) => s + Math.max(0, p.netBalance), 0);

    const vendorsOutstanding = outstanding
      .filter((p) => p.partyType === "vendor")
      .reduce((s, p) => s + Math.abs(Math.min(0, p.netBalance)), 0);

    const totalOverdue = outstanding.reduce((s, p) => s + p.overdueAmount, 0);
    const partiesWithOverdue = outstanding.filter((p) => p.overdueAmount > 0).length;

    return { customersOutstanding, vendorsOutstanding, totalOverdue, partiesWithOverdue };
  }, [outstanding]);

  const exportOutstanding = () => {
    const rows = filteredOutstanding.map((p) => ({
      "Party Name": p.partyName,
      "PAN No": p.panNo,
      "Total Outstanding": p.netBalance,
      Overdue: p.overdueAmount,
      "Credit Days": p.creditDays,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Party Outstanding");
    XLSX.writeFile(wb, "party_outstanding.xlsx");
  };

  const saveReconEntry = () => {
    if (!newEntry.partyId) {
      alert("Please select party");
      return;
    }

    const ourBalance = Number(newEntry.ourBalance ?? 0);
    const partyBalance = Number(newEntry.partyBalance ?? 0);

    const entry: ReconciliationEntry = {
      id: crypto.randomUUID(),
      partyId: String(newEntry.partyId),
      date: String(newEntry.date || new Date().toISOString().split("T")[0]),
      description: String(newEntry.description || ""),
      ourBalance,
      partyBalance,
      difference: ourBalance - partyBalance,
      status: (newEntry.status as ReconciliationEntry["status"]) || "unmatched",
      notes: String(newEntry.notes || ""),
    };

    const next = [entry, ...reconciliationEntries];
    setReconciliationEntries(next);
    writeReconciliation(next);
    setNewEntry({});
    setShowAddEntry(false);
  };

  const statementRows = useMemo(() => {
    if (!selectedPartyRow) return [];

    const rows: {
      id: string;
      date: string;
      type: string;
      no: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    }[] = [];

    for (const inv of selectedPartyRow.invoices) {
      rows.push({
        id: inv.invoiceId,
        date: inv.date,
        type: "Invoice",
        no: inv.invoiceNo,
        description: `Invoice ${inv.invoiceNo}`,
        debit: selectedPartyRow.partyType === "customer" ? inv.originalAmount : 0,
        credit: selectedPartyRow.partyType === "vendor" ? inv.originalAmount : inv.paidAmount,
        balance: 0,
      });
    }

    for (const voucher of scopedVouchers ?? []) {
      const lines = Array.isArray(voucher?.lines) ? voucher.lines : [];

      for (const line of lines) {
        const accountId = text(line?.accountId ?? line?.ledgerId);
        const accountName = text(line?.accountName ?? line?.ledgerName);

        if (
          accountId !== selectedPartyRow.partyId &&
          lower(accountName) !== lower(selectedPartyRow.partyName)
        ) {
          continue;
        }

        rows.push({
          id: `${voucher?.id}-${line?.id ?? Math.random()}`,
          date: text(voucher?.dateNepali ?? voucher?.date),
          type: text(voucher?.type ?? "Voucher"),
          no: text(voucher?.voucherNo ?? voucher?.invoiceNo ?? voucher?.no),
          description: text(voucher?.narration ?? line?.narration),
          debit: Number(line?.debit ?? 0),
          credit: Number(line?.credit ?? 0),
          balance: 0,
        });
      }
    }

    const filtered = rows.filter((row) => {
      if (statementFrom && row.date < statementFrom) return false;
      if (statementTo && row.date > statementTo) return false;
      return true;
    });

    filtered.sort((a, b) => a.date.localeCompare(b.date));

    let running = 0;
    return filtered.map((row) => {
      running += row.debit - row.credit;
      return { ...row, balance: running };
    });
  }, [selectedPartyRow, scopedVouchers, statementFrom, statementTo]);

  return (
    <div className="p-6 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">
            Party Reconciliation & Outstanding
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Reconcile customer and vendor balances, track overdue payments
          </p>
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
            onClick={exportOutstanding}
            className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-4 no-print">
        {[
          ["outstanding", "Outstanding List"],
          ["reconcile", "Reconciliation"],
          ["statement", "Party Statement"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as any)}
            className={
              activeTab === key
                ? "px-4 py-2 border-b-2 border-[var(--ds-action-primary)] text-[var(--ds-action-primary)] text-[12px] font-medium"
                : "px-4 py-2 text-gray-500 text-[12px] hover:text-gray-700"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "outstanding" && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-wrap gap-3 items-center no-print">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search party / PAN..."
                className="h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-64"
              />
            </div>

            <div className="flex gap-1">
              {(["ALL", "customer", "vendor"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPartyType(t)}
                  className={
                    partyType === t
                      ? "h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] rounded-md"
                      : "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50"
                  }
                >
                  {t === "ALL" ? "All" : t === "customer" ? "Customer" : "Vendor"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-[11px] text-gray-500">Total Customers Outstanding</p>
              <p className="text-[20px] font-semibold text-[var(--ds-action-primary)] mt-1">
                {money(summary.customersOutstanding)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-[11px] text-gray-500">Total Vendors Outstanding</p>
              <p className="text-[20px] font-semibold text-orange-700 mt-1">
                {money(summary.vendorsOutstanding)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-[11px] text-gray-500">Total Overdue</p>
              <p className="text-[20px] font-semibold text-red-700 mt-1">
                {money(summary.totalOverdue)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-[11px] text-gray-500">Parties with Overdue</p>
              <p className="text-[20px] font-semibold text-amber-700 mt-1">
                {summary.partiesWithOverdue}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filteredOutstanding.length === 0 ? (
              <div className="py-14 text-center">
                <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-[12px] text-gray-400">No outstanding parties found</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    {[
                      "Party Name",
                      "PAN",
                      "Type",
                      "Total Dr",
                      "Total Cr",
                      "Net Balance",
                      "Overdue",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredOutstanding.map((party) => (
                    <React.Fragment key={party.partyId}>
                      <tr
                        onClick={() =>
                          setExpandedParty(expandedParty === party.partyId ? null : party.partyId)
                        }
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                          {party.partyName}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {party.panNo || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">
                          {party.partyType}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                          {money(party.totalDebit)}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                          {money(party.totalCredit)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-[12px] font-mono text-right font-semibold ${
                            party.netBalance >= 0 ? "text-[var(--ds-action-primary)]" : "text-orange-700"
                          }`}
                        >
                          {money(Math.abs(party.netBalance))} {party.netBalance >= 0 ? "Dr" : "Cr"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-right">
                          {party.overdueAmount > 0 ? (
                            <span className="font-mono font-bold text-red-700">
                              {money(party.overdueAmount)}
                            </span>
                          ) : (
                            <span className="text-green-700">Nil</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">{statusBadge(party)}</td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedParty(party.partyId);
                              setActiveTab("statement");
                            }}
                            className="h-7 px-2 bg-white border border-gray-300 text-gray-700 text-[11px] rounded hover:bg-gray-50"
                          >
                            View Statement
                          </button>
                        </td>
                      </tr>

                      {expandedParty === party.partyId && (
                        <tr>
                          <td colSpan={9} className="p-3 bg-gray-50">
                            <table className="w-full border-collapse bg-white border border-gray-200">
                              <thead>
                                <tr className="bg-[#f5f6fa]">
                                  {[
                                    "Invoice No",
                                    "Date",
                                    "Due Date",
                                    "Original Amt",
                                    "Paid Amt",
                                    "Balance",
                                    "Days Overdue",
                                    "Status",
                                  ].map((h) => (
                                    <th
                                      key={h}
                                      className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {party.invoices.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={8}
                                      className="px-3 py-4 text-center text-[12px] text-gray-400"
                                    >
                                      No invoice breakdown available
                                    </td>
                                  </tr>
                                ) : (
                                  party.invoices.map((inv) => (
                                    <tr
                                      key={inv.invoiceId}
                                      className={`border-b border-gray-100 ${
                                        inv.isOverdue
                                          ? "bg-red-50"
                                          : inv.status === "paid"
                                            ? "opacity-60"
                                            : ""
                                      }`}
                                    >
                                      <td className="px-3 py-2 text-[12px] text-gray-700 font-mono">
                                        {inv.invoiceNo}
                                      </td>
                                      <td className="px-3 py-2 text-[12px] text-gray-700">
                                        {inv.date}
                                      </td>
                                      <td className="px-3 py-2 text-[12px] text-gray-700">
                                        {inv.dueDate}
                                      </td>
                                      <td className="px-3 py-2 text-[12px] text-gray-700 font-mono text-right">
                                        {money(inv.originalAmount)}
                                      </td>
                                      <td className="px-3 py-2 text-[12px] text-gray-700 font-mono text-right">
                                        {money(inv.paidAmount)}
                                      </td>
                                      <td className="px-3 py-2 text-[12px] text-gray-700 font-mono text-right">
                                        {money(inv.balanceAmount)}
                                      </td>
                                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                                        {inv.daysOverdue}
                                      </td>
                                      <td className="px-3 py-2 text-[12px] text-gray-700 capitalize">
                                        {inv.status}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === "reconcile" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold text-gray-800">Reconciliation Entries</h2>
              <button
                type="button"
                onClick={() => setShowAddEntry(!showAddEntry)}
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
              >
                Add Entry
              </button>
            </div>

            {showAddEntry && (
              <div className="grid grid-cols-3 gap-3 mb-4 border border-gray-200 rounded-lg p-3 bg-[#f5f6fa]">
                <select
                  value={newEntry.partyId || ""}
                  onChange={(e) => setNewEntry({ ...newEntry, partyId: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
                >
                  <option value="">Select Party</option>
                  {outstanding.map((p) => (
                    <option key={p.partyId} value={p.partyId}>
                      {p.partyName}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={newEntry.date || ""}
                  onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
                />

                <input
                  placeholder="Description"
                  value={newEntry.description || ""}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
                />

                <input
                  type="number"
                  placeholder="Our Balance"
                  value={newEntry.ourBalance ?? ""}
                  onChange={(e) => setNewEntry({ ...newEntry, ourBalance: Number(e.target.value) })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white text-right"
                />

                <input
                  type="number"
                  placeholder="Party Balance"
                  value={newEntry.partyBalance ?? ""}
                  onChange={(e) =>
                    setNewEntry({ ...newEntry, partyBalance: Number(e.target.value) })
                  }
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white text-right"
                />

                <select
                  value={newEntry.status || "unmatched"}
                  onChange={(e) => setNewEntry({ ...newEntry, status: e.target.value as any })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
                >
                  <option value="matched">matched</option>
                  <option value="unmatched">unmatched</option>
                  <option value="disputed">disputed</option>
                </select>

                <textarea
                  placeholder="Notes"
                  value={newEntry.notes || ""}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  className="col-span-3 px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white"
                  rows={2}
                />

                <div className="col-span-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEntry(false)}
                    className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveReconEntry}
                    className="h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] rounded-md"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  {[
                    "Date",
                    "Party",
                    "Description",
                    "Our Balance",
                    "Party Balance",
                    "Difference",
                    "Status",
                    "Notes",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconciliationEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[12px] text-gray-400">
                      No reconciliation entries saved
                    </td>
                  </tr>
                ) : (
                  reconciliationEntries.map((entry) => {
                    const party = outstanding.find((p) => p.partyId === entry.partyId);
                    return (
                      <tr key={entry.id} className="border-b border-gray-100">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{entry.date}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {party?.partyName || entry.partyId}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {entry.description}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                          {money(entry.ourBalance)}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                          {money(entry.partyBalance)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-[12px] font-mono text-right ${Math.abs(entry.difference) > 0 ? "text-red-700 font-semibold" : "text-green-700"}`}
                        >
                          {money(entry.difference)}
                        </td>
                        <td className="px-3 py-2.5">{reconciliationStatusBadge(entry.status)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{entry.notes}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "statement" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="no-print flex flex-wrap gap-3 items-center mb-4">
            <select
              value={selectedParty}
              onChange={(e) => setSelectedParty(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-64"
            >
              <option value="">Select Party</option>
              {outstanding.map((p) => (
                <option key={p.partyId} value={p.partyId}>
                  {p.partyName}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={statementFrom}
              onChange={(e) => setStatementFrom(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
            />

            <input
              type="date"
              value={statementTo}
              onChange={(e) => setStatementTo(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
            />

            <button
              type="button"
              onClick={() => window.print()}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Statement
            </button>
          </div>

          {!selectedPartyRow ? (
            <div className="py-14 text-center">
              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-[12px] text-gray-400">Select a party to view statement</p>
            </div>
          ) : (
            <>
              <div className="mb-4 border-b border-gray-200 pb-3">
                <h2 className="text-[15px] font-semibold text-gray-800">
                  Party Statement: {selectedPartyRow.partyName}
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  PAN: {selectedPartyRow.panNo || "—"} | Type: {selectedPartyRow.partyType}
                </p>
              </div>

              <div className="mb-3 text-[12px] text-gray-700">
                Opening Balance: <span className="font-mono font-semibold">0.00</span>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    {["Date", "Type", "No", "Description", "Debit", "Credit", "Balance"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[12px] text-gray-400">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    statementRows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.date}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.type}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                          {row.no}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.description}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                          {row.debit ? money(row.debit) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                          {row.credit ? money(row.credit) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                          {money(row.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="mt-4 text-right text-[13px] font-semibold text-gray-800">
                Closing Balance:{" "}
                <span className="font-mono">
                  {money(
                    statementRows.length ? statementRows[statementRows.length - 1].balance : 0,
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
