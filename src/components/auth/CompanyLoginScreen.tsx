import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, ErrorSummary, Input, Alert, FormField } from "@/design-system";
import { PreWorkspaceShell, CompanyMonogram } from "./PreWorkspaceShell";

function formatLoginDate(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return (
    d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

function loginAtOf(info: { loginAt?: string; loggedInAt?: string } | null | undefined): string | undefined {
  return info?.loginAt || info?.loggedInAt;
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
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const usernameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) backToGateway();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isSubmitting, backToGateway]);

  useEffect(() => {
    if (failedAttempts >= 5 && !isLocked) {
      setIsLocked(true);
      setLockoutCountdown(30);
    }
  }, [failedAttempts, isLocked]);

  useEffect(() => {
    if (lockoutCountdown > 0) {
      const t = setTimeout(() => setLockoutCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    if (lockoutCountdown === 0 && isLocked) {
      setIsLocked(false);
    }
  }, [lockoutCountdown, isLocked]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const fe: { username?: string; password?: string } = {};
    if (!username.trim()) fe.username = "Username is required";
    if (!password) fe.password = "Password is required";
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    if (isLocked) {
      setError(`Sign-in temporarily locked. Wait ${lockoutCountdown} seconds, then try again.`);
      return;
    }

    if (!online) {
      setError(
        "You appear to be offline. Sign-in requires an available local company database on this device. Check your connection and retry.",
      );
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
          setError("Too many failed attempts. Sign-in is locked for 30 seconds.");
        } else {
          // Safe wording — does not confirm whether username exists
          setError(`Unable to sign in. Check your details and try again. ${5 - newCount} attempt(s) remaining.`);
        }
      } else {
        localStorage.setItem(attemptKey, "0");
      }
    } catch {
      setError("Sign-in could not be completed. Please try again. If this continues, contact your administrator.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const companyName =
    companySettings?.companyNameEn || companySettings?.name || "My Company";
  const lastAt = loginAtOf(lastLoginInfo);

  return (
    <PreWorkspaceShell title="Sign in" showBrandPanel>
      <div
        className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-6 shadow-[var(--ds-shadow-1)]"
        data-testid="company-login-screen"
      >
        <button
          type="button"
          onClick={() => backToGateway()}
          className="ds-focus-ring mb-5 inline-flex items-center gap-1.5 text-[13px] text-[var(--ds-text-muted)] hover:text-[var(--ds-text-default)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to companies
        </button>

        <div className="mb-5 flex items-center gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] p-3">
          <CompanyMonogram name={companyName} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-[var(--ds-text-strong)]">{companyName}</div>
            <div className="text-[13px] text-[var(--ds-text-muted)]">PAN: {companySettings?.panNumber || "—"}</div>
          </div>
        </div>

        <h2 className="mb-4 text-[18px] font-semibold text-[var(--ds-text-strong)]">Sign in</h2>

        {!online ? (
          <Alert tone="warning" title="Offline" className="mb-4">
            Network appears unavailable. Sign-in uses the local company database on this device when available.
          </Alert>
        ) : null}

        {error ? (
          <div ref={errorRef} tabIndex={-1} className="mb-4 outline-none">
            <ErrorSummary
              title="Unable to sign in"
              errors={[{ id: "auth", message: error }]}
            />
          </div>
        ) : null}

        {isLocked ? (
          <Alert tone="warning" title="Temporarily locked" className="mb-4">
            Too many failed attempts. Try again in <strong>{lockoutCountdown}s</strong>.
          </Alert>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
          <FormField
            id="orbix-login-username"
            label="Username"
            required
            error={fieldErrors.username}
          >
            <Input
              ref={usernameRef}
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined }));
              }}
            />
          </FormField>

          <div className="relative">
            <FormField
              id="orbix-login-password"
              label="Password"
              required
              error={fieldErrors.password}
            >
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                className="pr-11"
              />
            </FormField>
            <button
              type="button"
              className="ds-focus-ring absolute right-1 top-[28px] inline-flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-sm)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-hover)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLocked || isSubmitting}
            loading={isSubmitting}
            data-testid="login-submit"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-5 text-center text-[12px] text-[var(--ds-text-muted)]">
          <p>Forgot your password? Contact your system administrator.</p>
          {lastAt ? (
            <p className="mt-1">
              Last successful sign-in: {formatLoginDate(lastAt)}
              {lastLoginInfo?.username ? ` by ${lastLoginInfo.username}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </PreWorkspaceShell>
  );
}
