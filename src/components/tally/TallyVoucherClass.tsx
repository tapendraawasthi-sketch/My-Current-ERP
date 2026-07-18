// @ts-nocheck
// src/components/tally/TallyVoucherClass.tsx
/**
 * Voucher Class management — PDF §5 "Voucher Classes for Faster Entry".
 * A voucher class pre-fills the primary account field (e.g. "Cash Payment"
 * auto-selects Cash-in-Hand).  Classes are stored in memory (store) and
 * shown as a quick-select strip at the top of Payment / Receipt vouchers.
 */
import React, { useState } from "react";
import { Plus, Trash2, X, Zap } from "lucide-react";
import type { VoucherClass, TallyType } from "@/lib/tallyVoucher";
import { cryptoRandomId } from "@/lib/tallyVoucher";

// ─── Strip (rendered inside voucher entry) ────────────────────────────────────
interface StripProps {
  classes: VoucherClass[];
  activeId: string | null;
  onSelect: (cls: VoucherClass) => void;
}

export const VoucherClassStrip: React.FC<StripProps> = ({ classes, activeId, onSelect }) => {
  if (!classes.length) return null;
  return (
    <div className="flex items-center gap-1 px-3 py-1 bg-[var(--t-muted)] border-b border-[var(--t-line-soft)]">
      <Zap size={12} className="mr-1 shrink-0" style={{ color: "var(--t-accent)" }} />
      <span className="tally-label mr-2">Class:</span>
      {classes.map((cls) => (
        <button
          key={cls.id}
          type="button"
          className={`tally-hint ${cls.id === activeId ? "tally-btn-primary" : ""}`}
          style={{ fontSize: 11, padding: "1px 8px" }}
          onClick={() => onSelect(cls)}
          title={`Pre-fill: ${cls.defaultAccountName}`}
        >
          {cls.name}
        </button>
      ))}
    </div>
  );
};

// ─── Manager modal (accessed from settings / F12 panel) ──────────────────────
interface ManagerProps {
  classes: VoucherClass[];
  accounts: any[];
  voucherType: TallyType;
  onSave: (classes: VoucherClass[]) => void;
  onClose: () => void;
}

export const VoucherClassManager: React.FC<ManagerProps> = ({
  classes,
  accounts,
  voucherType,
  onSave,
  onClose,
}) => {
  const [list, setList] = useState<VoucherClass[]>(classes);
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");

  const ledgers = accounts.filter((a) => !a.isGroup && a.isActive !== false);
  const selectedAcct = ledgers.find((a) => a.id === accountId);

  const addCls = () => {
    if (!name.trim() || !accountId) return;
    const newCls: VoucherClass = {
      id: cryptoRandomId(),
      name: name.trim(),
      voucherType,
      defaultAccountId: accountId,
      defaultAccountName: selectedAcct?.name || accountId,
    };
    setList((p) => [...p, newCls]);
    setName("");
    setAccountId("");
  };

  const removeCls = (id: string) => setList((p) => p.filter((c) => c.id !== id));

  return (
    <div className="tally-modal-overlay" onClick={onClose}>
      <div className="tally-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="tally-modal-head">
          <span className="flex items-center gap-2">
            <Zap size={14} /> Voucher Classes — {voucherType}
          </span>
          <button onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tally-modal-body">
          {/* Add new */}
          <div className="flex gap-2 mb-4">
            <input
              className="tally-input flex-1"
              placeholder="Class name e.g. Cash Payment"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="tally-input"
              style={{ width: 200 }}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Select default ledger…</option>
              {ledgers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="tally-btn tally-btn-primary"
              onClick={addCls}
              disabled={!name.trim() || !accountId}
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Existing classes */}
          {list.length === 0 ? (
            <p style={{ fontSize: 12, color: "gray", textAlign: "center", padding: 16 }}>
              No classes yet. Add one above.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Default Ledger</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((cls) => (
                  <tr key={cls.id}>
                    <td>{cls.name}</td>
                    <td>{cls.defaultAccountName}</td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="tally-btn tally-btn-danger py-0.5 px-2"
                        onClick={() => removeCls(cls.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-2 p-3 border-t border-[var(--ds-border-default)]">
          <button type="button" className="tally-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="tally-btn tally-btn-primary"
            onClick={() => {
              onSave(list);
              onClose();
            }}
          >
            Save Classes
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoucherClassStrip;
