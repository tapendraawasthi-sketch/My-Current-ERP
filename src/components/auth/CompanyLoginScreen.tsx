// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Building2, ArrowLeft } from "lucide-react";
import { useStore } from "@/store/useStore";
import AuthBrandingPanel from "./AuthBrandingPanel";

function formatLoginDate(isoString: string): string {
  const d = new Date(isoString);
  return (
    d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function CompanyLoginScreen() {
  const { companySettings, lastLoginInfo, loginFailedAttempts, login, backToGateway } = useStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  const usernameRef = useRef<HTMLInputElement>(null);

  // Auto-focus username field
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  // Escape key to go back to gateway
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) backToGateway();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting]);

  // Watch store's loginFailedAttempts to trigger lockout
  useEffect(() => {
    if (loginFailedAttempts >= 5 && !isLocked) {
      setIsLocked(true);
      setLockoutCountdown(30);
    }
  }, [loginFailedAttempts]);

  // Lockout countdown
  useEffect(() => {
    if (lockoutCountdown > 0) {
      const timer = setTimeout(() => setLockoutCountdown(lockoutCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockoutCountdown === 0 && isLocked) {
      setIsLocked(false);
    }
  }, [lockoutCountdown, isLocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setError(`Account locked. Please wait ${lockoutCountdown} seconds.`);
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const success = await login(username.trim(), password);
      if (!success) {
        setError("Invalid username or password");
      }
      // On success: store sets authStage="authenticated" — nothing to do here
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const companyName = companySettings?.companyNameEn || companySettings?.name || "My Company";
  const companyPan = companySettings?.panNumber || "—";

  return (
    <div className="min-h-screen flex" style={{ background: "#E4F1D9" }}>
      {/* Left: Branding Panel */}
      <AuthBrandingPanel />

      {/* Right: Login Form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: "#E4F1D9" }}
      >
        <div className="w-full max-w-md">
          {/* Back to Companies */}
          <button
            type="button"
            onClick={backToGateway}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "#1f2937",
              padding: "0",
              marginBottom: "8px",
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to Companies
          </button>

          {/* Company Identity Banner */}
          <div
            style={{
              background: "#EBF5E2",
              border: "1px solid #000000",
              borderRadius: "4px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                background: "#D4EABD",
                border: "1px solid #000000",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Building2 style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#1f2937" }}>
                {companyName}
              </div>
              <div style={{ fontSize: "11px", color: "#1f2937", marginTop: "2px" }}>
                PAN: {companyPan}
              </div>
            </div>
          </div>

          {/* Login Heading */}
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#1f2937",
              marginBottom: "20px",
            }}
          >
            Login
          </h2>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "#1f2937" }}
              >
                Username
              </label>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-[#d1d5db] rounded-md bg-[#f9fafb] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "#1f2937" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-[#d1d5db] rounded-md bg-[#f9fafb] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1f2937" }}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-[12px]">
                {error}
              </div>
            )}

            {/* Lockout Warning */}
            {isLocked && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md text-[12px]">
                Account locked due to multiple failed attempts. Please wait {lockoutCountdown} seconds.
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLocked || isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ height: "40px", fontSize: "13px" }}
            >
              {isSubmitting ? (
                <>
                  <span
                    className="border-2 border-t-transparent rounded-full animate-spin"
                    style={{ width: 14, height: 14, borderColor: "#000000", borderTopColor: "transparent" }}
                  />
                  Signing in…
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>

          {/* Forgot Password Note */}
          <p
            className="text-center mt-4"
            style={{ fontSize: "11px", color: "#666" }}
          >
            Forgot your password? Contact your system administrator.
          </p>

          {/* Last Login Security Indicator */}
          <p
            className="text-center mt-2"
            style={{ fontSize: "11px", color: "#666" }}
          >
            {lastLoginInfo
              ? `Last login: ${formatLoginDate(lastLoginInfo.loginAt)} by ${lastLoginInfo.username}`
              : "No previous login recorded."}
          </p>
        </div>
      </div>
    </div>
  );
}
