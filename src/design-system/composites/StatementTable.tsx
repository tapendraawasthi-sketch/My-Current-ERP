import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAmountCell } from "../primitives/DataTable/EnterpriseDataTable";

export type StatementRowType = "section" | "group" | "leaf" | "subtotal" | "grand" | "diff";

export type StatementRow = {
  id: string;
  type: StatementRowType;
  label: string;
  indent?: number;
  amount?: number | null;
  amount2?: number | null;
  expanded?: boolean;
  hasChildren?: boolean;
};

export interface StatementTableProps {
  rows: StatementRow[];
  onToggle?: (id: string) => void;
  onDrill?: (id: string) => void;
  comparative?: boolean;
  className?: string;
}

/** Financial statement table row renderer (IMPLEMENT_NOW §3.7). */
export function StatementTable({
  rows,
  onToggle,
  onDrill,
  comparative,
  className,
}: StatementTableProps) {
  const amount = (n: number | null | undefined) => {
    if (n == null || n === 0) return "—";
    return `Rs. ${formatAmountCell(n)}`;
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[var(--ds-surface-muted)]">
            <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-[var(--ds-text-muted)]">
              Particulars
            </th>
            <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-[var(--ds-text-muted)]">
              Amount (Rs.)
            </th>
            {comparative ? (
              <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-[var(--ds-text-muted)]">
                Previous (Rs.)
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pad = (row.indent || 0) * 16;
            const isBand = row.type === "section";
            const isSub = row.type === "subtotal";
            const isGrand = row.type === "grand";
            const isDiff = row.type === "diff";
            const isGroup = row.type === "group";
            return (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-[var(--ds-border-subtle)]",
                  isBand && "bg-[var(--ds-surface-muted)]",
                  isSub && "bg-[var(--ds-surface-muted)] border-t border-[var(--ds-border-strong)]",
                  isGrand &&
                    "bg-[var(--ds-brand-50)] border-t-2 border-[var(--ds-action-primary)] font-bold",
                  isDiff && "bg-[var(--ds-status-danger-surface)]",
                  row.type === "leaf" && "hover:bg-[var(--ds-surface-hover)] cursor-pointer",
                )}
                onClick={() => {
                  if (isGroup && row.hasChildren) onToggle?.(row.id);
                  if (row.type === "leaf") onDrill?.(row.id);
                }}
              >
                <td
                  className={cn(
                    "px-3 py-2 text-[var(--ds-text-default)]",
                    (isBand || isGroup || isSub || isGrand) && "font-semibold text-[var(--ds-text-strong)]",
                    pad === 0 && "pl-3",
                    pad === 16 && "pl-7",
                    pad === 32 && "pl-11",
                    pad === 48 && "pl-14",
                    pad >= 64 && "pl-16",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {isGroup && row.hasChildren ? (
                      row.expanded ? (
                        <ChevronDown className="h-4 w-4 text-[var(--ds-text-muted)]" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[var(--ds-text-muted)]" aria-hidden />
                      )
                    ) : null}
                    {row.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--ds-text-default)]">
                  {amount(row.amount)}
                </td>
                {comparative ? (
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--ds-text-muted)]">
                    {amount(row.amount2)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
