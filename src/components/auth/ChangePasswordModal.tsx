import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useStore } from "@/store/useStore";
import toast from "@/lib/appToast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Button,
} from "@/design-system";

interface Props {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ userId, isOpen, onClose }: Props) {
  const currentUser = useStore((state) => state.currentUser);
  const updateUser = useStore((state) => state.updateUser);
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [saving, setSaving] = useState(false);

  const isOwnPassword = currentUser?.id === userId;

  const getPasswordStrength = (
    password: string,
  ): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
    if (score <= 3) return { score, label: "Fair", color: "bg-amber-500" };
    if (score <= 4) return { score, label: "Good", color: "bg-blue-500" };
    return { score, label: "Strong", color: "bg-green-500" };
  };

  const strength = getPasswordStrength(formData.newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!/\d/.test(formData.newPassword)) {
      toast.error("Password must contain at least 1 number");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setSaving(true);
      await updateUser(userId, { password: formData.newPassword });
      toast.success("Password changed successfully");
      setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onClose();
    } catch {
      toast.error("Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "h-8 w-full px-2.5 pr-9 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="small" showClose>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-3">
            {isOwnPassword && (
              <div>
                <label className={labelCls}>Current password *</label>
                <div className="relative">
                  <input
                    type={showPassword.current ? "text" : "password"}
                    value={formData.currentPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, currentPassword: e.target.value })
                    }
                    className={inputCls}
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword({ ...showPassword, current: !showPassword.current })
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                    aria-label={showPassword.current ? "Hide password" : "Show password"}
                  >
                    {showPassword.current ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>New password * (min 6 chars, 1 number)</label>
              <div className="relative">
                <input
                  type={showPassword.new ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className={inputCls}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  aria-label={showPassword.new ? "Hide password" : "Show password"}
                >
                  {showPassword.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.newPassword && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${strength.color}`}
                      style={{ width: `${(strength.score / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600">{strength.label}</span>
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Confirm new password *</label>
              <div className="relative">
                <input
                  type={showPassword.confirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  className={inputCls}
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword({ ...showPassword, confirm: !showPassword.confirm })
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  aria-label={showPassword.confirm ? "Hide password" : "Show password"}
                >
                  {showPassword.confirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {formData.confirmPassword &&
                formData.newPassword !== formData.confirmPassword && (
                  <p className="text-[11px] text-red-600 mt-1">Passwords do not match</p>
                )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" size="small" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="small" loading={saving}>
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
