import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, Label, FieldError, Alert } from "@/design-system";
import type { WizardStepProps } from "./wizardTypes";

function passwordStrength(
  password: string,
): { label: string; barClass: string; textClass: string; widthClass: string } | null {
  if (!password) return null;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 2)
    return {
      label: "Weak",
      barClass: "bg-[var(--ds-status-danger)]",
      textClass: "text-[var(--ds-status-danger)]",
      widthClass: "w-1/3",
    };
  if (score <= 3)
    return {
      label: "Fair",
      barClass: "bg-[var(--ds-status-warning)]",
      textClass: "text-[var(--ds-status-warning)]",
      widthClass: "w-[55%]",
    };
  if (score <= 4)
    return {
      label: "Good",
      barClass: "bg-[var(--ds-status-info)]",
      textClass: "text-[var(--ds-status-info)]",
      widthClass: "w-[77%]",
    };
  return {
    label: "Strong",
    barClass: "bg-[var(--ds-status-success)]",
    textClass: "text-[var(--ds-status-success)]",
    widthClass: "w-full",
  };
}

export default function Step4AdminAccount({ data, onChange, errors = {} }: WizardStepProps) {
  const [showPassword, setShowPassword] = useState({ password: false, confirm: false });
  const strength = passwordStrength(data.password);
  const set = <K extends keyof typeof data>(key: K, val: (typeof data)[K]) =>
    onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--ds-text-strong)]">Administrator and security</h2>
        <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
          Creates the first administrator through existing user authority. Additional users are managed after activation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="wiz-fullname">
            Full name <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <Input
            id="wiz-fullname"
            value={data.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            invalid={Boolean(errors.fullName)}
            autoComplete="name"
          />
          <FieldError>{errors.fullName}</FieldError>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="wiz-username">
            Username <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <Input
            id="wiz-username"
            value={data.username}
            onChange={(e) => set("username", e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
            invalid={Boolean(errors.username)}
            autoComplete="username"
            minLength={4}
          />
          <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">Alphanumeric, minimum 4 characters.</p>
          <FieldError>{errors.username}</FieldError>
        </div>

        <div>
          <Label htmlFor="wiz-password">
            Password <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <div className="relative">
            <Input
              id="wiz-password"
              type={showPassword.password ? "text" : "password"}
              value={data.password}
              onChange={(e) => set("password", e.target.value)}
              invalid={Boolean(errors.password)}
              autoComplete="new-password"
              className="pr-11"
            />
            <button
              type="button"
              className="ds-focus-ring absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--ds-radius-sm)] text-[var(--ds-text-muted)]"
              aria-label={showPassword.password ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => ({ ...s, password: !s.password }))}
            >
              {showPassword.password ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          {strength ? (
            <div className="mt-1.5">
              <div className="h-1 overflow-hidden rounded-full bg-[var(--ds-surface-muted)]">
                <div
                  className={`h-1 rounded-full transition-[width] duration-[var(--ds-duration-normal)] ${strength.barClass} ${strength.widthClass}`}
                />
              </div>
              <p className={`mt-0.5 text-[13px] ${strength.textClass}`}>
                Password strength: {strength.label}
              </p>
            </div>
          ) : null}
          <FieldError>{errors.password}</FieldError>
        </div>

        <div>
          <Label htmlFor="wiz-confirm">
            Confirm password <span className="text-[var(--ds-status-danger)]">*</span>
          </Label>
          <div className="relative">
            <Input
              id="wiz-confirm"
              type={showPassword.confirm ? "text" : "password"}
              value={data.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              invalid={Boolean(errors.confirmPassword)}
              autoComplete="new-password"
              className="pr-11"
            />
            <button
              type="button"
              className="ds-focus-ring absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--ds-radius-sm)] text-[var(--ds-text-muted)]"
              aria-label={showPassword.confirm ? "Hide confirm password" : "Show confirm password"}
              onClick={() => setShowPassword((s) => ({ ...s, confirm: !s.confirm }))}
            >
              {showPassword.confirm ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          {data.confirmPassword && data.password === data.confirmPassword && !errors.confirmPassword ? (
            <p className="mt-1 text-[13px] text-[var(--ds-status-success)]">Passwords match</p>
          ) : null}
          <FieldError>{errors.confirmPassword}</FieldError>
        </div>
      </div>

      <Alert tone="info" title="Access note">
        This account receives full administrator access for this company. Passwords are never restored from setup drafts.
      </Alert>
    </div>
  );
}
