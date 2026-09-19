from pathlib import Path

def ensure_utf8(path: Path) -> str:
    b = path.read_bytes()
    if len(b) > 3 and b[1] == 0:
        text = b.decode("utf-16")
        path.write_text(text, encoding="utf-8", newline="\n")
        return text
    return path.read_text(encoding="utf-8")

# --- BankStatementImport commitImport ---
imp = Path("src/pages/BankStatementImport.tsx")
t = ensure_utf8(imp)
if "importStatementViaTreasury" not in t:
    t = t.replace(
        'import toast from "react-hot-toast";',
        'import toast from "react-hot-toast";\nimport { importStatementViaTreasury, postAdjustmentViaTreasury } from "@/domains/treasury/uiAdapters";',
    )

old_commit = '''  const commitImport = async () => {
    if (!previewRows.length) {
      toast.error("No preview rows to import");
      return;
    }

    try {
      const db = getDB();

      const batchId = previewRows[0].batchId;

      const batch = {
        id: batchId,
        bankAccountId: selectedBankId,
        bankAccountName: accountName(accounts, selectedBankId),
        importedAt: nowISO(),
        importedBy: currentUser?.id || "",
        rowCount: previewRows.length,
        matchedCount: previewRows.filter((r) => r.status === "Matched").length,
        probableCount: previewRows.filter((r) => r.status === "Probable").length,
        totalDebit: previewRows.reduce((sum, r) => sum + Number(r.debit || 0), 0),
        totalCredit: previewRows.reduce((sum, r) => sum + Number(r.credit || 0), 0),
      };

      await tablePut(db, "bankStatementRows", previewRows);
      await tablePut(db, "bankStatementBatches", [batch]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Bank Statement Imported",
          `${batch.rowCount} rows imported for ${batch.bankAccountName}`,
          "Medium",
        ),
      ]);

      setStatementRows((prev) => [...previewRows, ...prev]);
      setBatches((prev) => [batch, ...prev]);
      setPreviewRows([]);
      setModalType("");
      setSelectedBatchId(batchId);

      toast.success("Bank statement imported");
    } catch (err) {
      console.error(err);
      toast.error("Could not commit import");
    }
  };'''

new_commit = '''  const commitImport = async () => {
    if (!previewRows.length) {
      toast.error("No preview rows to import");
      return;
    }

    try {
      const result = await importStatementViaTreasury({
        ledgerOrBankAccountId: selectedBankId,
        previewRows,
        bankAccountName: accountName(accounts, selectedBankId),
        source: "manual_form",
      });
      if (result.type !== "posting_completed") {
        toast.error(result.payload?.safe_message || "Could not commit import");
        return;
      }
      const batchId = result.payload.batch_id;
      const db = getDB();
      const domainLines = (await tableAll(db, "bankStatementLines")).filter(
        (r) => r.batchId === batchId,
      );
      const uiRows = domainLines.map((line) => ({
        id: line.id,
        batchId: line.batchId,
        bankAccountId: selectedBankId,
        date: line.transactionDate,
        description: line.description,
        narration: line.description,
        reference: line.reference || "",
        debit: (line.debitPaisa || 0) / 100,
        credit: (line.creditPaisa || 0) / 100,
        balance: line.balancePaisa != null ? line.balancePaisa / 100 : 0,
        status: "Unmatched",
        reconciliationVersion: line.reconciliationVersion,
      }));
      const batch = {
        id: batchId,
        bankAccountId: selectedBankId,
        bankAccountName: accountName(accounts, selectedBankId),
        importedAt: nowISO(),
        importedBy: currentUser?.id || "",
        rowCount: result.payload.line_count,
        matchedCount: 0,
        probableCount: 0,
        totalDebit: uiRows.reduce((sum, r) => sum + Number(r.debit || 0), 0),
        totalCredit: uiRows.reduce((sum, r) => sum + Number(r.credit || 0), 0),
      };
      setStatementRows((prev) => [...uiRows, ...prev]);
      setBatches((prev) => [batch, ...prev]);
      setPreviewRows([]);
      setModalType("");
      setSelectedBatchId(batchId);
      toast.success("Bank statement imported");
    } catch (err) {
      console.error(err);
      toast.error("Could not commit import");
    }
  };'''

if old_commit not in t:
    raise SystemExit("commitImport block not found")
