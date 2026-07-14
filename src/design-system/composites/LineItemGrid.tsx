import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../primitives/Button/Button";
import { IconButton } from "../primitives/IconButton/IconButton";
import { Input } from "../primitives/Input/Input";

export type LineItemRow = {
  id: string;
  itemLabel?: string;
  qty?: string;
  unit?: string;
  rate?: string;
  discPct?: string;
  tax?: string;
  amount?: string;
};

export interface LineItemGridProps {
  rows: LineItemRow[];
  onChangeRow?: (id: string, patch: Partial<LineItemRow>) => void;
  onAddRow?: () => void;
  onDeleteRow?: (id: string) => void;
  readOnly?: boolean;
  className?: string;
  footer?: React.ReactNode;
}

/** Editable voucher line grid shell (IMPLEMENT_NOW §3.5) — Wave 0 API frozen. */
export function LineItemGrid({
  rows,
  onChangeRow,
  onAddRow,
  onDeleteRow,
  readOnly,
  className,
  footer,
}: LineItemGridProps) {
  return (
    <div className={cn("overflow-x-auto rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)]", className)}>
      <table className="min-w-[720px] w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[var(--ds-surface-muted)]">
            {["#", "Item", "Qty", "Unit", "Rate", "Disc%", "Tax", "Amount", ""].map((h) => (
              <th
                key={h || "actions"}
                className="px-2 py-2 text-left text-[12px] font-semibold text-[var(--ds-text-muted)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} className="h-9 border-b border-[var(--ds-border-subtle)]">
              <td className="px-2 text-[var(--ds-text-muted)]">{idx + 1}</td>
              <td className="px-1">
                <Input
                  inputSize="small"
                  value={row.itemLabel || ""}
                  readOnly={readOnly}
                  onChange={(e) => onChangeRow?.(row.id, { itemLabel: e.target.value })}
                />
              </td>
              {(
                [
                  ["qty", row.qty],
                  ["unit", row.unit],
                  ["rate", row.rate],
                  ["discPct", row.discPct],
                  ["tax", row.tax],
                  ["amount", row.amount],
                ] as const
              ).map(([key, val]) => (
                <td key={key} className="px-1">
                  <Input
                    inputSize="small"
                    amount={key !== "unit"}
                    value={val || ""}
                    readOnly={readOnly}
                    onChange={(e) => onChangeRow?.(row.id, { [key]: e.target.value })}
                  />
                </td>
              ))}
              <td className="px-1">
                {!readOnly && onDeleteRow ? (
                  <IconButton
                    aria-label="Remove line"
                    size="small"
                    variant="quiet"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => onDeleteRow(row.id)}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && onAddRow ? (
        <div className="border-t border-[var(--ds-border-subtle)] p-2">
          <Button variant="quiet" size="small" startIcon={<Plus className="h-3.5 w-3.5" />} onClick={onAddRow}>
            Add line
          </Button>
        </div>
      ) : null}
      {footer ? (
        <div className="sticky bottom-0 border-t border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
