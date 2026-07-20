import React, { useEffect, useState } from "react";
import Step1CompanyProfile from "./wizard/Step1CompanyProfile";
import Step2TaxRegistration from "./wizard/Step2TaxRegistration";
import Step3AccountingSetup from "./wizard/Step3AccountingSetup";
import Step4AdminAccount from "./wizard/Step4AdminAccount";
import type { WizardForm } from "./wizard/wizardTypes";
import { useStore } from "@/store/useStore";
import { applyNatureToCompanySettings } from "@/lib/businessNature";
import { Button, ErrorSummary, StepProgress, Alert } from "@/design-system";
import { PreWorkspaceShell } from "./PreWorkspaceShell";

const RESUME_KEY = "orbix_onboarding_draft_v1";

const defaultForm: WizardForm = {
  companyNameEn: "",
  companyNameNe: "",
  businessType: "",
  businessNature: "",
  address: "",
  city: "",
  district: "",
  province: "",
  phone: "",
  email: "",
  website: "",
  panNumber: "",
  hasVAT: false,
  vatNumber: "",
  irdProvince: "",
  irdOfficeName: "",
  fiscalYear: "2083/84",
  dateFormat: "BS",
  enableStock: true,
  enableCostCenter: false,
  enableBillWise: true,
  fullName: "",
  username: "",
  password: "",
  confirmPassword: "",
};

function loadDraft(): { step: number; form: WizardForm } | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { step?: number; form?: Partial<WizardForm> };
    if (!parsed?.form) return null;
    return {
      step: Math.min(4, Math.max(1, parsed.step || 1)),
      form: { ...defaultForm, ...parsed.form, password: "", confirmPassword: "" },
    };
  } catch {
    return null;
  }
}