t = t.replace(old_commit, new_commit)

imp.write_text(t, encoding="utf-8", newline="\n")
print("BankStatementImport patched", list(imp.read_bytes()[:4]))

# --- BankReconciliation handlers ---
rec = Path("src/pages/BankReconciliation.tsx")
t = ensure_utf8(rec)
if "confirmMatchViaTreasury" not in t:
    t = t.replace(
        'from "../lib/bankMatchingEngine";',
        'from "../lib/bankMatchingEngine";\nimport {\n  confirmMatchViaTreasury,\n  postAdjustmentViaTreasury,\n  closeSessionViaTreasury,\n  openSessionViaTreasury,\n} from "@/domains/treasury/uiAdapters";\nimport { getDB } from "@/lib/db";',
    )

old_save = '''  const handleSave = async () => {
    if (matchedPairs.length === 0) {
      toast.error("Nothing to save.");
      return;
    }
    try {
      const updates = matchedPairs.map((p) => ({
        id: p.statementEntry.id,
        updates: {
          reconciled: true,
          reconciledVoucherId: p.bookEntry.voucherId,
          reconciledDate: new Date().toISOString().split("T")[0],
        },
      }));
      await updateBankStatements(updates);
      await saveAuditLog?.({
        id: generateId(),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || "system",
        action: "BANK_RECONCILIATION_SAVED",
        module: "banking",
        recordId: selectedAccountId,
        recordType: "bank-account",
        details: JSON.stringify({
          matched: matchedPairs.length,
          period: `${dateFrom} to ${dateTo}`,
        }),
      });
      toast.success(`Reconciliation saved — ${matchedPairs.length} pairs.`);
      setMatchedPairs([]);
      setHasRun(false);
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    }
  };'''

new_save = '''  const handleSave = async () => {
    if (matchedPairs.length === 0) {
      toast.error("Nothing to save.");
      return;
    }
    try {
      const db = getDB();
      let confirmed = 0;
      for (const p of matchedPairs) {
        const line = await (db as any).bankStatementLines?.get?.(p.statementEntry.id);
        const version = Number(line?.reconciliationVersion ?? 1);
        const amount = Number(p.statementEntry.debit || p.statementEntry.credit || p.bookEntry.amount || 0);
        const result = await confirmMatchViaTreasury({
          ledgerOrBankAccountId: selectedAccountId,
          statementLineId: p.statementEntry.id,
          erpDocumentIds: [p.bookEntry.voucherId],
          matchedAmount: amount,
          expectedStatementLineVersion: version,
          explanation: p.matchReason || "Manual UI match",
        });
        if (result.type !== "posting_completed") {
          toast.error(result.payload?.safe_message || "Match failed");
          return;
        }
        confirmed += 1;
      }
      await saveAuditLog?.({
        id: generateId(),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || "system",
        action: "BANK_RECONCILIATION_SAVED",
        module: "banking",
        recordId: selectedAccountId,
        recordType: "bank-account",
        details: JSON.stringify({
          matched: confirmed,
          period: `${dateFrom} to ${dateTo}`,
          authority: "confirmBankMatch",
        }),
      });
      toast.success(`Reconciliation saved — ${confirmed} pairs.`);
      setMatchedPairs([]);
      setHasRun(false);
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    }
  };'''

if old_save not in t:
    raise SystemExit("handleSave block not found")
t = t.replace(old_save, new_save)

