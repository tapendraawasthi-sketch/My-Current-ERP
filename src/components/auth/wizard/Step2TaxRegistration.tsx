import React from "react";
import { Input, Label, FieldError, Checkbox, Alert } from "@/design-system";
import type { WizardStepProps } from "./wizardTypes";

export default function Step2TaxRegistration({ data, onChange, errors = {} }: WizardStepProps) {
  const set = <K extends keyof typeof data>(key: K, val: (typeof data)[K]) =>
    onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--ds-text-strong)]">Fiscal and tax</h2>
        <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
          IRD registration and fiscal-year context. These choices affect VAT reports and period controls.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="wiz-pan">
            PAN / VAT registration number <span className="text-[var(--ds-status-danger)]">*</span>
            <span className="ml-2 font-normal text-[var(--ds-text-muted)]">
              ({data.panNumber.length}/9 digits)
            </span>
          </Label>
          <Input
            id="wiz-pan"
            inputMode="numeric"
            maxLength={9}
            value={data.panNumber}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              onChange({
                ...data,
                panNumber: v,
                vatNumber: data.hasVAT ? v : data.vatNumber,
              });
            }}
            invalid={Boolean(errors.panNumber)}
          />
          <FieldError>{errors.panNumber}</FieldError>
          {/^\d{9}$/.test(data.panNumber) && !errors.panNumber ? (
            <p className="mt-1 text-[13px] text-[var(--ds-status-success)]">Valid PAN format</p>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={data.hasVAT}
              onCheckedChange={(checked) =>
                onChange({
                  ...data,
                  hasVAT: Boolean(checked),
                  vatNumber: checked ? data.panNumber : "",
                })
              }
            />
            <span className="text-[14px] font-medium text-[var(--ds-text-default)]">VAT registered</span>
          </label>
        </div>

        {data.hasVAT ? (
          <div className="md:col-span-2 pl-1">
            <Label htmlFor="wiz-vat">VAT registration number</Label>
            <Input id="wiz-vat" value={data.vatNumber} readOnly />
            <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">Uses the same 9-digit PAN when registered.</p>
          </div>
        ) : null}

        <div>
          <Label htmlFor="wiz-ird">
            IRD office province <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <select
            id="wiz-ird"
            value={data.irdProvince}
            onChange={(e) => set("irdProvince", e.target.value)}
            className="ds-focus-ring h-[var(--ds-control-height)] w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-[var(--ds-control-inset-x)] text-[14px]"
          >
            <option value="">— Select —</option>
            <option value="Koshi">Koshi Province</option>
            <option value="Madhesh">Madhesh Province</option>
            <option value="Bagmati">Bagmati Province</option>
            <option value="Gandaki">Gandaki Province</option>
            <option value="Lumbini">Lumbini Province</option>
            <option value="Karnali">Karnali Province</option>
            <option value="Sudurpashchim">Sudurpashchim Province</option>
          </select>
          <FieldError>{errors.irdProvince}</FieldError>
        </div>

        <div>
          <Label htmlFor="wiz-fy">
            Fiscal year <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <select
            id="wiz-fy"
            value={data.fiscalYear}
            onChange={(e) => set("fiscalYear", e.target.value)}
            className="ds-focus-ring h-[var(--ds-control-height)] w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-[var(--ds-control-inset-x)] text-[14px]"
          >
            <option value="">— Select —</option>
            <option value="2080/81">2080/81 (BS)</option>
            <option value="2081/82">2081/82 (BS)</option>
            <option value="2082/83">2082/83 (BS)</option>
            <option value="2083/84">2083/84 (BS)</option>
            <option value="2084/85">2084/85 (BS)</option>
            <option value="2085/86">2085/86 (BS)</option>
          </select>
          <FieldError>{errors.fiscalYear}</FieldError>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="wiz-ird-office">IRD tax office branch (optional)</Label>
          <Input
            id="wiz-ird-office"
            value={data.irdOfficeName}
            onChange={(e) => set("irdOfficeName", e.target.value)}
          />
        </div>
      </div>

      <Alert tone="warning" title="Nepal VAT threshold">
        Annual turnover above Rs. 50 lakh may require mandatory VAT registration under Nepal tax rules. Confirm with
        your tax advisor before activating VAT posting.
      </Alert>
    </div>
  );
}
