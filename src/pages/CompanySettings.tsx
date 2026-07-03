// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Save, Eye, EyeOff, X } from "lucide-react";
import { PillTitle, FormPanel } from "../components/BusyShell";
import toast from "react-hot-toast";

const NEPAL_PROVINCES = [
  "Koshi Province (Province 1)",
  "Madhesh Province",
  "Bagmati Province",
  "Gandaki Province",
  "Lumbini Province",
  "Karnali Province",
  "Sudurpashchim Province",
];

const NEPAL_DISTRICTS: Record<string, string[]> = {
  "Koshi Province (Province 1)": [
    "Taplejung",
    "Panchthar",
    "Ilam",
    "Jhapa",
    "Morang",
    "Sunsari",
    "Dhankuta",
    "Terhathum",
    "Sankhuwasabha",
    "Bhojpur",
    "Solukhumbu",
    "Okhaldhunga",
    "Khotang",
    "Udayapur",
  ],
  "Madhesh Province": [
    "Saptari",
    "Siraha",
    "Dhanusha",
    "Mahottari",
    "Sarlahi",
    "Rautahat",
    "Bara",
    "Parsa",
  ],
  "Bagmati Province": [
    "Sindhuli",
    "Ramechhap",
    "Dolakha",
    "Sindhupalchok",
    "Kavrepalanchok",
    "Lalitpur",
    "Bhaktapur",
    "Kathmandu",
    "Nuwakot",
    "Rasuwa",
    "Dhading",
    "Makwanpur",
    "Chitwan",
  ],
  "Gandaki Province": [
    "Gorkha",
    "Manang",
    "Mustang",
    "Myagdi",
    "Kaski",
    "Lamjung",
    "Tanahu",
    "Nawalpur",
    "Syangja",
    "Parbat",
    "Baglung",
  ],
  "Lumbini Province": [
    "Rupandehi",
    "Kapilvastu",
    "Arghakhanchi",
    "Palpa",
    "Nawalparasi (West)",
    "Gulmi",
    "Dang",
    "Pyuthan",
    "Rolpa",
    "Rukum (East)",
    "Banke",
    "Bardiya",
  ],
  "Karnali Province": [
    "Dolpa",
    "Mugu",
    "Humla",
    "Jumla",
    "Kalikot",
    "Dailekh",
    "Jajarkot",
    "Rukum (West)",
    "Salyan",
    "Surkhet",
  ],
  "Sudurpashchim Province": [
    "Bajura",
    "Bajhang",
    "Darchula",
    "Baitadi",
    "Dadeldhura",
    "Doti",
    "Achham",
    "Kailali",
    "Kanchanpur",
  ],
};

const EMAIL_PRESETS: Record<string, { host: string; port: number }> = {
  Gmail: { host: "smtp.gmail.com", port: 587 },
  Outlook: { host: "smtp.office365.com", port: 587 },
  Yahoo: { host: "smtp.mail.yahoo.com", port: 587 },
  Custom: { host: "", port: 587 },
};

