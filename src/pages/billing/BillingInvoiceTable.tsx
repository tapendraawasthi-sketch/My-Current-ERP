import React from "react";
import { Eye, FileText, Plus, Printer, RefreshCw, Search } from "lucide-react";
import { DualDate } from "../../components/ui";
import { formatCurrency } from "../../lib/utils";
import { useStore } from "../../store/useStore";
import { Button, EmptyState } from "@/design-system";
import { paymentBadge, statusBadge } from "./badges";
import { th, td, TAB_META, type TabKey } from "./types";

type BillingRow = {
  id: string;
  invoiceNo?: string;
  date?: string;
  adDate?: string;
  dateNepali?: string;
  bsDate?: string;
  partyName?: string;
  grandTotal?: number;
  vatAmount?: number;
  paymentStatus?: string;
  status?: string;
  cbmsSubmitted?: boolean;
};

type Props = {
  tab: TabKey;
  rows: BillingRow[];
  displayed: BillingRow[];
  symbol: string;
  cbmsEnabled?: boolean;
  /** True when search/filters may be hiding rows (STEP 3.3). */
  hasActiveFilters?: boolean;
  onEdit: (row: BillingRow) => void;
  onPrint: (row: BillingRow) => void;
  onNew?: () => void;
  onClearFilters?: () => void;
};

export function BillingInvoiceTable({
  tab,
  rows,
  displayed,
  symbol,
  cbmsEnabled,
  hasActiveFilters,
  onEdit,
  onPrint,
  onNew,
  onClearFilters,
}: Props) {
  const meta = TAB_META[tab];

  if (rows.length === 0) {
    const searching = Boolean(hasActiveFilters);
    return (
      <div className="rounded-lg border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-2">
        <EmptyState
          icon={
            searching ? (
              <Search className="h-4 w-4" aria-hidden />
            ) : (
              <FileText className="h-4 w-4" aria-hidden />
            )
          }
          title={
            searching
              ? `No ${meta.label.toLowerCase()} match your filters`
              : `No ${meta.label.toLowerCase()} yet`
          }
          description={
            searching
              ? "Adjust dates, party, or search — or clear filters to see all invoices."
              : `Create your first ${meta.label.replace(/s$/, "").toLowerCase()} to start billing.`
          }
          primaryAction={
            searching ? (
              onClearFilters ? (
                <Button variant="secondary" size="small" onClick={onClearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            ) : onNew ? (
              <Button
                variant="primary"
                size="small"
                onClick={onNew}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                New {meta.label.replace(/s$/, "")}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
              <th className={th}>Invoice no</th>
              <th className={th}>Date</th>
              <th className={th}>Party</th>
              <th className={`${th} text-right`}>Grand total</th>
              <th className={`${th} text-right`}>VAT</th>
              <th className={`${th} text-center`}>Payment</th>
              <th className={`${th} text-center`}>Status</th>
              <th className={`${th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((row) => (
              <tr
                key={row.id}
                className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)]"
                onClick={() => onEdit(row)}
              >
                <td className={`${td} font-mono font-medium text-gray-700`}>{row.invoiceNo}</td>
                <td className={td}>
                  <DualDate
                    date={row.date || row.adDate}
                    dateNepali={row.dateNepali || row.bsDate}
                  />
                </td>
                <td className={td}>{row.partyName || "—"}</td>
                <td className={`${td} font-mono text-right font-medium`}>
                  {formatCurrency(row.grandTotal || 0, { symbol })}
                </td>
                <td className={`${td} font-mono text-right text-gray-500`}>
                  {formatCurrency(row.vatAmount || 0, { symbol })}
                </td>
                <td className={`${td} text-center`}>
                  <span
                    className={`rounded px-2 py-0.5 text-[12px] font-semibold uppercase ${paymentBadge(row.paymentStatus)}`}
                  >
                    {(row.paymentStatus || "").toUpperCase() || "—"}
                  </span>
                </td>
                <td className={`${td} text-center`}>
                  <span
                    className={`rounded px-2 py-0.5 text-[12px] font-semibold uppercase ${statusBadge(row.status)}`}
                  >
                    {(row.status || "").toUpperCase()}
                  </span>
                </td>
                <td className={`${td} text-right`}>
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {cbmsEnabled && !row.cbmsSubmitted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          (useStore.getState() as { retryCBMS?: (id: string) => void }).retryCBMS?.(
                            row.id,
                          );
                        }}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-amber-600 hover:bg-amber-50"
                        title="Retry CBMS sync"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(row);
                      }}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      title="View / edit"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrint(row);
                      }}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      title="Print"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t border-gray-200 bg-[var(--ds-surface-muted)] text-[12px] text-gray-500">
        Showing {displayed.length} of {rows.length} {meta.label.toLowerCase()}
      </div>
    </div>
  );
}
