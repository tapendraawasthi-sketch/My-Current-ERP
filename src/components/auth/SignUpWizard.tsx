// @ts-nocheck
import React, { useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import Step1CompanyProfile from "./wizard/Step1CompanyProfile";
import Step2TaxRegistration from "./wizard/Step2TaxRegistration";
import Step3AccountingSetup from "./wizard/Step3AccountingSetup";
import Step4AdminAccount from "./wizard/Step4AdminAccount";
import { useStore } from "@/store/useStore";

export default function SignUpWizard() {
  const { createCompanyAndAdmin } = useStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<number, Record<string, string>>>({});

  const [formData, setFormData] = useState({
    companyNameEn: "",
    companyNameNe: "",
    businessType: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    panNumber: "",
    hasVAT: false,
    vatNumber: "",
    irdProvince: "",
    fiscalYear: "2083/84",
    dateFormat: "BS",
    enableStock: true,
    enableCostCenter: false,
    enableBillWise: true,
    fullName: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const steps = [
    { id: 1, name: "Company Profile", component: Step1CompanyProfile },
    { id: 2, name: "Tax Registration", component: Step2TaxRegistration },
    { id: 3, name: "Accounting Setup", component: Step3AccountingSetup },
    { id: 4, name: "Admin Account", component: Step4AdminAccount },
  ];

  const validateStep = (step: number): Record<string, string> => {
    const errors: Record<string, string> = {};
    switch (step) {
      case 1:
        if (!formData.companyNameEn.trim()) errors.companyNameEn = "Company name (English) is required";
        if (!formData.businessType) errors.businessType = "Business type is required";
        if (!formData.address.trim()) errors.address = "Address is required";
        if (!formData.city.trim()) errors.city = "City is required";
        if (!formData.phone.trim()) errors.phone = "Phone number is required";
        if (!formData.email.trim()) errors.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = "Enter a valid email address";
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
        else if (!/^[a-zA-Z0-9]{4,}$/.test(formData.username)) errors.username = "Username must be alphanumeric, min 4 characters";
        if (!formData.password) errors.password = "Password is required";
        else if (formData.password.length < 6) errors.password = "Password must be at least 6 characters";
        else if (!/[a-zA-Z]/.test(formData.password) || !/\d/.test(formData.password)) errors.password = "Password must contain both letters and numbers";
        if (!formData.confirmPassword) errors.confirmPassword = "Please confirm your password";
        else if (formData.password !== formData.confirmPassword) errors.confirmPassword = "Passwords do not match";
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
      await createCompanyAndAdmin({
        company: {
          name: formData.companyNameEn,
          nameNepali: formData.companyNameNe,
          panNumber: formData.panNumber,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          vatNumber: formData.vatNumber,
          defaultCurrency: "NPR",
          currencySymbol: "Rs.",
          defaultDateFormat: formData.dateFormat as any,
          fiscalYearStartMonth: 4,
          stockValuationMethod: "weighted_average" as any,
          enableCostCenter: formData.enableCostCenter,
          enableMultiCurrency: false,
          enableBillWiseTracking: formData.enableBillWise,
          enableBatchTracking: false,
          voucherSeries: {},
          companyNameEn: formData.companyNameEn,
          companyNameNe: formData.companyNameNe,
          city: formData.city,
          businessType: formData.businessType,
          dateFormat: formData.dateFormat,
          enableBillWise: formData.enableBillWise,
        },
        adminUser: {
          name: formData.fullName,
          username: formData.username,
          password: formData.password,
          role: "admin" as any,
          isActive: true,
        },
      });
    } catch (error: any) {
      setSubmitError(error?.message || "Failed to setup company. Please check your inputs and try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const currentErrors = stepErrors[currentStep] || {};
  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#f5f6fa" }}
    >
      <div
        className="w-full max-w-3xl rounded-xl shadow-lg p-8"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
      >
        {/* Progress bar */}
        <div
          className="relative h-1.5 rounded-full overflow-hidden mb-6"
          style={{ background: "#e5e7eb" }}
        >
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
            style={{
              width: `${(currentStep / steps.length) * 100}%`,
              background: "#1557b0",
            }}
          />
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-gray-800 mb-1">Welcome to Sutra ERP</h1>
          <p className="text-[13px] text-gray-500">Let's set up your accounting system in just 4 steps</p>
        </div>

        {/* Step indicators */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const hasErrors = stepErrors[step.id] && Object.keys(stepErrors[step.id]).length > 0;
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-[13px] transition-colors"
                      style={{
                        background:
                          hasErrors
                            ? "#dc2626"
                            : currentStep > step.id
                            ? "#059669"
                            : currentStep === step.id
                            ? "#1557b0"
                            : "#e5e7eb",
                        color:
                          currentStep >= step.id || hasErrors ? "#ffffff" : "#6b7280",
                      }}
                    >
                      {hasErrors ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : currentStep > step.id ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <span
                      className="text-[11px] mt-2 font-medium"
                      style={{
                        color: currentStep === step.id ? "#1557b0" : "#6b7280",
                      }}
                    >
                      {step.name}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className="flex-1 h-0.5 mx-2"
                      style={{
                        background: currentStep > step.id ? "#059669" : "#e5e7eb",
                        marginTop: "-18px",
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="mb-6">
          <CurrentStepComponent
            data={formData}
            onChange={(newData: any) => {
              setFormData(newData);
              // Clear errors for fields as user types
              if (currentErrors && Object.keys(currentErrors).length > 0) {
                setStepErrors((prev) => ({ ...prev, [currentStep]: {} }));
              }
            }}
            errors={currentErrors}
          />
        </div>

        {/* Global submit error */}
        {submitError && (
          <div
            className="mb-4 px-4 py-3 rounded-md flex items-start gap-2"
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              color: "#b91c1c",
            }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="text-[12px] font-medium">{submitError}</span>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between items-center pt-4" style={{ borderTop: "1px solid #e5e7eb" }}>
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="h-8 px-4 text-[12px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "#ffffff",
              border: "1px solid #d1d5db",
              color: "#374151",
            }}
          >
            Previous
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">
              Step {currentStep} of {steps.length}
            </span>
            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                className="h-8 px-4 text-[12px] font-medium rounded-md transition-colors"
                style={{
                  background: "#1557b0",
                  color: "#ffffff",
                  border: "none",
                }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={submitLoading}
                className="h-8 px-4 text-[12px] font-medium rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                style={{
                  background: "#1557b0",
                  color: "#ffffff",
                  border: "none",
                }}
              >
                {submitLoading ? (
                  <>
                    <span
                      className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                      style={{ borderColor: "#ffffff", borderTopColor: "transparent" }}
                    />
                    Setting up…
                  </>
                ) : (
                  "Finish & Launch"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
