import React from "react";
import { Input, Label, FieldError, Alert } from "@/design-system";
import type { WizardStepProps } from "./wizardTypes";

const NEPAL_PROVINCES = [
  "Koshi Province (Province 1)",
  "Madhesh Province",
  "Bagmati Province",
  "Gandaki Province",
  "Lumbini Province",
  "Karnali Province",
  "Sudurpashchim Province",
];

export default function Step1CompanyProfile({ data, onChange, errors = {} }: WizardStepProps) {
  const set = <K extends keyof typeof data>(key: K, val: (typeof data)[K]) =>
    onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--ds-text-strong)]">Company identity</h2>
        <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
          Legal and display details for Nepal business registration.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="wiz-company-en">
            Company name (English) <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <Input
            id="wiz-company-en"
            value={data.companyNameEn}
            onChange={(e) => set("companyNameEn", e.target.value)}
            invalid={Boolean(errors.companyNameEn)}
            autoComplete="organization"
          />
          <FieldError>{errors.companyNameEn}</FieldError>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="wiz-company-ne">Company name (Nepali)</Label>
          <Input
            id="wiz-company-ne"
            value={data.companyNameNe}
            onChange={(e) => set("companyNameNe", e.target.value)}
            lang="ne"
            placeholder="कम्पनी नाम"
          />
        </div>

        <div>
          <Label htmlFor="wiz-business-type">
            Business type <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <select
            id="wiz-business-type"
            value={data.businessType}
            onChange={(e) => set("businessType", e.target.value)}
            aria-invalid={Boolean(errors.businessType) || undefined}
            className="ds-focus-ring h-[var(--ds-control-height)] w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-[var(--ds-control-inset-x)] text-[14px]"
          >
            <option value="">— Select —</option>
            <option value="Sole Proprietorship">Sole Proprietorship</option>
            <option value="Partnership">Partnership</option>
            <option value="Pvt. Ltd.">Pvt. Ltd.</option>
            <option value="Public Ltd.">Public Ltd.</option>
            <option value="Other">Other</option>
          </select>
          <FieldError>{errors.businessType}</FieldError>
        </div>

        <div>
          <Label htmlFor="wiz-province">Province</Label>
          <select
            id="wiz-province"
            value={data.province}
            onChange={(e) => onChange({ ...data, province: e.target.value, district: "" })}
            className="ds-focus-ring h-[var(--ds-control-height)] w-full rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-[var(--ds-control-inset-x)] text-[14px]"
          >
            <option value="">— Select —</option>
            {NEPAL_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="wiz-address">
            Address <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <Input
            id="wiz-address"
            value={data.address}
            onChange={(e) => set("address", e.target.value)}
            invalid={Boolean(errors.address)}
            autoComplete="street-address"
          />
          <FieldError>{errors.address}</FieldError>
        </div>

        <div>
          <Label htmlFor="wiz-city">
            City <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <Input
            id="wiz-city"
            value={data.city}
            onChange={(e) => set("city", e.target.value)}
            invalid={Boolean(errors.city)}
            autoComplete="address-level2"
          />
          <FieldError>{errors.city}</FieldError>
        </div>

        <div>
          <Label htmlFor="wiz-district">District</Label>
          <Input id="wiz-district" value={data.district} onChange={(e) => set("district", e.target.value)} />
        </div>

        <div>
          <Label htmlFor="wiz-phone">
            Phone <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <Input
            id="wiz-phone"
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
            invalid={Boolean(errors.phone)}
            autoComplete="tel"
          />
          <FieldError>{errors.phone}</FieldError>
        </div>

        <div>
          <Label htmlFor="wiz-email">
            Email <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <Input
            id="wiz-email"
            type="email"
            value={data.email}
            onChange={(e) => set("email", e.target.value)}
            invalid={Boolean(errors.email)}
            autoComplete="email"
          />
          <FieldError>{errors.email}</FieldError>
        </div>

        <div>
          <Label htmlFor="wiz-website">Website</Label>
          <Input
            id="wiz-website"
            type="url"
            value={data.website}
            onChange={(e) => set("website", e.target.value)}
            autoComplete="url"
          />
        </div>
      </div>

      <Alert tone="info" title="Required fields">
        Items marked * must be completed before continuing. Currency remains NPR for Nepal-first companies.
      </Alert>
    </div>
  );
}
