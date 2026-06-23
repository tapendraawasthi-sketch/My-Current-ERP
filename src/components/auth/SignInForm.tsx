import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Building2,
  CheckCircle,
  Shield,
  FileText,
  Loader2,
  KeyRound,
  Mail,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { getDB } from "../../lib/db";
import { sha256Fallback } from "../../lib/utils";

export default function SignInForm() {
  const { login, lockedUntil, companySettings } = useStore();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  // Forgot password flow state
  const [fpStep, setFpStep] = useState<"closed" | "username" | "otp" | "newpass" | "done">(
    "closed",
  );
  const [fpUsername, setFpUsername] = useState("");
  const [fpEmail, setFpEmail] = useState(""); // masked display email
  const [fpRealEmail, setFpRealEmail] = useState(""); // actual email used for API
  const [fpOtp, setFpOtp] = useState("");
  const [expectedOtp, setExpectedOtp] = useState("");
  const [fpNewPass, setFpNewPass] = useState("");
  const [fpConfirmPass, setFpConfirmPass] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState("");
  const [fpInfo, setFpInfo] = useState("");
  const [fpResendCooldown, setFpResendCooldown] = useState(0);
  const [fpShowNewPass, setFpShowNewPass] = useState(false);
  const [fpShowConfirmPass, setFpShowConfirmPass] = useState(false);

  const isLocked = lockedUntil ? new Date(lockedUntil) > new Date() : false;

  useEffect(() => {
    if (!isLocked || !lockedUntil) {
      setLockoutCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const diff = Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000);
      setLockoutCountdown(diff > 0 ? diff : 0);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [isLocked, lockedUntil]);

  useEffect(() => {
    if (fpResendCooldown > 0) {
      const t = setTimeout(() => setFpResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [fpResendCooldown]);

  const closeForgotPassword = () => {
    setFpStep("closed");
    setFpUsername("");
    setFpEmail("");
    setFpRealEmail("");
    setFpOtp("");
    setFpNewPass("");
    setFpConfirmPass("");
    setFpError("");
    setFpInfo("");
    setFpLoading(false);
    setExpectedOtp("");
    setFpShowNewPass(false);
    setFpShowConfirmPass(false);
  };

  const handleFpStep1 = async () => {
    setFpError("");
    setFpInfo("");
    const uname = fpUsername.trim().toLowerCase();
    if (!uname) {
      setFpError("Please enter your username.");
      return;
    }

    setFpLoading(true);
    try {
      const db = getDB();
      const allUsers = await db.users.toArray();
      const user = allUsers.find((u) => u.username.toLowerCase() === uname);

      // DEBUG: Log the user object fetched from Dexie to verify it exists and has an email
      console.log(
        "[DEBUG handleFpStep1] DB Lookup result for",
        uname,
        ":",
        user ? { ...user, password: "[REDACTED]" } : null,
      );

      if (!user) {
        setFpError(
          `Username "${fpUsername}" not found. Please double-check your username spelling or register a new company.`,
        );
        return;
      }

      if (!user.isActive) {
        setFpError("This account is inactive. Please contact your administrator.");
        return;
      }

      // Generate local OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setExpectedOtp(generatedOtp);

      if (!user.email) {
        setFpEmail("(no email registered)");
        setFpRealEmail("local-offline");
        setFpInfo("OTP generated for local mode.");
      } else {
        // Mask email for display: abc@gmail.com → ab***@gmail.com
        const masked = user.email.replace(/(.{2}).+(@.+)/, "$1***$2");
        setFpEmail(masked);
        setFpRealEmail(user.email);
        setFpInfo(`OTP generated for offline mode.`);
      }

      setFpStep("otp");
      setFpResendCooldown(60);

      // Show alert as a backup
      try {
        alert(`LOCAL OFFLINE MODE\n\nPassword Reset OTP for ${user.username}: ${generatedOtp}`);
      } catch (e) {
        console.warn("Alert blocked:", e);
      }
    } catch (err) {
      setFpError("Error looking up user. Please try again.");
    } finally {
      setFpLoading(false);
    }
  };

  const handleFpStep2 = async () => {
    setFpError("");
    setFpInfo("");
    if (fpOtp.length !== 6) {
      setFpError("Please enter all 6 digits of the OTP.");
      return;
    }
    if (!expectedOtp) {
      setFpError("No OTP was generated. Please go back and try again.");
      return;
    }

    setFpLoading(true);
    try {
      if (fpOtp.trim() !== expectedOtp) {
        setFpError("Invalid OTP.");
        return;
      }
      setFpInfo("OTP verified successfully! Please set your new password.");
      setFpStep("newpass");
    } catch {
      setFpError("Error verifying OTP.");
    } finally {
      setFpLoading(false);
    }
  };

  const handleFpResend = async () => {
    if (fpResendCooldown > 0) return;
    setFpError("");
    setFpOtp("");
    setFpInfo("");
    setFpLoading(true);
    try {
      const db = getDB();
      const allUsersR = await db.users.toArray();
      const user = allUsersR.find(
        (u) => u.username.toLowerCase() === fpUsername.trim().toLowerCase(),
      );
      if (!user) {
        setFpError("Cannot resend. Please start over.");
        return;
      }

      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setExpectedOtp(generatedOtp);
      setFpInfo("New OTP generated.");
      setFpResendCooldown(60);

      try {
        alert(`LOCAL OFFLINE MODE\n\nNew Password Reset OTP for ${user.username}: ${generatedOtp}`);
      } catch (e) {
        console.warn("Alert blocked:", e);
      }
    } catch {
      setFpError("Error generating new OTP.");
    } finally {
      setFpLoading(false);
    }
  };

  const handleFpStep3 = async () => {
    setFpError("");
    setFpInfo("");

    if (fpNewPass.length < 6) {
      setFpError("Password must be at least 6 characters.");
      return;
    }
    if (!/[a-zA-Z]/.test(fpNewPass)) {
      setFpError("Password must contain at least one letter.");
      return;
    }
    if (!/\d/.test(fpNewPass)) {
      setFpError("Password must contain at least one number.");
      return;
    }
    if (fpNewPass !== fpConfirmPass) {
      setFpError("Passwords do not match. Please re-enter.");
      return;
    }

    setFpLoading(true);
    try {
      const db = getDB();
      const uname = fpUsername.trim().toLowerCase();
      const allUsersP = await db.users.toArray();
      const user = allUsersP.find((u) => u.username.toLowerCase() === uname);
      if (!user) {
        setFpError("User not found. Please start over.");
        closeForgotPassword();
        return;
      }

      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      const hashed = await sha256Fallback(fpNewPass + salt);
      await db.users.update(user.id, { password: hashed, passwordSalt: salt } as any);

      setExpectedOtp("");

      setFpStep("done");
      // Auto-close after 3 seconds
      setTimeout(() => closeForgotPassword(), 3000);
    } catch {
      setFpError("Failed to update password. Please try again.");
    } finally {
      setFpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isLocked) {
      setError(`Account locked. Please wait ${lockoutCountdown} seconds.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await login(formData.username, formData.password);
      if (!success) {
        setError("Invalid username or password");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 bg-[#1557b0] p-12 flex flex-col justify-between text-white hidden lg:flex">
        <div>
          <div className="flex items-center space-x-3 mb-12">
            <Building2 className="w-10 h-10" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sutra ERP</h1>
              <p className="text-blue-100 text-sm mt-1">Professional Accounting for Nepal</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-4">Why Choose Sutra ERP?</h2>

            <div className="flex items-start space-x-3">
              <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold">Nepal-First Design</h3>
                <p className="text-indigo-200 text-sm">
                  Built specifically for Nepali businesses with BS date support, VAT compliance, and
                  IRD integration
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <FileText className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold">Complete Accounting</h3>
                <p className="text-indigo-200 text-sm">
                  Journal entries, invoicing, inventory management, multi-currency support, and
                  comprehensive reporting
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Shield className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold">Secure & Reliable</h3>
                <p className="text-indigo-200 text-sm">
                  Role-based access control, audit logs, data encryption, and automated backups
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-indigo-200 text-sm">
          Version 2.0 | © 2025 Sutra ERP | All rights reserved
        </div>
      </div>

      <div className="flex-1 bg-white p-8 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
            <p className="text-gray-600 mt-2">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                required
                autoFocus
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full pr-10"
                  required
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
              disabled={isLocked || isSubmitting}
              className="w-full h-10 bg-[#1557b0] hover:bg-[#0f4a96] text-white font-medium rounded-md transition-colors disabled:opacity-50 text-[13px] flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin inline" />}
              Sign In
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setFpStep("username");
                  setFpError("");
                  setFpInfo("");
                }}
                className="text-sm text-[#1557b0] hover:text-indigo-800"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>

      {fpStep !== "closed" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#1557b0] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-white" />
                <div>
                  <h3 className="text-white font-bold text-[15px]">Reset Password</h3>
                  <p className="text-blue-200 text-[11px]">Sutra ERP Account Recovery</p>
                </div>
              </div>
              {fpStep !== "done" && (
                <button
                  onClick={closeForgotPassword}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Step Progress Bar — 3 steps */}
            {fpStep !== "done" && (
              <div className="bg-[#f0f4ff] px-6 py-3 flex items-center gap-0">
                {[
                  { key: "username", label: "Username", num: 1 },
                  { key: "otp", label: "Verify OTP", num: 2 },
                  { key: "newpass", label: "New Password", num: 3 },
                ].map((s, i) => {
                  const steps = ["username", "otp", "newpass"];
                  const currentIdx = steps.indexOf(fpStep);
                  const stepIdx = steps.indexOf(s.key);
                  const isDone = stepIdx < currentIdx;
                  const isActive = stepIdx === currentIdx;
                  return (
                    <React.Fragment key={s.key}>
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${isDone ? "bg-[#15803d] text-white" : isActive ? "bg-[#1557b0] text-white" : "bg-gray-200 text-gray-400"}`}
                        >
                          {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                        </div>
                        <span
                          className={`text-[9px] font-semibold ${isActive ? "text-[#1557b0]" : isDone ? "text-[#15803d]" : "text-gray-400"}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      {i < 2 && (
                        <div
                          className={`flex-1 h-[2px] mx-1 mb-4 transition-colors ${isDone ? "bg-[#15803d]" : "bg-gray-200"}`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* STEP: username */}
            {fpStep === "username" && (
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-blue-800">
                    Enter your username. A 6-digit OTP will be sent to your registered email
                    address.
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={fpUsername}
                    onChange={(e) => setFpUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFpStep1()}
                    autoFocus
                    placeholder="Enter your username"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
                {fpError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-[12px] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {fpError}
                  </div>
                )}
                <button
                  onClick={handleFpStep1}
                  disabled={fpLoading}
                  className="w-full h-10 bg-[#1557b0] hover:bg-[#0f4a96] text-white font-semibold rounded-lg text-[13px] flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                >
                  {fpLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" /> Send OTP to My Email
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STEP: otp */}
            {fpStep === "otp" && (
              <div className="p-6 space-y-4">
                {fpInfo && (
                  <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2.5 rounded-lg text-[12px] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    {fpInfo}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-[11px] text-blue-800 font-semibold mb-1">Your Reset OTP is:</p>
                  <p className="text-2xl font-bold font-mono text-[#1557b0] tracking-[0.1em] select-all">
                    {expectedOtp}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    (Displayed here for your convenience in this offline application)
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-[12px] text-gray-600 mb-1">
                    Enter the 6-digit code displayed above
                  </p>
                  <p className="text-[10px] text-gray-400">Masked registered email: {fpEmail}</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-2 text-center">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={fpOtp}
                    onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => e.key === "Enter" && fpOtp.length === 6 && handleFpStep2()}
                    autoFocus
                    placeholder="• • • • • •"
                    className="h-14 px-4 text-center text-[28px] font-mono tracking-[0.6em] border-2 border-gray-300 rounded-xl focus:border-[#1557b0] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 w-full bg-gray-50"
                  />
                </div>
                {fpError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-[12px] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {fpError}
                  </div>
                )}
                <button
                  onClick={handleFpStep2}
                  disabled={fpLoading || fpOtp.length !== 6}
                  className="w-full h-10 bg-[#1557b0] hover:bg-[#0f4a96] text-white font-semibold rounded-lg text-[13px] flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                >
                  {fpLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    "Verify OTP →"
                  )}
                </button>
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => {
                      setFpStep("username");
                      setFpOtp("");
                      setFpError("");
                    }}
                    className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back
                  </button>
                  <button
                    onClick={handleFpResend}
                    disabled={fpResendCooldown > 0 || fpLoading}
                    className="text-[11px] text-[#1557b0] hover:text-[#0f4a96] font-semibold disabled:text-gray-400 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {fpResendCooldown > 0 ? `Resend in ${fpResendCooldown}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}

            {/* STEP: newpass */}
            {fpStep === "newpass" && (
              <div className="p-6 space-y-4">
                {fpInfo && (
                  <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2.5 rounded-lg text-[12px] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    {fpInfo}
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={fpShowNewPass ? "text" : "password"}
                      value={fpNewPass}
                      onChange={(e) => setFpNewPass(e.target.value)}
                      placeholder="Min 6 chars, include letter + number"
                      className="h-8 px-2.5 pr-9 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setFpShowNewPass(!fpShowNewPass)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {fpShowNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={fpShowConfirmPass ? "text" : "password"}
                      value={fpConfirmPass}
                      onChange={(e) => setFpConfirmPass(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleFpStep3()}
                      placeholder="Re-enter new password"
                      className={`h-8 px-2.5 pr-9 text-[12px] border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full ${fpConfirmPass && fpNewPass !== fpConfirmPass ? "border-red-400" : "border-gray-300"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setFpShowConfirmPass(!fpShowConfirmPass)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {fpShowConfirmPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {fpConfirmPass && fpNewPass !== fpConfirmPass && (
                    <p className="text-[10px] text-red-500 mt-0.5">Passwords do not match</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">
                    Password Requirements:
                  </p>
                  <ul className="text-[10px] text-gray-500 space-y-0.5">
                    <li className={fpNewPass.length >= 6 ? "text-green-600" : ""}>
                      ✓ Minimum 6 characters
                    </li>
                    <li className={/[a-zA-Z]/.test(fpNewPass) ? "text-green-600" : ""}>
                      ✓ At least one letter
                    </li>
                    <li className={/\d/.test(fpNewPass) ? "text-green-600" : ""}>
                      ✓ At least one number
                    </li>
                  </ul>
                </div>
                {fpError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-[12px] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {fpError}
                  </div>
                )}
                <button
                  onClick={handleFpStep3}
                  disabled={fpLoading}
                  className="w-full h-10 bg-[#15803d] hover:bg-[#166534] text-white font-semibold rounded-lg text-[13px] flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                >
                  {fpLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Updating Password...
                    </>
                  ) : (
                    "✓ Change Password"
                  )}
                </button>
              </div>
            )}

            {/* STEP: done */}
            {fpStep === "done" && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9 text-green-600" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900">Password Changed!</h3>
                  <p className="text-[12px] text-gray-500 mt-2">
                    Your password has been updated successfully.
                  </p>
                  <p className="text-[12px] text-gray-500">
                    You can now sign in with your new password.
                  </p>
                </div>
                <p className="text-[11px] text-gray-400">This dialog will close automatically...</p>
              </div>
            )}

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-2.5 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 text-center">
                🔐 Secured by Sutra ERP • OTP expires in 10 minutes
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