old_create = '''  const handleCreateVoucher = async () => {
    if (!voucherModal) return;
    const { stmtEntry: stmt, type, counterAccountId, narration } = voucherModal;
    if (!counterAccountId) {
      toast.error("Select a counter account.");
      return;
    }

    try {
      const isDebit = stmt.debit > 0;
      const amount = isDebit ? stmt.debit : stmt.credit;
      const vId = generateId();
      const lineId1 = generateId();
      const lineId2 = generateId();

      await addVoucher({
        id: vId,
        voucherNo: `BNK-${Date.now().toString().slice(-5)}`,
        date: stmt.date,
        dateNepali: formatADToBS(stmt.date),
        type,
        status: "posted",
        narration,
        partyId: null,
        partyName: "",
        lines: [
          {
            id: lineId1,
            accountId: selectedAccountId,
            accountName: bankAccount?.name || "",
            drAmount: isDebit ? 0 : amount,
            crAmount: isDebit ? amount : 0,
            particulars: narration,
          },
          {
            id: lineId2,
            accountId: counterAccountId,
            accountName: accounts.find((a: any) => a.id === counterAccountId)?.name || "",
            drAmount: isDebit ? amount : 0,
            crAmount: isDebit ? 0 : amount,
            particulars: narration,
          },
        ],
        totalDebit: amount,
        totalCredit: amount,
        grandTotal: amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        postedBy: currentUser?.id,
      });

      // Auto-link the new book entry to this statement
      const newBookEntry: BookEntry = {
        id: `${vId}-0`,
        date: stmt.date,
        amount,
        description: narration,
        voucherId: vId,
        voucherNo: `BNK-${Date.now().toString().slice(-5)}`,
        type: isDebit ? "credit" : "debit",
      };
      setMatchedPairs((prev) => [...prev, createManualMatch(newBookEntry, stmt)]);
      setVoucherModal(null);
      toast.success("Voucher created and linked to statement.");
    } catch (err: any) {
      toast.error("Failed to create voucher: " + err.message);
    }
  };'''

new_create = '''  const handleCreateVoucher = async () => {
    if (!voucherModal) return;
    const { stmtEntry: stmt, type, counterAccountId, narration } = voucherModal;
    if (!counterAccountId) {
      toast.error("Select a counter account.");
      return;
    }

    try {
      const isDebit = stmt.debit > 0;
      const amount = isDebit ? stmt.debit : stmt.credit;
      const db = getDB();
      const line = await (db as any).bankStatementLines?.get?.(stmt.id);
      const version = Number(line?.reconciliationVersion ?? 1);
      const adjustmentType = isDebit ? "bank_charge" : "bank_interest";
      const result = await postAdjustmentViaTreasury({
        ledgerOrBankAccountId: selectedAccountId,
        statementLineId: stmt.id,
        expectedStatementLineVersion: version,
        adjustmentType,
        amount,
        offsetAccountId: counterAccountId,
        useJournal: type === "journal",
        narration,
      });
      if (result.type !== "posting_completed") {
        toast.error(result.payload?.safe_message || "Adjustment failed");
        return;
      }
      const vId = result.payload.voucher_id;
      const newBookEntry: BookEntry = {
        id: `${vId}-0`,
        date: stmt.date,
        amount,
        description: narration,
        voucherId: vId,
        voucherNo: result.payload.voucher_number,
        type: isDebit ? "credit" : "debit",
      };
      setMatchedPairs((prev) => [...prev, createManualMatch(newBookEntry, stmt)]);
      setVoucherModal(null);
      toast.success("Adjustment posted via Phase 9 and linked to statement.");
    } catch (err: any) {
      toast.error("Failed to create voucher: " + err.message);
    }
  };'''

if old_create not in t:
    raise SystemExit("handleCreateVoucher block not found")
t = t.replace(old_create, new_create)

if "handleCloseReconciliation" not in t:
    t = t.replace(
        "  // ── Create voucher from statement line ─────────────────────────────────────",
        '''  const handleCloseReconciliation = async () => {
    try {
      const statementBalancePaisa = Math.round(Number(summary?.statementBalance || 0) * 100);
      const bookBalancePaisa = Math.round(Number(bookBalance || 0) * 100);
      const opened = await openSessionViaTreasury({
        ledgerOrBankAccountId: selectedAccountId,
        periodStart: dateFrom,
        periodEnd: dateTo,
        statementBalancePaisa,
        bookBalancePaisa,
      });
      if (opened.type !== "posting_completed") {
        toast.error(opened.payload?.safe_message || "Could not open session");
        return;
      }
      const closed = await closeSessionViaTreasury({
        sessionId: opened.payload.session_id,
        expectedVersion: opened.payload.session_version,
      });
      if (closed.type !== "posting_completed") {
        toast.error(closed.payload?.safe_message || "Close rejected (difference?)");
        return;
      }
      toast.success("Reconciliation session closed.");
    } catch (err: any) {
      toast.error("Close failed: " + err.message);
    }
  };

  // ── Create voucher from statement line ─────────────────────────────────────''',
    )

rec.write_text(t, encoding="utf-8", newline="\n")
print("BankReconciliation patched", list(rec.read_bytes()[:4]))
print("addVoucher still in file?", "await addVoucher" in t)