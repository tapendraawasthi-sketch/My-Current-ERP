import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Building2, CheckCircle, Shield, FileText } from "lucide-react";
import { useStore } from "../../store/useStore";

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
      {/* Left Panel */}
      <div 
        className="flex-1 p-12 flex flex-col justify-between hidden lg:flex"
        style={{ background: "var(--color-sidebar-bg)" }}
      >
        <div>
          <div className="flex items-center space-x-3 mb-12">
            <Building2 className="w-10 h-10" style={{ color: "var(--color-accent)" }} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "white" }}>Sutra ERP</h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-sidebar-text)" }}>Professional Accounting for Nepal</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "white" }}>Why Choose Sutra ERP?</h2>

            <div className="flex items-start space-x-3">
              <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: "var(--color-accent)" }} />
              <div>
                <h3 className="font-semibold" style={{ color: "white" }}>Nepal-First Design</h3>
                <p className="text-sm" style={{ color: "var(--color-sidebar-text)" }}>
                  Built specifically for Nepali businesses with BS date support, VAT compliance, and
                  IRD integration
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <FileText className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: "var(--color-accent)" }} />
              <div>
                <h3 className="font-semibold" style={{ color: "white" }}>Complete Accounting</h3>
                <p className="text-sm" style={{ color: "var(--color-sidebar-text)" }}>
                  Journal entries, invoicing, inventory management, multi-currency support, and
                  comprehensive reporting
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Shield className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: "var(--color-accent)" }} />
              <div>
                <h3 className="font-semibold" style={{ color: "white" }}>Secure & Reliable</h3>
                <p className="text-sm" style={{ color: "var(--color-sidebar-text)" }}>
                  Role-based access control, audit logs, data encryption, and automated backups
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm" style={{ color: "var(--color-sidebar-text)" }}>
          Version 2.0 | © 2025 Sutra ERP | All rights reserved
        </div>
      </div>

      {/* Right Panel */}
      <div 
        className="flex-1 p-8 flex items-center justify-center"
        style={{ background: "var(--color-canvas)" }}
      >
        <div 
          className="w-full max-w-md p-8 rounded-2xl"
          style={{ 
            background: "var(--color-surface)", 
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-modal)"
          }}
        >
          <div className="mb-8">
            <h2 className="text-3xl font-bold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.03em" }}>Welcome Back</h2>
            <p className="mt-2" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="h-[34px] px-[10px] text-[var(--font-size-base)] bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-input)] rounded-[var(--radius-md)] focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-focus-ring)] transition-all w-full"
                required
                autoFocus
                placeholder="Enter your username"
                style={{ fontFamily: "var(--font-sans)" }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="h-[34px] pl-[10px] pr-10 text-[var(--font-size-base)] bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-input)] rounded-[var(--radius-md)] focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-focus-ring)] transition-all w-full"
                  required
                  placeholder="Enter your password"
                  style={{ fontFamily: "var(--font-sans)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-[var(--color-text-primary)] focus:outline-none transition-colors"
                  style={{ color: "var(--color-text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="border px-4 py-3 rounded-[var(--radius-md)] text-[12px] font-medium" style={{ background: "var(--color-negative-bg)", color: "var(--color-negative)", borderColor: "color-mix(in srgb, var(--color-negative) 30%, transparent)" }}>
                {error}
              </div>
            )}

            {isLocked && (
              <div className="border px-4 py-3 rounded-[var(--radius-md)] text-[12px] font-medium" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)", borderColor: "color-mix(in srgb, var(--color-warning) 30%, transparent)" }}>
                Account locked due to multiple failed attempts. Please wait {lockoutCountdown}{" "}
                seconds.
              </div>
            )}

            <button
              type="submit"
              disabled={isLocked}
              className="w-full h-[36px] font-semibold rounded-[var(--radius-md)] transition-colors disabled:opacity-50 text-[13px] flex items-center justify-center cursor-pointer border focus:outline-none"
              style={{
                background: "var(--color-accent)",
                color: "white",
                borderColor: "var(--color-accent)"
              }}
              onMouseEnter={(e) => { if(!isLocked) e.currentTarget.style.background = "var(--color-accent-hover)" }}
              onMouseLeave={(e) => { if(!isLocked) e.currentTarget.style.background = "var(--color-accent)" }}
              onMouseDown={(e) => { if(!isLocked) e.currentTarget.style.background = "var(--color-accent-active)" }}
              onMouseUp={(e) => { if(!isLocked) e.currentTarget.style.background = "var(--color-accent-hover)" }}
            >
              Sign In
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm hover:underline cursor-pointer focus:outline-none bg-transparent border-none p-0"
                style={{ color: "var(--color-accent)" }}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>

      {showForgotPassword && (
        <div className="fixed inset-0 flex items-center justify-center z-[500]" style={{ background: "rgba(15,23,41,0.55)", backdropFilter: "blur(2px)" }}>
          <div className="p-6 w-full max-w-md relative flex flex-col" style={{ background: "var(--color-surface)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-modal)", border: "1px solid var(--color-border)" }}>
            <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>Forgot Password?</h3>
            <p className="mb-6" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
              Please contact your system administrator to reset your password.
            </p>
            <div className="flex justify-end">
               <button 
                 onClick={() => setShowForgotPassword(false)} 
                 className="h-[34px] px-[14px] text-[13px] font-medium rounded-[var(--radius-md)] transition-colors cursor-pointer border"
                 style={{ background: "var(--color-surface-raised)", color: "var(--color-text-primary)", borderColor: "var(--color-border)" }}
                 onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-neutral-bg)" }}
                 onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-surface-raised)" }}
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