export default function SignUpWizard() {
  const { createCompanyAndAdmin } = useStore();
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.step || 1);
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<number, Record<string, string>>>({});
  const [formData, setFormData] = useState<WizardForm>(draft?.form || defaultForm);
  const [resumed, setResumed] = useState(Boolean(draft));

  const steps = [
    { id: 1, name: "Company identity", component: Step1CompanyProfile },
    { id: 2, name: "Fiscal & tax", component: Step2TaxRegistration },
    { id: 3, name: "Accounting", component: Step3AccountingSetup },
    { id: 4, name: "Admin & security", component: Step4AdminAccount },
  ];

  useEffect(() => {
    try {
      localStorage.setItem(
        RESUME_KEY,
        JSON.stringify({
          step: currentStep,
          form: { ...formData, password: "", confirmPassword: "" },
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {
      /* ignore */
    }
  }, [currentStep, formData]);

  const validateStep = (step: number): Record<string, string> => {
    const errors: Record<string, string> = {};
    switch (step) {
      case 1:
        if (!formData.companyNameEn.trim()) errors.companyNameEn = "Company name (English) is required";
        if (!formData.businessNature) errors.businessNature = "Business nature is required";
        if (!formData.businessType) errors.businessType = "Legal entity type is required";
        if (!formData.address.trim()) errors.address = "Address is required";
        if (!formData.city.trim()) errors.city = "City is required";
        if (!formData.phone.trim()) errors.phone = "Phone number is required";
        if (!formData.email.trim()) errors.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
          errors.email = "Enter a valid email address";
        break;
      case 2:
        if (!formData.panNumber) errors.panNumber = "PAN number is required";
        else if (!/^\d{9}$/.test(formData.panNumber)) errors.panNumber = "PAN must be exactly 9 digits";
        if (!formData.irdProvince) errors.irdProvince = "IRD Province is required";
        if (!formData.fiscalYear) errors.fiscalYear = "Fiscal year is required";
        break;
      case 3:
        if (!formData.dateFormat) errors.dateFormat = "Date format is required";
        break;
      case 4:
        if (!formData.fullName.trim()) errors.fullName = "Full name is required";
        if (!formData.username.trim()) errors.username = "Username is required";
        else if (!/^[a-zA-Z0-9]{4,}$/.test(formData.username))
          errors.username = "Username must be alphanumeric, min 4 characters";
        if (!formData.password) errors.password = "Password is required";
        else if (formData.password.length < 6) errors.password = "Password must be at least 6 characters";
        else if (!/[a-zA-Z]/.test(formData.password) || !/\d/.test(formData.password))
          errors.password = "Password must contain both letters and numbers";
        if (!formData.confirmPassword) errors.confirmPassword = "Please confirm your password";
        else if (formData.password !== formData.confirmPassword)
          errors.confirmPassword = "Passwords do not match";
        break;
    }
    return errors;
  };

  const handleNext = () => {
    const errors = validateStep(currentStep);
    if (Object.keys(errors).length > 0) {
      setStepErrors((prev) => ({ ...prev, [currentStep]: errors }));
      return;
    }
    setStepErrors((prev) => ({ ...prev, [currentStep]: {} }));
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleFinish = async () => {
    const errors = validateStep(4);
    if (Object.keys(errors).length > 0) {
      setStepErrors((prev) => ({ ...prev, [4]: errors }));
      return;
    }
    setSubmitError("");
    setSubmitLoading(true);
    try {
      const companyBase = {
        name: formData.companyNameEn,
        nameNepali: formData.companyNameNe,
        panNumber: formData.panNumber,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        vatNumber: formData.vatNumber,
        defaultCurrency: "NPR",
        currencySymbol: "Rs.",
        defaultDateFormat: formData.dateFormat as "BS" | "AD",
        fiscalYearStartMonth: 4,
        stockValuationMethod: "weighted_average",
        enableCostCenter: formData.enableCostCenter,
        enableMultiCurrency: false,
        enableBillWiseTracking: formData.enableBillWise,
        enableBatchTracking: false,
        voucherSeries: {},
        companyNameEn: formData.companyNameEn,
        companyNameNe: formData.companyNameNe,
        city: formData.city,
        businessType: formData.businessType,
        businessNature: formData.businessNature,
        dateFormat: formData.dateFormat,
        enableBillWise: formData.enableBillWise,
        enableInventory: formData.enableStock,
      };
      await createCompanyAndAdmin({
        company: applyNatureToCompanySettings(companyBase, formData.businessNature) as never,
        adminUser: {
          name: formData.fullName,
          username: formData.username,
          password: formData.password,
          role: "admin",
          isActive: true,
        } as never,
      });
      try {
        localStorage.removeItem(RESUME_KEY);
      } catch {
        /* ignore */
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Company setup could not be completed. Check your inputs and try again.";
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const currentErrors = stepErrors[currentStep] || {};
  const CurrentStepComponent = steps[currentStep - 1].component;
  const errorList = Object.entries(currentErrors).map(([id, message]) => ({ id, message }));

  return (
    <PreWorkspaceShell title="Company setup" showBrandPanel={false} contentWidth="wide">
      <div
        className="w-full rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-6 shadow-[var(--ds-shadow-1)] sm:p-8"
        data-testid="signup-wizard"
      >
        <div className="mb-4">
          <h2 className="text-[18px] font-semibold text-[var(--ds-text-strong)]">Set up your company</h2>
          <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
            Required steps create company identity, fiscal and tax context, accounting foundations, and the first
            administrator. Progress is saved on this device until setup finishes. Passwords are never stored in drafts.
          </p>
        </div>

        {resumed ? (
          <Alert tone="info" title="Resumed setup" className="mb-4" onDismiss={() => setResumed(false)}>
            Continuing from a saved draft on this device.
          </Alert>
        ) : null}

        <StepProgress steps={steps.map((s) => s.name)} current={currentStep - 1} className="mb-6" />

        {errorList.length ? (
          <ErrorSummary title="Please fix the following" errors={errorList} className="mb-4" />
        ) : null}

        <div className="mb-6">
          <CurrentStepComponent
            data={formData}
            onChange={(newData) => {
              setFormData(newData);
              if (Object.keys(currentErrors).length > 0) {
                setStepErrors((prev) => ({ ...prev, [currentStep]: {} }));
              }
            }}
            errors={currentErrors}
          />
        </div>

        {submitError ? (
          <ErrorSummary
            title="Setup could not finish"
            errors={[{ id: "submit", message: submitError }]}
            className="mb-4"
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ds-border-subtle)] pt-4">
          <Button variant="secondary" onClick={handleBack} disabled={currentStep === 1 || submitLoading}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--ds-text-muted)]">
              Step {currentStep} of {steps.length}
            </span>
            {currentStep < 4 ? (
              <Button variant="primary" onClick={handleNext}>
                Save and continue
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => void handleFinish()}
                disabled={submitLoading}
                loading={submitLoading}
                data-testid="wizard-activate"
              >
                {submitLoading ? "Activating…" : "Review complete — activate company"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </PreWorkspaceShell>
  );
}
