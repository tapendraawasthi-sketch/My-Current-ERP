import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Building2, CheckCircle, Shield, FileText } from "lucide-react";
import { useStore } from "@/store/useStore";

export default function SignInForm() {
  const { login } = useStore();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    if (lockoutCountdown > 0) {
      const timer = setTimeout(() => setLockoutCountdown(lockoutCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockoutCountdown === 0 && isLocked) {
      setIsLocked(false);
    }
  }, [lockoutCountdown, isLocked]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isLocked) {
      setError(`Account locked. Please wait ${lockoutCountdown} seconds.`);
      return;
    }

    const success = login(formData.username, formData.password);
    if (!success) {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 p-12 flex flex-col justify-between hidden lg:flex" style={{ background: "#E4F1D9", color: "#000000" }}>
        <div>
          <div className="flex items-center space-x-3 mb-12">
            <Building2 className="w-10 h-10" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#000000" }}>Sutra ERP</h1>
              <p className="text-sm mt-1" style={{ color: "#000000" }}>Professional Accounting for Nepal</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#000000" }}>Why Choose Sutra ERP?</h2>

            <div className="flex items-start space-x-3">
              <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold" style={{ color: "#000000" }}>Nepal-First Design</h3>
                <p className="text-sm" style={{ color: "#000000" }}>
                  Built specifically for Nepali businesses with BS date support, VAT compliance, and
                  IRD integration
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <FileText className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold" style={{ color: "#000000" }}>Complete Accounting</h3>
                <p className="text-sm" style={{ color: "#000000" }}>
                  Journal entries, invoicing, inventory management, multi-currency support, and
                  comprehensive reporting
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Shield className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold" style={{ color: "#000000" }}>Secure & Reliable</h3>
                <p className="text-sm" style={{ color: "#000000" }}>
                  Role-based access control, audit logs, data encryption, and automated backups
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm" style={{ color: "#000000" }}>
          Version 2.0 | © 2025 Sutra ERP | All rights reserved
        </div>
      </div>

      <div className="flex-1 bg-[#E4F1D9] p-8 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold" style={{ color: "#000000" }}>Welcome Back</h2>
            <p className="mt-2" style={{ color: "#000000" }}>Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#000000" }}>Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-[#EBF5E2] focus:outline-none focus:ring-2 focus:ring-[#3D6B25]/20 focus:border-[#3D6B25] w-full"
                required
                autoFocus
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#000000" }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-[#EBF5E2] focus:outline-none focus:ring-2 focus:ring-[#3D6B25]/20 focus:border-[#3D6B25] w-full pr-10"
                  required
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-[#000000]"
                  style={{ color: "#000000" }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-[12px]">
                {error}
              </div>
            )}

            {isLocked && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md text-[12px]">
                Account locked due to multiple failed attempts. Please wait {lockoutCountdown}{" "}
                seconds.
              </div>
            )}

            <button
              type="submit"
              disabled={isLocked}
              className="w-full h-10 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white font-medium rounded-md transition-colors disabled:opacity-50 text-[13px]"
            >
              Sign In
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm" style={{ color: "#000000" }}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>

      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#EBF5E2] rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Forgot Password?</h3>
            <p className="mb-4" style={{ color: "#000000" }}>
              Please contact your system administrator to reset your password.
            </p>
            <button onClick={() => setShowForgotPassword(false)} className="btn-primary w-full">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
