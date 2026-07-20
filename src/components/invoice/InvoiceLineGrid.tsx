/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Invoice line-items table chrome + InvoiceLineItem rows (STEP 5.2).
 */

import React from "react";
import { Button } from "../ui";
import { Plus } from "lucide-react";
import InvoiceLineItem, { InvoiceLineState } from "./InvoiceLineItem";

interface InvoiceLineGridProps {
  lines: InvoiceLineState[];
  colspan: number;
  showWarehouse: boolean;
  moreColumns: boolean;
  rareColumns: boolean;
  showAdvanced: boolean;
  readOnly: boolean;
  lineType: "sales" | "purchase";
  onUpdateLine: (id: string, updates: Partial<InvoiceLineState>) => void;
  onRemoveLine: (id: string) => void;
  onAddLine: () => void;
  onShowAdvancedToggle: () => void;
  onRareColumnsToggle: () => void;
}

const InvoiceLineGrid: React.FC<InvoiceLineGridProps> = ({
  lines,
  colspan,
  showWarehouse,
  moreColumns,
  rareColumns,
  showAdvanced,
  readOnly,
  lineType,
  onUpdateLine,
  onRemoveLine,
  onAddLine,
  onShowAdvancedToggle,
  onRareColumnsToggle,
}) => {
  return (
    <div className="form-section mb-3">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="form-section-title mb-0 pb-0 border-0">Line Items</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={onShowAdvancedToggle}
            aria-pressed={showAdvanced}
            data-testid="invoice-show-advanced"
          >
            {showAdvanced ? "Hide advanced" : "Show advanced"}
          </Button>
          {showAdvanced ? (
            <Button
              variant="outline"
              size="xs"
              onClick={onRareColumnsToggle}
              aria-pressed={rareColumns}
            >
              {rareColumns ? "Hide line details" : "Line details"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="xs"
            onClick={onAddLine}
            disabled={readOnly}
            icon={<Plus className="h-3 w-3" />}
          >
            Add Line
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-[var(--ds-border-default)]">
        <table className="line-table">
          <thead className="bg-[var(--ds-surface-muted)] text-[10px] font-semibold text-[var(--ds-text-muted)] uppercase tracking-wide border-b border-[var(--ds-border-default)]">
            <tr>
              <th className="px-2 py-2 text-center">#</th>
              <th className="px-2 py-2 text-left">Item</th>
              {rareColumns ? <th className="px-2 py-2 text-left">HSN</th> : null}
              {rareColumns ? <th className="px-2 py-2 text-left">Description</th> : null}
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-left">Unit</th>
              <th className="px-2 py-2 text-right">Rate</th>
              {moreColumns ? <th className="px-2 py-2 text-right">Disc%</th> : null}
              {moreColumns ? <th className="px-2 py-2 text-right">Taxable</th> : null}
              {rareColumns ? <th className="px-2 py-2 text-center">Tax?</th> : null}
              {moreColumns ? <th className="px-2 py-2 text-right">VAT%</th> : null}
              {moreColumns ? <th className="px-2 py-2 text-right">VAT Amt</th> : null}
              <th className="px-2 py-2 text-right">Total</th>
              {rareColumns && showWarehouse ? (
                <th className="px-2 py-2 text-left">Warehouse</th>
              ) : null}
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <InvoiceLineItem
                key={l.id}
                line={l}
                lineNo={idx + 1}
                onUpdate={(u) => onUpdateLine(l.id, u)}
                onDelete={() => onRemoveLine(l.id)}
                onTabNext={() => {
                  if (idx === lines.length - 1) onAddLine();
                }}
                showWarehouse={showWarehouse}
                showOptionalCols={moreColumns}
                showRareCols={rareColumns}
                type={lineType}
                readOnly={readOnly}
              />
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={colspan} className="text-center py-6 text-[var(--ds-text-default)]">
                  No lines. Click “Add Line”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceLineGrid;
