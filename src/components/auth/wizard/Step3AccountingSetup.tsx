import React from "react";
import { Input, Label, FieldError, Checkbox, Alert } from "@/design-system";
import type { WizardStepProps } from "./wizardTypes";

export default function Step3AccountingSetup({ data, onChange, errors = {} }: WizardStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--ds-text-strong)]">Accounting foundation</h2>
        <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
          Base currency, calendar preference, and module features. Chart of accounts uses the existing Nepal NAS seeder
          when empty — this step does not invent account mappings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="wiz-currency">Currency</Label>
          <Input id="wiz-currency" value="NPR — Nepali Rupee (Rs.)" readOnly />
        </div>

        <div>
          <Label htmlFor="wiz-date-format">
            Default date format <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <select
            id="wiz-date-format"
            value={data.dateFormat || "BS"}
            onChange={(e) => onChange({ ...data, dateFormat: e.target.value })}
            className="ds-focus-ring h-[var(--ds-control-height)] w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-[var(--ds-control-inset-x)] text-[14px]"
          >
            <option value="BS">BS (Bikram Sambat)</option>
            <option value="AD">AD (Gregorian)</option>
          </select>
          <FieldError>{errors.dateFormat}</FieldError>
        </div>
      </div>

      <div className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-subtle)] p-4">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
          Module features
        </p>
        <div className="space-y-3">
          <Checkbox
            checked={data.enableStock}
            onCheckedChange={(v) => onChange({ ...data, enableStock: v === true })}
            label="Stock management"
            description="Inventory tracking and stock journals. Can be deferred; required before stock posting."
          />
          <Checkbox
            checked={data.enableCostCenter}
            onCheckedChange={(v) => onChange({ ...data, enableCostCenter: v === true })}
            label="Cost centre"
            description="Optional department/project expense tracking."
          />
          <Checkbox
            checked={data.enableBillWise}
            onCheckedChange={(v) => onChange({ ...data, enableBillWise: v === true })}
            label="Bill-wise tracking"
            description="Track receivables and payables by bill. Recommended for credit sales."
          />
        </div>
      </div>

      <Alert tone="info" title="Consequence">
        Changing date format later does not recalculate posted vouchers. Fiscal periods remain under company settings
        authority after activation.
      </Alert>
    </div>
  );
}
