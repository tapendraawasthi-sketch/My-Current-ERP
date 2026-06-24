import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  data: any;
  onChange: (data: any) => void;
}

export default function Step4AdminAccount({ data, onChange }: Props) {
  const [showPassword, setShowPassword] = useState({ password: false, confirm: false });

  const validateUsername = (username: string) => {
    return /^[a-zA-Z0-9]{4,}$/.test(username);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6 && /[a-zA-Z]/.test(password) && /\d/.test(password);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#000000]">Admin Account</h2>
        <p className="text-sm text-[#000000] mt-1">Create your administrator account</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">Full Name *</label>
          <input
            type="text"
            value={data.fullName}
            onChange={(e) => onChange({ ...data, fullName: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
            placeholder="John Doe"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">
            Username * (alphanumeric, min 4 characters)
          </label>
          <input
            type="text"
            value={data.username}
            onChange={(e) =>
              onChange({ ...data, username: e.target.value.replace(/[^a-zA-Z0-9]/g, "") })
            }
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
            minLength={4}
            placeholder="admin"
          />
          {data.username && !validateUsername(data.username) && (
            <p className="text-xs text-red-600 mt-1">
              Username must be alphanumeric and at least 4 characters
            </p>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">
            Password * (min 6 chars, must contain letters + numbers)
          </label>
          <div className="relative">
            <input
              type={showPassword.password ? "text" : "password"}
              value={data.password}
              onChange={(e) => onChange({ ...data, password: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full pr-10"
              required
              minLength={6}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword({ ...showPassword, password: !showPassword.password })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#000000]"
            >
              {showPassword.password ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {data.password && !validatePassword(data.password) && (
            <p className="text-xs text-red-600 mt-1">
              Password must be at least 6 characters with letters and numbers
            </p>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">
            Confirm Password *
          </label>
          <div className="relative">
            <input
              type={showPassword.confirm ? "text" : "password"}
              value={data.confirmPassword}
              onChange={(e) => onChange({ ...data, confirmPassword: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full pr-10"
              required
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#000000]"
            >
              {showPassword.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {data.confirmPassword && data.password !== data.confirmPassword && (
            <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
          )}
        </div>
      </div>
    </div>
  );
}
