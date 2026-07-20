/**
 * Print settings — Wave H/L / Function 21.
 * Prefs drive InvoicePrint + printUtils; showLogo also syncs to systemConfiguration.
 */
import React, { useEffect, useState } from "react";
import { Printer, Save } from "lucide-react";
import toast from "@/lib/appToast";
import { useStore } from "../store/useStore";
import { mergeSystemConfiguration } from "../lib/systemConfiguration";
import {
  DEFAULT_PRINT_PREFS,
  loadPrintPrefs,
  savePrintPrefs,
  type PrintPrefs,
} from "../lib/printPrefs";

export default function PrintSettings() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const companySettings = useStore((s) => s.companySettings);
  const updateCompanySettings = useStore((s) => s.updateCompanySettings);
  const companyName = companySettings?.companyNameEn || companySettings?.name || "Company";
  const [prefs, setPrefs] = useState<PrintPrefs>(loadPrintPrefs);

  useEffect(() => {
    setPrefs(loadPrintPrefs());
  }, []);

  const save = async () => {
    try {
      savePrintPrefs(prefs);
      const merged = mergeSystemConfiguration(companySettings?.systemConfiguration);
      await updateCompanySettings({
        systemConfiguration: {
          ...merged,
          invoicePrint: { ...merged.invoicePrint, showLogo: prefs.showLogo },
          voucherPrint: { ...merged.voucherPrint, showLogo: prefs.showLogo },
        },
      });
      toast.success("Print settings saved");
    } catch {
      toast.error("Could not save print settings");
    }
  };

  const field =
    "h-8 w-full rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 text-[12px] focus:border-[var(--ds-action-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20";

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--ds-text-default)] flex items-center gap-2">
            <Printer className="h-4 w-4 text-[var(--ds-action-primary)]" />
            Print settings
          </h1>
          <p className="text-[11px] text-[var(--ds-text-muted)] mt-0.5">
            Default page layout for invoices and vouchers · {companyName}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage("cheque-printing")}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50"
          >
            Cheque printing
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>

      <div className="rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4 max-w-xl space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--ds-text-muted)]">
              Page size
            </label>
            <select
              className={field}
              value={prefs.pageSize}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, pageSize: e.target.value as PrintPrefs["pageSize"] }))
              }
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="A5">A5</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--ds-text-muted)]">
              Orientation
            </label>
            <select
              className={field}
              value={prefs.orientation}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  orientation: e.target.value as PrintPrefs["orientation"],
                }))
              }
            >
              <option value="Portrait">Portrait</option>
              <option value="Landscape">Landscape</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[var(--ds-text-muted)]">
            Copies
          </label>
          <input
            type="number"
            min={1}
            max={9}
            className={field}
            value={prefs.copies}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                copies: Math.max(1, Math.min(9, Number(e.target.value) || 1)),
              }))
            }
          />
        </div>

        <div className="space-y-2 border-t border-[var(--ds-border-default)] pt-3">
          {(
            [
              ["showLogo", "Show company logo"],
              ["showNepali", "Show Nepali company name"],
              ["showPan", "Show PAN / VAT on headers"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 text-[12px] text-[var(--ds-text-default)]"
            >
              <input
                type="checkbox"
                className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                checked={prefs[key]}
                onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>

        <p className="text-[11px] text-[var(--ds-text-muted)]">
          Defaults: {DEFAULT_PRINT_PREFS.pageSize} · {DEFAULT_PRINT_PREFS.orientation}. Invoice
          preview and browser print honor these toggles immediately after Save.
        </p>
      </div>
    </div>
  );
}
