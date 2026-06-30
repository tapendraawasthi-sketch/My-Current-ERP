import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../../store/useStore";
import { Eye, EyeOff, AlertTriangle, Lock } from "lucide-react";

const LOCKOUT_DURATION_MS = 30_000; // 30 seconds
const MAX_ATTEMPTS = 5;

const CompanyLoginScreen: React.FC = () => {
  const { login, companies } = useStore();
  const [username,  setUsername ] = useState("");
  const [password,  setPassword ] = useState("");
  const [showPw,    setShowPw   ] = useState(false);
  const [loading,   setLoading  ] = useState(false);
  const [error,     setError    ] = useState("");
  const [attempts,  setAttempts ] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const company = companies[0];

  // Fix BUG-080: read lockout state from localStorage on mount
  useEffect(() => {
    const attKey    = "erp_login_attempts";
    const lockKey   = "erp_lockout_until";

    const savedAttempts = parseInt(localStorage.getItem(attKey) ?? "0", 10);
    const lockoutUntil  = parseInt(localStorage.getItem(lockKey) ?? "0", 10);
    const now           = Date.now();

    setAttempts(savedAttempts);

    if (lockoutUntil > now) {
      // Still locked
      startCountdown(Math.ceil((lockoutUntil - now) / 1000));
    }
  }, []);

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          localStorage.removeItem("erp_lockout_until");
          localStorage.removeItem("erp_login_attempts");
          setAttempts(0);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const isLocked = countdown > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || loading) return;

    setLoading(true);
    setError("");

    try {
      const ok = await login(username, password, company?.id);
      if (!ok) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        localStorage.setItem("erp_login_attempts", String(newAttempts));

        if (newAttempts >= MAX_ATTEMPTS) {
          // Fix BUG-080: store lockout expiry in localStorage so refresh doesn't bypass it
          const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
          localStorage.setItem("erp_lockout_until", String(lockoutUntil));
          startCountdown(LOCKOUT_DURATION_MS / 1000);
          setError(`Too many failed attempts. Please wait ${LOCKOUT_DURATION_MS / 1000} seconds.`);
        } else {
          setError(`Invalid credentials. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
        }
      } else {
        // Success: clear attempt counter
        localStorage.removeItem("erp_login_attempts");
        localStorage.removeItem("erp_lockout_until");
        setAttempts(0);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = `
    w-full h-10 px-3 text-[13px] border border-gray-300 rounded-md bg-white
    focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]
    disabled:bg-gray-50 disabled:cursor-not-allowed
  `;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f6fa] p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8 border border-gray-200">
        {/* Logo / Title */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#1557b0] rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl font-black">S</span>
          </div>
          <h1 className="text-[20px] font-bold text-gray-800">SUTRA ERP</h1>
          {company?.name && (
            <p className="text-[12px] text-gray-500 mt-1">{company.name}</p>
          )}
        </div>

        {/* Lockout banner */}
        {isLocked && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <Lock className="h-4 w-4 shrink-0" />
            <div className="text-[12px]">
              <div className="font-semibold">Account temporarily locked</div>
              <div>Retry in {countdown} seconds</div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isLocked && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-[12px]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Username / Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLocked || loading}
              autoFocus
              autoComplete="username"
              className={inputCls}
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLocked || loading}
                autoComplete="current-password"
                className={`${inputCls} pr-10`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLocked || loading || !username || !password}
            className="
              w-full h-11 bg-[#1557b0] hover:bg-[#0f4a96] text-white
              text-[14px] font-semibold rounded-md
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
          >
            {loading ? "Signing in…" : isLocked ? `Locked (${countdown}s)` : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-gray-400">
          SUTRA ERP v1.0 · Nepal Accounting System
        </p>
      </div>
    </div>
  );
};

export default CompanyLoginScreen;
