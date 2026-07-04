// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Building2, ArrowLeft, AlertCircle } from "lucide-react";
import { useStore } from "@/store/useStore";

function formatLoginDate(isoString: string): string {
  const d = new Date(isoString);
  return (
    d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function CompanyLoginScreen() {
  const { companySettings, lastLoginInfo, login, backToGateway } = useStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);
  const attemptKey = `loginAttempts_${companySettings?.id || "default"}`;
  const [failedAttempts, setFailedAttempts] = useState(() =>
    parseInt(localStorage.getItem(attemptKey) || "0", 10),
  );

  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) backToGateway();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isSubmitting]);

  useEffect(() => {
    if (failedAttempts >= 5 && !isLocked) {
      setIsLocked(true);
      setLockoutCountdown(30);
    }
  }, [failedAttempts]);

  useEffect(() => {
    if (lockoutCountdown > 0) {
      const t = setTimeout(() => setLockoutCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    } else if (lockoutCountdown === 0 && isLocked) {
      setIsLocked(false);
    }
  }, [lockoutCountdown, isLocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    // Inline field validation
    const fe: { username?: string; password?: string } = {};
    if (!username.trim()) fe.username = "Username is required";
    if (!password) fe.password = "Password is required";
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    if (isLocked) {
      setError(`Account locked. Please wait ${lockoutCountdown} seconds before trying again.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await login(username.trim(), password);
      if (!success) {
        const newCount = failedAttempts + 1;
        setFailedAttempts(newCount);
        localStorage.setItem(attemptKey, String(newCount));
        if (newCount >= 5) {
          setError("Too many failed attempts. Account locked for 30 seconds.");
        } else {
          setError(`Invalid username or password. ${5 - newCount} attempt(s) remaining.`);
        }
      } else {
        localStorage.setItem(attemptKey, "0");
      }
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const companyName = companySettings?.companyNameEn || companySettings?.name || "My Company";

  const inputStyle = (hasError: boolean) => ({
    width: "100%",
    height: "36px",
    padding: "0 36px 0 10px",
    fontSize: "13px",
    border: `1px solid ${hasError ? "#dc2626" : "#d1d5db"}`,
    background: "#ffffff",
    color: "#111827",
    borderRadius: "6px",
    outline: "none",
  });

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#f5f6fa" }}
    >
      <div
        className="w-full max-w-sm rounded-xl shadow-lg p-8"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
      >
        {/* Back button */}
        <button
          type="button"
          onClick={backToGateway}
          className="flex items-center gap-1.5 text-[12px] text-gray-500 mb-6 transition-colors hover:text-gray-800"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Companies
        </button>

        {/* Company Banner */}
        <div
          className="flex items-center gap-3 rounded-lg p-3 mb-6"
          style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "#0369a1" }}
          >
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[13px] text-gray-800 truncate">{companyName}</div>
            <div className="text-[11px] text-gray-500">
              PAN: {companySettings?.panNumber || "—"}
            </div>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-[20px] font-bold text-gray-800 mb-5">Sign In</h2>

        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="mb-4">
            <label
              className="block text-[11px] font-medium mb-1"
              style={{ color: fieldErrors.username ? "#dc2626" : "#374151" }}
            >
              Username{" "}
              {fieldErrors.username && <span className="ml-1">— {fieldErrors.username}</span>}
            </label>
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined }));
              }}
              style={{
                ...inputStyle(!!fieldErrors.username),
                padding: "0 10px",
              }}
              placeholder="e.g. admin"
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div className="mb-5">
            <label
              className="block text-[11px] font-medium mb-1"
              style={{ color: fieldErrors.password ? "#dc2626" : "#374151" }}
            >
              Password{" "}
              {fieldErrors.password && <span className="ml-1">— {fieldErrors.password}</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                style={inputStyle(!!fieldErrors.password)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-4 px-3 py-2.5 rounded-md flex items-start gap-2"
              style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#dc2626" }} />
              <span className="text-[12px]" style={{ color: "#b91c1c" }}>
                {error}
              </span>
            </div>
          )}

          {/* Lockout */}
          {isLocked && (
            <div
              className="mb-4 px-3 py-2.5 rounded-md"
              style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}
            >
              <p className="text-[12px] font-medium">
                Account locked. Try again in <strong>{lockoutCountdown}s</strong>.
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLocked || isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              height: "40px",
              fontSize: "14px",
              background: "#1557b0",
              color: "#ffffff",
              border: "none",
              cursor: isLocked || isSubmitting ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!isLocked && !isSubmitting)
                (e.currentTarget as HTMLButtonElement).style.background = "#0f4a96";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#1557b0";
            }}
          >
            {isSubmitting ? (
              <>
                <span
                  className="animate-spin rounded-full border-2"
                  style={{
                    width: 16,
                    height: 16,
                    borderColor: "#ffffff",
                    borderTopColor: "transparent",
                  }}
                />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer notes */}
        <div className="mt-5 text-center">
          <p className="text-[11px] text-gray-400">
            Forgot your password? Contact your system administrator.
          </p>
          {lastLoginInfo && (
            <p className="text-[10px] text-gray-400 mt-1">
              Last login: {formatLoginDate(lastLoginInfo.loginAt)} by {lastLoginInfo.username}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
