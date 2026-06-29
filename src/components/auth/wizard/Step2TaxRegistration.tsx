// @ts-nocheck
import React from "react";

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
  msg ? <p className={errorClass}><span className="font-bold">!</span> {msg}</p> : null;

const inputStyle = (hasError: boolean) => ({
  background: "#ffffff",
  border: `1px solid ${hasError ? "#dc2626" : "#d1d5db"}`,
  color: "#111827",
});

export default function Step2TaxRegistration({ data, onChange, errors = {} }: Props) {
  const set = (key: string, val: any) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-bold text-gray-800">Tax Registration</h2>
        <p className="text-[12px] text-gray-500 mt-1">Enter your IRD tax registration details</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PAN */}
        <div className="md:col-span-2">
          <label className={labelClass}>
            PAN / VAT Registration Number <span className="text-red-600">*</span>
            <span className="ml-2 text-gray-400 font-normal">({(data.panNumber || "").length}/9 digits)</span>
          </label>
          <input
            type="text"
            maxLength={9}
            value={data.panNumber || ""}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              set("panNumber", v);
              if (data.hasVAT) set("vatNumber", v);
            }}
            className={fieldClass}
            style={inputStyle(!!errors.panNumber)}
            placeholder="e.g. 123456789"
          />
          <FieldError msg={errors.panNumber} />
          {data.panNumber && /^\d{9}$/.test(data.panNumber) && !errors.panNumber && (
            <p className="mt-1 text-[11px] text-green-600 flex items-center gap-1">
              <span className="font-bold">✓</span> Valid PAN format
            </p>
          )}
        </div>

        {/* VAT toggle */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.hasVAT || false}
              onChange={(e) =>
                onChange({
                  ...data,
                  hasVAT: e.target.checked,
                  vatNumber: e.target.checked ? data.panNumber : "",
                })
              }
              style={{ accentColor: "#1557b0", width: 16, height: 16 }}
            />
            <span className="text-[12px] font-medium text-gray-700">VAT Registered</span>
          </label>
        </div>

        {data.hasVAT && (
          <div className="md:col-span-2 pl-5">
            <label className={labelClass}>VAT Registration Number</label>
            <input
              type="text"
              value={data.vatNumber || ""}
              readOnly
              className={fieldClass}
              style={{ ...inputStyle(false), background: "#f9fafb", cursor: "not-allowed" }}
            />
            <p className="mt-1 text-[11px] text-gray-400">Same as your PAN number</p>
          </div>
        )}

        {/* IRD Province */}
        <div>
          <label className={labelClass}>
            IRD Office Province <span className="text-red-600">*</span>
          </label>
          <select
            value={data.irdProvince || ""}
            onChange={(e) => set("irdProvince", e.target.value)}
            className={fieldClass}
            style={inputStyle(!!errors.irdProvince)}
          >
            <option value="">— Select Province —</option>
            <option value="Koshi">Koshi Province</option>
            <option value="Madhesh">Madhesh Province</option>
            <option value="Bagmati">Bagmati Province</option>
            <option value="Gandaki">Gandaki Province</option>
            <option value="Lumbini">Lumbini Province</option>
            <option value="Karnali">Karnali Province</option>
            <option value="Sudurpashchim">Sudurpashchim Province</option>
          </select>
          <FieldError msg={errors.irdProvince} />
        </div>

        {/* Fiscal Year */}
        <div>
          <label className={labelClass}>
            Fiscal Year <span className="text-red-600">*</span>
          </label>
          <select
            value={data.fiscalYear || ""}
            onChange={(e) => set("fiscalYear", e.target.value)}
            className={fieldClass}
            style={inputStyle(!!errors.fiscalYear)}
          >
            <option value="">— Select Fiscal Year —</option>
            <option value="2080/81">2080/81</option>
            <option value="2081/82">2081/82</option>
            <option value="2082/83">2082/83</option>
            <option value="2083/84">2083/84</option>
            <option value="2084/85">2084/85</option>
            <option value="2085/86">2085/86</option>
          </select>
          <FieldError msg={errors.fiscalYear} />
        </div>

        {/* IRD Office Name */}
        <div className="md:col-span-2">
          <label className={labelClass}>IRD Tax Office Branch (Optional)</label>
          <input
            type="text"
            value={data.irdOfficeName || ""}
            onChange={(e) => set("irdOfficeName", e.target.value)}
            className={fieldClass}
            style={inputStyle(false)}
            placeholder="e.g. Large Taxpayer Office, IRO Kathmandu"
          />
        </div>
      </div>

      <div
        className="px-3 py-2 rounded-md text-[11px]"
        style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}
      >
        <strong>Nepal VAT Threshold:</strong> Annual turnover above NPR 50 lakh (NPR 5,000,000)
        requires mandatory VAT registration under Nepal Income Tax Act.
      </div>
    </div>
  );
}
