from pathlib import Path

# Fix commission voucher addVoucher in BankReconciliation
rec = Path("src/pages/BankReconciliation.tsx")
t = rec.read_text(encoding="utf-8")
# Find handleCreateCommissionVoucher and replace addVoucher block
start = t.find("  const handleCreateCommissionVoucher = async")
end = t.find("  // ── Print report", start)
if start < 0 or end < 0:
    # try alternate marker
    end = t.find("  const printReport", start)
print("commission span", start, end)
if start >= 0 and end > start:
    old = t[start:end]
    new = '''  const handleCreateCommissionVoucher = async (stmt: StatementEntry, invoiceAmount: number) => {
    const commissionAcct = accounts.find(
      (a: any) =>
        a.name.toLowerCase().includes("commission") || a.name.toLowerCase().includes("bank charge"),
    );
    if (!commissionAcct) {
      toast.error('Add a "Commission Expense" or "Bank Charges" account first.');
      return;
    }
    const settlementAmt = stmt.credit;
    const commission = invoiceAmount - settlementAmt;
    if (commission <= 0) {
      toast.error("No commission difference to post.");
      return;
    }

    try {
      const db = getDB();
      const line = await (db as any).bankStatementLines?.get?.(stmt.id);
      const version = Number(line?.reconciliationVersion ?? 1);
      const result = await postAdjustmentViaTreasury({
        ledgerOrBankAccountId: selectedAccountId,
        statementLineId: stmt.id,
        expectedStatementLineVersion: version,
        adjustmentType: "bank_charge",
        amount: commission,
        offsetAccountId: commissionAcct.id,
        useJournal: true,
        narration: `${digitalMode.toUpperCase()} commission on ${stmt.description}`,
      });
      if (result.type !== "posting_completed") {
        toast.error(result.payload?.safe_message || "Commission adjustment failed");
        return;
      }
      toast.success(`Commission voucher created: Rs.${formatNumber(commission)}`);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
  };

'''
    t = t[:start] + new + t[end:]
    rec.write_text(t, encoding="utf-8", newline="\n")
    print("commission fixed, addVoucher left?", "await addVoucher" in t)

# Fix BankStatementImport create voucher addVoucher path if still present
imp = Path("src/pages/BankStatementImport.tsx")
ti = imp.read_text(encoding="utf-8")
if "store.addVoucher" in ti:
    # replace create voucher reconcile path - find block around store.addVoucher
    idx = ti.find("if (store.addVoucher)")
    print("import addVoucher at", idx)