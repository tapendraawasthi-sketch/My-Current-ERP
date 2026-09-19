from pathlib import Path
imp = Path("src/pages/BankStatementImport.tsx")
t = imp.read_text(encoding="utf-8")
start = t.find("  const createVoucherForRow = async () => {")
end = t.find("  const deleteBatch = async", start)
if start < 0 or end < 0:
    raise SystemExit(f"markers missing {start} {end}")
new = '''  const createVoucherForRow = async () => {
    if (!selectedRow) return;

    if (!voucherForm.accountId) {
      toast.error("Select opposite account");
      return;
    }

    const isReceipt = Number(selectedRow.amount || selectedRow.credit || 0) >= Number(selectedRow.debit || 0);
    const amt = Math.abs(
      Number(selectedRow.amount || 0) ||
        Number(selectedRow.debit || 0) ||
        Number(selectedRow.credit || 0),
    );

    if (!amt) {
      toast.error("Invalid amount");
      return;
    }

    try {
      const version = Number(selectedRow.reconciliationVersion ?? 1);
      const result = await postAdjustmentViaTreasury({
        ledgerOrBankAccountId: selectedBankId,
        statementLineId: selectedRow.id,
        expectedStatementLineVersion: version,
        adjustmentType: isReceipt ? "bank_interest" : "bank_charge",
        amount: amt,
        offsetAccountId: voucherForm.accountId,
        useJournal: true,
        narration: voucherForm.narration || selectedRow.narration || selectedRow.description,
      });
      if (result.type !== "posting_completed") {
        toast.error(result.payload?.safe_message || "Could not create voucher");
        return;
      }

      const updatedRow = {
        ...selectedRow,
        status: "Reconciled",
        matchedVoucherId: result.payload.voucher_id,
        matchedVoucherNo: result.payload.voucher_number,
        matchScore: 100,
        matchReason: "phase9_adjustment",
        reconciledAt: nowISO(),
        reconciledBy: currentUser?.id || "",
      };

      setStatementRows((prev) => prev.map((r) => (r.id === updatedRow.id ? updatedRow : r)));
      setModalType("");
      setSelectedRow(null);
      toast.success("Adjustment posted via Phase 9 and reconciled");
    } catch (err) {
      console.error(err);
      toast.error("Could not create voucher");
    }
  };

'''
imp.write_text(t[:start] + new + t[end:], encoding="utf-8", newline="\n")
print("createVoucherForRow fixed", "store.addVoucher" in imp.read_text(encoding="utf-8"))