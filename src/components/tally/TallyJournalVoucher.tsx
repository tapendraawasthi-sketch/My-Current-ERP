import React, { useState, useCallback } from "react";
import toast from "@/lib/appToast";
import TallyVoucherShell from "./TallyVoucherShell";
import TallyAccountSelect from "./TallyAccountSelect";
import TallyVoucherPrint from "./TallyVoucherPrint";
import TallyVoucherList from "./TallyVoucherList";
import {
  Voucher,
  VoucherLine,
  blankVoucher,
  blankLine,
  recalcTotals,
  isBalanced,
} from "@/lib/tallyVoucher";
import { formatMoney, parseMoney } from "@/lib/tallyFormat";
import { useStore } from "@/store/useStore";

export const TallyJournalVoucher: React.FC = () => {
  const [voucher, setVoucher] = useState<Voucher>(() => blankVoucher("Journal"));
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState<"account" | "debit" | "credit" | "narration">(
    "account",
  );
  const [showPrint, setShowPrint] = useState(false);
  const [showList, setShowList] = useState(false);

  const { addVoucher, updateVoucher, vouchers, cancelVoucher } = useStore();

  const updateLine = useCallback((idx: number, patch: Partial<VoucherLine>) => {
    setVoucher((prev) => {
      const lines = prev.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
      const totals = recalcTotals(lines);
      return { ...prev, lines, totalDebit: totals.totalDebit, totalCredit: totals.totalCredit };
    });
  }, []);

  const addRow = useCallback(() => {
    setVoucher((prev) => ({ ...prev, lines: [...prev.lines, blankLine()] }));
    setSelectedRow((prev) => voucher.lines.length);
  }, [voucher.lines.length]);

  const duplicateRow = useCallback(() => {
    const line = voucher.lines[selectedRow];
    if (!line) return;
    const copy: VoucherLine = { ...line, id: crypto.randomUUID() };
    setVoucher((prev) => {
      const lines = [...prev.lines];
      lines.splice(selectedRow + 1, 0, copy);
      return { ...prev, lines };
    });
    setSelectedRow((r) => r + 1);
  }, [selectedRow, voucher.lines]);

  const handleAccept = useCallback(async () => {
    if (!isBalanced(voucher.lines)) {
      toast.error("Debit and Credit totals must be equal.");
      return;
    }
    if (voucher.lines.some((l) => !l.accountId)) {
      toast.error("Please select an account for every row.");
      return;
    }
    if (voucher.id) {
      await updateVoucher(voucher.id, voucher);
    } else {
      await addVoucher(voucher);
    }
    toast.success("Journal voucher saved.");
    setVoucher(blankVoucher("Journal"));
    setSelectedRow(0);
  }, [voucher, updateVoucher, addVoucher]);

  const handleCancel = useCallback(() => {
    setVoucher(blankVoucher("Journal"));
    setSelectedRow(0);
    setSelectedCol("account");
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      const loaded = vouchers.find((v) => v.id === id);
      if (loaded) {
        setVoucher(loaded);
        setShowList(false);
        setSelectedRow(0);
      }
    },
    [vouchers],
  );

  const moveNext = useCallback(() => {
    const cols: Array<"account" | "debit" | "credit" | "narration"> = [
      "account",
      "debit",
      "credit",
      "narration",
    ];
    const colIdx = cols.indexOf(selectedCol);
    if (colIdx < cols.length - 1) {
      setSelectedCol(cols[colIdx + 1]);
    } else if (selectedRow < voucher.lines.length - 1) {
      setSelectedRow((r) => r + 1);
      setSelectedCol("account");
    } else {
      addRow();
      setSelectedCol("account");
    }
  }, [selectedCol, selectedRow, voucher.lines.length, addRow]);

  return (
    <TallyVoucherShell
      title="Accounting Voucher"
      voucherType={voucher.voucherType}
      voucherNumber={voucher.voucherNumber}
      date={voucher.date}
      reference={voucher.reference}
      narration={voucher.narration}
      totalDebit={voucher.totalDebit}
      totalCredit={voucher.totalCredit}
      onVoucherNumberChange={(v) => setVoucher((p) => ({ ...p, voucherNumber: v }))}
      onDateChange={(v) => setVoucher((p) => ({ ...p, date: v }))}
      onReferenceChange={(v) => setVoucher((p) => ({ ...p, reference: v }))}
      onNarrationChange={(v) => setVoucher((p) => ({ ...p, narration: v }))}
      onAccept={handleAccept}
      onCancel={handleCancel}
      onF2={() => document.querySelector<HTMLInputElement>('input[type="date"]')?.focus()}
      onF3={() => toast("F3: Company selection is handled by global header.")}
      onF10={() => setShowList(true)}
      onF12={() => toast("F12: Configuration panel not implemented yet.")}
      onAltC={() => {
        /* handled by account select */
      }}
      onDuplicate={duplicateRow}
      onToggleMode={() => toast("Journal voucher always uses double-entry mode.")}
      modeLabel="Double Entry"
    >
      <div className="overflow-auto">
        <table className="tally-grid min-w-[700px]">
          <thead>
            <tr>
              <th className="w-10">S.N.</th>
              <th>By (Dr) / To (Cr) Account</th>
              <th className="w-36">Debit (Dr)</th>
              <th className="w-36">Credit (Cr)</th>
              <th>Narration</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line, idx) => (
              <tr
                key={line.id}
                className={selectedRow === idx ? "selected" : ""}
                onClick={() => setSelectedRow(idx)}
              >
                <td>{idx + 1}</td>
                <td
                  className={
                    selectedRow === idx && selectedCol === "account" ? "bg-yellow-100" : ""
                  }
                >
                  <TallyAccountSelect
                    value={line.accountId}
                    onChange={(id, name) => updateLine(idx, { accountId: id, accountName: name })}
                    autoFocus={selectedRow === idx && selectedCol === "account"}
                  />
                </td>
                <td
                  className={selectedRow === idx && selectedCol === "debit" ? "bg-yellow-100" : ""}
                >
                  <input
                    className="tally-input text-right"
                    placeholder="0.00"
                    value={line.debit ? formatMoney(line.debit) : ""}
                    onChange={(e) =>
                      updateLine(idx, { debit: parseMoney(e.target.value), credit: 0 })
                    }
                    onFocus={() => {
                      setSelectedRow(idx);
                      setSelectedCol("debit");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Tab") moveNext();
                    }}
                  />
                </td>
                <td
                  className={selectedRow === idx && selectedCol === "credit" ? "bg-yellow-100" : ""}
                >
                  <input
                    className="tally-input text-right"
                    placeholder="0.00"
                    value={line.credit ? formatMoney(line.credit) : ""}
                    onChange={(e) =>
                      updateLine(idx, { credit: parseMoney(e.target.value), debit: 0 })
                    }
                    onFocus={() => {
                      setSelectedRow(idx);
                      setSelectedCol("credit");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Tab") moveNext();
                    }}
                  />
                </td>
                <td
                  className={
                    selectedRow === idx && selectedCol === "narration" ? "bg-yellow-100" : ""
                  }
                >
                  <input
                    className="tally-input"
                    value={line.narration || ""}
                    onChange={(e) => updateLine(idx, { narration: e.target.value })}
                    onFocus={() => {
                      setSelectedRow(idx);
                      setSelectedCol("narration");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Tab") moveNext();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPrint && <TallyVoucherPrint voucher={voucher} onClose={() => setShowPrint(false)} />}
      <TallyVoucherList
        isOpen={showList}
        vouchers={vouchers || []}
        onClose={() => setShowList(false)}
        onSelect={handleSelect}
        onPrint={(id) => {
          const v = vouchers.find((v) => v.id === id);
          if (v) {
            setVoucher(v);
            setShowPrint(true);
          }
        }}
        onDelete={(id) => cancelVoucher(id, "Deleted from UI")}
      />
    </TallyVoucherShell>
  );
};

export default TallyJournalVoucher;
