import React, { useState } from "react";
import { CheckCircle } from "lucide-react";
import Step1CompanyProfile from "./wizard/Step1CompanyProfile";
import Step2TaxRegistration from "./wizard/Step2TaxRegistration";
import Step3AccountingSetup from "./wizard/Step3AccountingSetup";
import Step4AdminAccount from "./wizard/Step4AdminAccount";
import { useStore } from "../../store/useStore";

export default function SignUpWizard() {
  const { createCompanyAndAdmin } = useStore();
  const [currentStep, setCurrentStep] = useState(1);
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

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(
          formData.companyNameEn &&
          formData.businessType &&
          formData.address &&
          formData.city &&
          formData.phone &&
          formData.email
        );
      case 2:
        const validPAN = /^\d{9}$/.test(formData.panNumber);
        return !!(validPAN && formData.irdProvince && formData.fiscalYear);
      case 3:
        return !!formData.dateFormat;
      case 4:
        const validUsername = /^[a-zA-Z0-9]{4,}$/.test(formData.username);
        const validPassword =
          formData.password.length >= 6 &&
          /[a-zA-Z]/.test(formData.password) &&
          /\d/.test(formData.password);
        const passwordMatch = formData.password === formData.confirmPassword;
        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
        return !!(
          formData.fullName &&
          validUsername &&
          validPassword &&
          passwordMatch &&
          validEmail
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      alert("Please fill in all required fields correctly");
      return;
    }
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleFinish = async () => {
    if (!validateStep(4)) {
      alert("Please complete all required fields");
      return;
    }

    const success = await createCompanyAndAdmin({
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
        email: formData.email,
        password: formData.password,
        role: "admin" as any,
        isActive: true,
      },
    });
    if (success) {
      alert("Welcome to Sutra ERP! Your company is now set up.");
    } else {
      alert("Workspace provision failed. Please try again.");
    }
  };

  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] via-white to-[#f0f4ff] flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-8">
        <div className="relative h-1 bg-gray-100 rounded-full overflow-hidden mb-6">
          <div
            className="absolute top-0 left-0 h-full bg-[#1557b0] transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Sutra ERP</h1>
          <p className="text-gray-600">Let's set up your accounting system in just 4 steps</p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                      currentStep > step.id
                        ? "bg-green-500"
                        : currentStep === step.id
                          ? "bg-[#1557b0]"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : (
                      <span className={currentStep === step.id ? "text-white" : "text-gray-500"}>
                        {step.id}
                      </span>
                    )}
                  </div>
                  <span className="text-xs mt-2 text-gray-600 font-medium">{step.name}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > step.id ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <CurrentStepComponent data={formData} onChange={setFormData} />
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors"
            >
              Finish & Launch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