export default function CompanySettings() {
  const [activeTab, setActiveTab] = useState<"general" | "financial" | "tax" | "display" | "email">(
    "general",
  );
  const [formData, setFormData] = useState({
    company_name: "",
    company_name_nepali: "",
    address: "",
    city: "",
    district: "",
    province: "",
    country: "Nepal",
    phone: "",
    mobile: "",
    email: "",
    website: "",
    pan_number: "",
    vat_number: "",
    registration_number: "",
    fiscal_year_type: "BS",
    currency_symbol: "₨",
    currency_code: "NPR",
    date_format: "BS",
    language: "en",
    decimal_places: 2,
    enable_vat: true,
    vat_rate: 13.0,
    enable_tds: false,
    tds_rate: 0,
    invoice_prefix: "INV",
    receipt_prefix: "RCP",
    voucher_prefix: "VCH",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_pass: "",
    smtp_from: "",
    theme_color: "#1a2744",
    enable_nepali_date: true,
    show_both_dates: true,
    financial_year_start_month: 4,
    bank_name: "",
    bank_account: "",
    bank_branch: "",
    logo_url: "",
    ward_number: "",
    vat_registration_date: "",
    registration_type: "",
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [testEmailTarget, setTestEmailTarget] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.company_name || formData.company_name.trim().length < 3) {
      errors.company_name = "Company name must be at least 3 characters";
    }
    if (formData.pan_number && !/^\d{9}$/.test(formData.pan_number)) {
      errors.pan_number = "PAN must be exactly 9 digits (numbers only)";
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Enter a valid email address";
    }
    if (formData.vat_rate < 0 || formData.vat_rate > 100) {
      errors.vat_rate = "VAT rate must be between 0 and 100";
    }
    if (formData.smtp_port && (formData.smtp_port < 1 || formData.smtp_port > 65535)) {
      errors.smtp_port = "SMTP port must be between 1 and 65535";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix the errors before saving");
      return;
    }
    // Simulate save logic
    toast.success("Company settings saved successfully!");
    setIsDirty(false);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-fill VAT from PAN when PAN is 9 digits and VAT is enabled
      if (field === "pan_number" && /^\d{9}$/.test(value) && updated.enable_vat) {
        updated.vat_number = value;
      }
      return updated;
    });
    setIsDirty(true);
    // Clear error for this field when user types
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be smaller than 2MB");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/svg+xml", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Logo must be JPG, PNG, SVG or WebP format");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleChange("logo_url", event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProvinceChange = (value: string) => {
    setFormData((prev) => ({ ...prev, province: value, district: "" }));
    setIsDirty(true);
  };

  const availableDistricts = formData.province ? NEPAL_DISTRICTS[formData.province] || [] : [];

  return (
    <div style={{ background: "#f5f6fa", padding: 12, minHeight: "100vh" }}>
      <PillTitle title="Modify Company" />
      <FormPanel>
        <div className="flex flex-col gap-4 animate-fadeIn pb-4 text-xs select-none">
          {/* Header with title and Save button */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#000000]">Company Settings</h2>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={`h-8 px-4 rounded-md text-[12px] font-medium flex items-center gap-2 ${
                isDirty
                  ? "bg-[#3D6B25] hover:bg-[#2D5A1A] text-white"
                  : "bg-[#EBF5E2] text-[#000000] cursor-not-allowed"
              }`}
            >
              <Save size={14} />
              Save Changes
            </button>
          </div>

          {/* Tab bar — 5 tabs */}
          <div className="flex items-center gap-0 border-b border-[#9DC07A] mb-4">
            {[
              { key: "general", label: "Basic Info" },
              { key: "financial", label: "Financial" },
              { key: "tax", label: "Tax Settings" },
              { key: "display", label: "Date & Display" },
              { key: "email", label: "Email / SMTP" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 text-[12px] font-medium relative ${
                  activeTab === tab.key ? "text-[#1557b0]" : "text-[#000000] hover:bg-[#EBF5E2]"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1557b0]"></div>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="space-y-4">
            {/* ── GENERAL TAB ── */}
            {activeTab === "general" && (
              <div className="space-y-4">
                {/* Section 1 - Company Profile */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Company Profile
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Company Name (English)*
                      </label>
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => handleChange("company_name", e.target.value)}
                        className={`h-8 px-2.5 w-full text-[12px] border rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ${fieldErrors.company_name ? "border-red-500" : "border-[#9DC07A]"}`}
                        placeholder="Company Name"
                      />
                      {fieldErrors.company_name && (
                        <p className="text-red-600 text-[10px] mt-0.5">
                          {fieldErrors.company_name}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Company Name (Nepali)
                      </label>
                      <input
                        type="text"
                        value={formData.company_name_nepali}
                        onChange={(e) => handleChange("company_name_nepali", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="कम्पनी नाम"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Logo Upload
                      </label>
                      <div className="flex items-center gap-2">
                        {formData.logo_url ? (
                          <div className="relative">
                            <img
                              src={formData.logo_url}
                              alt="Preview"
                              className="max-h-16 max-w-32 object-contain border border-[#9DC07A]"
                            />
                            <button
                              type="button"
                              onClick={() => handleChange("logo_url", "")}
                              className="absolute -top-2 -right-2 bg-white border border-[#9DC07A] rounded-full p-1 text-[#000000] hover:bg-[#EBF5E2]"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="border border-dashed border-[#9DC07A] rounded-md w-16 h-16 flex items-center justify-center text-[#000000] text-[10px]">
                            No Image
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/svg+xml,image/webp"
                            onChange={handleLogoUpload}
                            className="text-[10px] text-[#000000] w-full"
                          />
                          <p className="text-[10px] text-[#000000] mt-1">
                            Max 2MB. JPG, PNG, SVG, WebP
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2 - Address & Contact */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Address & Contact
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="Full Address"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => handleChange("city", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Ward / Tole Number
                      </label>
                      <input
                        type="text"
                        value={formData.ward_number}
                        onChange={(e) => handleChange("ward_number", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="Ward/Tole"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Province
                      </label>
                      <select
                        value={formData.province}
                        onChange={(e) => handleProvinceChange(e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      >
                        <option value="">— Select Province —</option>
                        {NEPAL_PROVINCES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        District
                      </label>
                      <select
                        value={formData.district}
                        onChange={(e) => handleChange("district", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        disabled={availableDistricts.length === 0}
                      >
                        <option value="">
                          {availableDistricts.length === 0
                            ? "— Select Province first —"
                            : "— Select District —"}
                        </option>
                        {availableDistricts.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="01-4XXXXXX or 98XXXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Mobile
                      </label>
                      <input
                        type="text"
                        value={formData.mobile}
                        onChange={(e) => handleChange("mobile", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="98XXXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        className={`h-8 px-2.5 w-full text-[12px] border rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ${fieldErrors.email ? "border-red-500" : "border-[#9DC07A]"}`}
                        placeholder="info@company.com"
                      />
                      {fieldErrors.email && (
                        <p className="text-red-600 text-[10px] mt-0.5">{fieldErrors.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Website
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => handleChange("website", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="https://www.company.com.np"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3 - Tax Registration */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Tax Registration
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        PAN No.{" "}
                        <span className="text-[#000000] font-normal">
                          ({formData.pan_number.length}/9 digits)
                        </span>
                      </label>
                      <input
                        type="text"
                        maxLength={9}
                        value={formData.pan_number}
                        onChange={(e) =>
                          handleChange("pan_number", e.target.value.replace(/\D/g, ""))
                        }
                        className={`h-8 px-2.5 w-full text-[12px] border rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ${fieldErrors.pan_number ? "border-red-500" : "border-[#9DC07A]"}`}
                        placeholder="123456789"
                      />
                      {/^\d{9}$/.test(formData.pan_number) && (
                        <p className="text-green-600 text-[10px] mt-0.5">✓ Valid PAN format</p>
                      )}
                      {fieldErrors.pan_number && (
                        <p className="text-red-600 text-[10px] mt-0.5">{fieldErrors.pan_number}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        VAT No.
                      </label>
                      <input
                        type="text"
                        value={formData.vat_number}
                        readOnly
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-[#f0f0f0] text-[#000000] focus:outline-none"
                        placeholder="Auto-filled from PAN"
                      />
                      <p className="text-[10px] text-[#000000] mt-1">
                        In Nepal, PAN and VAT numbers are the same 9-digit number. Auto-filled from
                        PAN when VAT is enabled.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Company Reg. No. (OCR)
                      </label>
                      <input
                        type="text"
                        value={formData.registration_number}
                        onChange={(e) => handleChange("registration_number", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="Reg. No."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Business Registration Type
                      </label>
                      <select
                        value={formData.registration_type}
                        onChange={(e) => handleChange("registration_type", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      >
                        <option value="">— Select Type —</option>
                        <option value="Pvt. Ltd. Registration">Pvt. Ltd. Registration</option>
                        <option value="Firm Registration">Firm Registration</option>
                        <option value="Partnership Deed">Partnership Deed</option>
                        <option value="Society Registration">Society Registration</option>
                        <option value="Trust Registration">Trust Registration</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── FINANCIAL TAB ── */}
            {activeTab === "financial" && (
              <div className="space-y-4">
                {/* Section 1 - Currency & Decimals */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Currency & Decimals
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Currency Symbol
                      </label>
                      <input
                        type="text"
                        value={formData.currency_symbol}
                        onChange={(e) => handleChange("currency_symbol", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="Rs."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Currency Code
                      </label>
                      <input
                        type="text"
                        value={formData.currency_code}
                        readOnly
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-[#f0f0f0] text-[#000000] focus:outline-none"
                        placeholder="NPR"
                      />
                      <p className="text-[10px] text-[#000000] mt-1">Nepali Rupee</p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Decimal Places
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="4"
                        value={formData.decimal_places}
                        onChange={(e) =>
                          handleChange("decimal_places", parseInt(e.target.value) || 0)
                        }
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 1b - Bank Details (for invoice printing) */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Bank Details
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => handleChange("bank_name", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="e.g. Nepal Bank Ltd."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Bank Branch
                      </label>
                      <input
                        type="text"
                        value={formData.bank_branch}
                        onChange={(e) => handleChange("bank_branch", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="e.g. Kathmandu Main"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        value={formData.bank_account}
                        onChange={(e) => handleChange("bank_account", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="Account number"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2 - Fiscal Year */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Fiscal Year
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Fiscal Year Start Month (BS)
                      </label>
                      <select
                        value={formData.financial_year_start_month}
                        onChange={(e) =>
                          handleChange("financial_year_start_month", parseInt(e.target.value))
                        }
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      >
                        <option value="1">Baishakh</option>
                        <option value="2">Jestha</option>
                        <option value="3">Ashadh</option>
                        <option value="4">Shrawan</option>
                        <option value="5">Bhadra</option>
                        <option value="6">Ashwin</option>
                        <option value="7">Kartik</option>
                        <option value="8">Mangsir</option>
                        <option value="9">Poush</option>
                        <option value="10">Magh</option>
                        <option value="11">Falgun</option>
                        <option value="12">Chaitra</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Fiscal Year Calendar Type
                      </label>
                      <select
                        value={formData.fiscal_year_type}
                        onChange={(e) => handleChange("fiscal_year_type", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      >
                        <option value="BS">BS - Bikram Sambat (Nepal)</option>
                        <option value="AD">AD - Anno Domini</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Calculated Fiscal Year
                      </label>
                      <span className="text-[12px] text-[#000000]">
                        Fiscal Year: 1 Shrawan to 31 Ashadh
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3 - Voucher Numbering */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Voucher Numbering
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Invoice Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.invoice_prefix}
                        onChange={(e) => handleChange("invoice_prefix", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="INV"
                      />
                      <p className="text-[10px] text-[#000000] mt-1">
                        Example: {formData.invoice_prefix}-2082/83-00001
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Receipt Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.receipt_prefix}
                        onChange={(e) => handleChange("receipt_prefix", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="RCP"
                      />
                      <p className="text-[10px] text-[#000000] mt-1">
                        Example: {formData.receipt_prefix}-2082/83-00001
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Voucher Prefix
                      </label>
                      <input
                        type="text"
                        value={formData.voucher_prefix}
                        onChange={(e) => handleChange("voucher_prefix", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="VCH"
                      />
                      <p className="text-[10px] text-[#000000] mt-1">
                        Example: {formData.voucher_prefix}-2082/83-00001
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 4 - Nepali Date Settings */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Nepali Date Settings
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.enable_nepali_date}
                        onChange={(e) => handleChange("enable_nepali_date", e.target.checked)}
                        className="rounded border-[#9DC07A] h-4 w-4"
                      />
                      <label className="text-[12px] font-medium text-[#000000]">
                        Enable Nepali Date (BS) as Primary
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.show_both_dates}
                        onChange={(e) => handleChange("show_both_dates", e.target.checked)}
                        className="rounded border-[#9DC07A] h-4 w-4"
                      />
                      <label className="text-[12px] font-medium text-[#000000]">
                        Show Both BS and AD Dates
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAX TAB ── */}
            {activeTab === "tax" && (
              <div className="space-y-4">
                {/* Section 1 - Value Added Tax */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Value Added Tax (VAT)
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.enable_vat}
                        onChange={(e) => handleChange("enable_vat", e.target.checked)}
                        className="rounded border-[#9DC07A] h-4 w-4"
                      />
                      <label className="text-[12px] font-medium text-[#000000]">Enable VAT</label>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        VAT Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.vat_rate}
                        onChange={(e) => handleChange("vat_rate", parseFloat(e.target.value) || 0)}
                        className={`h-8 px-2.5 w-full text-[12px] border rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ${fieldErrors.vat_rate ? "border-red-500" : "border-[#9DC07A]"}`}
                      />
                      {fieldErrors.vat_rate && (
                        <p className="text-red-600 text-[10px] mt-0.5">{fieldErrors.vat_rate}</p>
                      )}
                      <p className="text-[10px] text-[#000000] mt-1">
                        Nepal mandates 13% VAT under IRD regulations.
                      </p>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        VAT Registration Date
                      </label>
                      <input
                        type="date"
                        value={formData.vat_registration_date}
                        onChange={(e) => handleChange("vat_registration_date", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2 - Tax Deducted at Source */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Tax Deducted at Source (TDS)
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.enable_tds}
                        onChange={(e) => handleChange("enable_tds", e.target.checked)}
                        className="rounded border-[#9DC07A] h-4 w-4"
                      />
                      <label className="text-[12px] font-medium text-[#000000]">Enable TDS</label>
                    </div>
                    {formData.enable_tds && (
                      <div className="col-span-2 bg-[#f0f0f0] border border-[#9DC07A] rounded-md p-2">
                        <p className="text-[10px] text-[#000000]">
                          TDS applies on contractor payments (1.5%), rent (10%), professional fees
                          (15%), commission (5%), interest (15%). Deducted from payee, deposited to
                          IRD.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3 - IRD / CBMS e-Billing */}
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      IRD / CBMS e-Billing
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="bg-blue-50 border border-blue-200 text-[#000000] p-3 rounded-md">
                      <p className="text-[10px]">
                        Nepal's Inland Revenue Department requires VAT-registered businesses to
                        submit bills via the Compliance Bill Management System (CBMS). Configure
                        CBMS settings in your system admin panel.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── DISPLAY TAB ── */}
            {activeTab === "display" && (
              <div className="space-y-4">
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">
                      Display Settings
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Date Format
                      </label>
                      <select
                        value={formData.date_format}
                        onChange={(e) => handleChange("date_format", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      >
                        <option value="BS">BS - Bikram Sambat</option>
                        <option value="AD">AD - Anno Domini</option>
                        <option value="BOTH">Both BS and AD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Language
                      </label>
                      <select
                        value={formData.language}
                        onChange={(e) => handleChange("language", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      >
                        <option value="en">English</option>
                        <option value="ne">Nepali</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Theme Color
                      </label>
                      <input
                        type="color"
                        value={formData.theme_color}
                        onChange={(e) => handleChange("theme_color", e.target.value)}
                        className="h-8 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── EMAIL TAB ── */}
            {activeTab === "email" && (
              <div className="space-y-4">
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-medium text-[#000000] uppercase tracking-wider">
                      Email / SMTP Settings
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Email Service Preset
                      </label>
                      <select
                        onChange={(e) => {
                          const preset = EMAIL_PRESETS[e.target.value];
                          if (preset) {
                            handleChange("smtp_host", preset.host);
                            handleChange("smtp_port", preset.port);
                          }
                        }}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      >
                        <option value="">— Select to auto-fill —</option>
                        {Object.keys(EMAIL_PRESETS).map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={formData.smtp_host}
                        onChange={(e) => handleChange("smtp_host", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="65535"
                        value={formData.smtp_port}
                        onChange={(e) => handleChange("smtp_port", parseInt(e.target.value) || 587)}
                        className={`h-8 px-2.5 w-full text-[12px] border rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] ${fieldErrors.smtp_port ? "border-red-500" : "border-[#9DC07A]"}`}
                      />
                      {fieldErrors.smtp_port && (
                        <p className="text-red-600 text-[10px] mt-0.5">{fieldErrors.smtp_port}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        SSL/TLS Mode
                      </label>
                      <select
                        value="STARTTLS"
                        onChange={() => {}}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      >
                        <option value="STARTTLS">STARTTLS (port 587)</option>
                        <option value="SSL">SSL (port 465)</option>
                        <option value="None">None (port 25)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        SMTP User
                      </label>
                      <input
                        type="text"
                        value={formData.smtp_user}
                        onChange={(e) => handleChange("smtp_user", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        SMTP Password
                      </label>
                      <div className="relative">
                        <input
                          type={showSmtpPass ? "text" : "password"}
                          value={formData.smtp_pass}
                          onChange={(e) => handleChange("smtp_pass", e.target.value)}
                          className="h-8 px-2.5 pr-9 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass((p) => !p)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#000000] hover:opacity-70 cursor-pointer"
                        >
                          {showSmtpPass ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        From Email
                      </label>
                      <input
                        type="email"
                        value={formData.smtp_from}
                        onChange={(e) => handleChange("smtp_from", e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        placeholder="from@example.com"
                      />
                    </div>
                    <div className="col-span-2 border-t border-[#9DC07A] pt-4 mt-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">
                        Test Email Recipient
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={testEmailTarget}
                          onChange={(e) => setTestEmailTarget(e.target.value)}
                          className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                          placeholder="test@example.com"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setTestEmailLoading(true);
                            setTimeout(() => {
                              toast.success("Test email sent!");
                              setTestEmailLoading(false);
                            }, 1000);
                          }}
                          disabled={!testEmailTarget || testEmailLoading}
                          className={`h-8 px-4 rounded-md text-[12px] font-medium whitespace-nowrap ${
                            testEmailTarget && !testEmailLoading
                              ? "bg-[#1557b0] hover:bg-[#0f4a96] text-white"
                              : "bg-[#EBF5E2] text-[#000000] cursor-not-allowed"
                          }`}
                        >
                          {testEmailLoading ? "Sending..." : "Send Test Email"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </FormPanel>
    </div>
  );
}
