import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  data: any;
  onChange: (data: any) => void;
  errors?: Record<string, string>;
}

const labelClass = "block text-[11px] font-medium text-gray-600 mb-1";
const fieldClass =
  "w-full h-8 px-2.5 text-[12px] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/30 focus:border-[#1557b0] transition-colors";

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? (
    <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
      <span className="font-bold shrink-0">!</span> {msg}
    </p>
  ) : null;

const inputStyle = (hasError: boolean) => ({
  background: "#ffffff",
  border: `1px solid ${hasError ? "#dc2626" : "#d1d5db"}`,
  color: "#111827",
});

const getPasswordStrength = (password: string) => {
  if (!password) return null;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 2) return { label: "Weak", color: "#dc2626", width: "33%" };
  if (score <= 3) return { label: "Fair", color: "#d97706", width: "55%" };
  if (score <= 4) return { label: "Good", color: "#2563eb", width: "77%" };
  return { label: "Strong", color: "#059669", width: "100%" };
};

export default function Step4AdminAccount({ data, onChange, errors = {} }: Props) {
  const [showPassword, setShowPassword] = useState({ password: false, confirm: false });
  const strength = getPasswordStrength(data.password || "");

  const set = (key: string, val: string) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-bold text-gray-800">Admin Account</h2>
        <p className="text-[12px] text-gray-500 mt-1">Create your administrator account</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="md:col-span-2">
          <label className={labelClass}>
            Full Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={data.fullName || ""}
            onChange={(e) => set("fullName", e.target.value)}
            className={fieldClass}
            style={inputStyle(!!errors.fullName)}
            placeholder="e.g. Tapendra Awasthi"
          />
          <FieldError msg={errors.fullName} />
        </div>

        {/* Username */}
        <div className="md:col-span-2">
          <label className={labelClass}>
            Username <span className="text-red-600">*</span>{" "}
            <span className="text-gray-400 font-normal">(alphanumeric, min 4 characters)</span>
          </label>
          <input
            type="text"
            value={data.username || ""}
            onChange={(e) => set("username", e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
            className={fieldClass}
            style={inputStyle(!!errors.username)}
            placeholder="admin"
            minLength={4}
          />
          <FieldError msg={errors.username} />
        </div>

        {/* Password */}
        <div>
          <label className={labelClass}>
            Password <span className="text-red-600">*</span>{" "}
            <span className="text-gray-400 font-normal">(min 6 chars, letters + numbers)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword.password ? "text" : "password"}
              value={data.password || ""}
              onChange={(e) => set("password", e.target.value)}
              className={fieldClass}
              style={{ ...inputStyle(!!errors.password), paddingRight: "36px" }}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => ({ ...s, password: !s.password }))}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
            >
              {showPassword.password ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {strength && (
            <div className="mt-1.5">
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                <div
                  className="h-1 rounded-full transition-all duration-300"
                  style={{ width: strength.width, background: strength.color }}
                />
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: strength.color }}>
                Password strength: {strength.label}
              </p>
            </div>
          )}
          <FieldError msg={errors.password} />
        </div>

        {/* Confirm Password */}
        <div>
          <label className={labelClass}>
            Confirm Password <span className="text-red-600">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword.confirm ? "text" : "password"}
              value={data.confirmPassword || ""}
              onChange={(e) => set("confirmPassword", e.target.value)}
              className={fieldClass}
              style={{ ...inputStyle(!!errors.confirmPassword), paddingRight: "36px" }}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => ({ ...s, confirm: !s.confirm }))}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
            >
              {showPassword.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {data.confirmPassword &&
            data.password === data.confirmPassword &&
            !errors.confirmPassword && (
              <p className="mt-1 text-[11px] text-green-600">✓ Passwords match</p>
            )}
          <FieldError msg={errors.confirmPassword} />
        </div>
      </div>

      <div
        className="px-3 py-2 rounded-md text-[11px]"
        style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" }}
      >
        <strong>Note:</strong> This account will have full admin access. You can add more users
        after setup.
      </div>
    </div>
  );
}
