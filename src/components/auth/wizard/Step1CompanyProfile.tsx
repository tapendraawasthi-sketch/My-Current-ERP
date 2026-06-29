// @ts-nocheck
import React from "react";

const NEPAL_PROVINCES = [
  "Koshi Province (Province 1)",
  "Madhesh Province",
  "Bagmati Province",
  "Gandaki Province",
  "Lumbini Province",
  "Karnali Province",
  "Sudurpashchim Province",
];

interface Props {
  data: any;
  onChange: (data: any) => void;
  errors?: Record<string, string>;
}

const fieldClass =
  "w-full h-8 px-2.5 text-[12px] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/30 focus:border-[#1557b0] transition-colors";
const labelClass = "block text-[11px] font-medium text-gray-600 mb-1";
const errorClass = "mt-1 text-[11px] text-red-600 flex items-center gap-1";

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? (
    <p className={errorClass}>
      <span className="inline-block w-3.5 h-3.5 text-center leading-none font-bold text-red-600">!</span>
      {msg}
    </p>
  ) : null;

const inputStyle = (hasError: boolean) => ({
  background: "#ffffff",
  border: `1px solid ${hasError ? "#dc2626" : "#d1d5db"}`,
  color: "#111827",
});

export default function Step1CompanyProfile({ data, onChange, errors = {} }: Props) {
  const set = (key: string, val: any) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-bold text-gray-800">Company Profile</h2>
        <p className="text-[12px] text-gray-500 mt-1">Tell us about your business</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Company Name EN */}
        <div className="md:col-span-2">
          <label className={labelClass}>
            Company Name (English) <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={data.companyNameEn || ""}
            onChange={(e) => set("companyNameEn", e.target.value)}
            className={fieldClass}
            style={inputStyle(!!errors.companyNameEn)}
            placeholder="e.g. Sutra Traders Pvt. Ltd."
          />
          <FieldError msg={errors.companyNameEn} />
        </div>

        {/* Company Name NE */}
        <div className="md:col-span-2">
          <label className={labelClass}>Company Name (Nepali)</label>
          <input
            type="text"
            value={data.companyNameNe || ""}
            onChange={(e) => set("companyNameNe", e.target.value)}
            className={fieldClass}
            style={inputStyle(false)}
            placeholder="कम्पनी नाम नेपालीमा"
          />
        </div>

        {/* Business Type */}
        <div>
          <label className={labelClass}>
            Business Type <span className="text-red-600">*</span>
          </label>
          <select
            value={data.businessType || ""}
            onChange={(e) => set("businessType", e.target.value)}
            className={fieldClass}
            style={inputStyle(!!errors.businessType)}
          >
            <option value="">— Select Business Type —</option>
            <option value="Sole Proprietorship">Sole Proprietorship</option>
            <option value="Partnership">Partnership</option>
            <option value="Pvt. Ltd.">Pvt. Ltd.</option>
            <option value="Public Ltd.">Public Ltd.</option>
            <option value="Other">Other</option>
          </select>
          <FieldError msg={errors.businessType} />
        </div>

        {/* Province */}
        <div>
          <label className={labelClass}>Province</label>
          <select
            value={data.province || ""}
            onChange={(e) => onChange({ ...data, province: e.target.value, district: "" })}
            className={fieldClass}
            style={inputStyle(false)}
          >
            <option value="">— Select Province —</option>
            {NEPAL_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label className={labelClass}>
            Address <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={data.address || ""}
            onChange={(e) => set("address", e.target.value)}
            className={fieldClass}
            style={inputStyle(!!errors.address)}
            placeholder="Street / Tole / Ward"
          />
          <FieldError msg={errors.address} />
        </div>

        {/* City */}
        <div>
          <label className={labelClass}>
            City <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={data.city || ""}
            onChange={(e) => set("city", e.target.value)}
            className={fieldClass}
            style={inputStyle(!!errors.city)}
            placeholder="e.g. Kathmandu"
          />
          <FieldError msg={errors.city} />
        </div>

        {/* District */}
        <div>
          <label className={labelClass}>District</label>
          <input
            type="text"
            value={data.district || ""}
            onChange={(e) => set("district", e.target.value)}
            className={fieldClass}
            style={inputStyle(false)}
            placeholder="e.g. Kathmandu"
          />
        </div>

        {/* Phone */}
        <div>
          <label className={labelClass}>
            Phone <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={data.phone || ""}
            onChange={(e) => set("phone", e.target.value)}
            className={fieldClass}
            style={inputStyle(!!errors.phone)}
            placeholder="01-4XXXXXX or 98XXXXXXXX"
          />
          <FieldError msg={errors.phone} />
        </div>

        {/* Email */}
        <div>
          <label className={labelClass}>
            Email <span className="text-red-600">*</span>
          </label>
          <input
            type="email"
            value={data.email || ""}
            onChange={(e) => set("email", e.target.value)}
            className={fieldClass}
            style={inputStyle(!!errors.email)}
            placeholder="info@company.com"
          />
          <FieldError msg={errors.email} />
        </div>

        {/* Website */}
        <div>
          <label className={labelClass}>Website</label>
          <input
            type="url"
            value={data.website || ""}
            onChange={(e) => set("website", e.target.value)}
            className={fieldClass}
            style={inputStyle(false)}
            placeholder="https://www.company.com.np"
          />
        </div>
      </div>

      <div
        className="px-3 py-2 rounded-md text-[11px]"
        style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" }}
      >
        <strong>Tip:</strong> All fields marked with <span className="text-red-600">*</span> are required to proceed.
      </div>
    </div>
  );
}
