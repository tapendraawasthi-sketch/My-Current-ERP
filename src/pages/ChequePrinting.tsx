// @ts-nocheck
import React, { useState, useMemo, useRef } from "react";
import { ActionToolbar, Select, NepaliDatePicker, Button, Badge } from "../components/ui";
import { useStore } from "../store/useStore";
import { formatNumber, numberToWords } from "../lib/utils";
import { generateId } from "../lib/db";
import toast from "@/lib/appToast";
import { formatADToBS } from "../lib/nepaliDate";
import { Printer, Settings, Plus, RefreshCw, Eye } from "lucide-react";

interface ChequeBookForm {
  id?: string;
  bankAccountId: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  chequeBookNo: string;
  fromChequeNo: string;
  toChequeNo: string;
  currentChequeNo: string;
  payeeX: number;
  payeeY: number;
  amountWordsX: number;
  amountWordsY: number;
  amountFiguresX: number;
  amountFiguresY: number;
  dateX: number;
  dateY: number;
  pageWidth: number;
  pageHeight: number;
}

interface AssignChequeForm {
  voucherId: string;
  chequeNo: string;
}

export default function ChequePrinting() {
  const {
    accounts,
    vouchers,
    cheques,
    chequeBooks,
    currentUser,
    saveCheque,
    updateChequeBook,
    markChequePrinted,
    saveChequeBook,
    updateChequeBook: updateChequeBookStore,
  } = useStore();

  const [bankFilter, setBankFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showPrinted, setShowPrinted] = useState(false);
  const [selectedCheques, setSelectedCheques] = useState<string[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [reprintCheque, setReprintCheque] = useState<any>(null);
  const [chequeBookForm, setChequeBookForm] = useState<ChequeBookForm>({
    bankAccountId: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    chequeBookNo: "",
    fromChequeNo: "",
    toChequeNo: "",
    currentChequeNo: "",
    payeeX: 20,
    payeeY: 60,
    amountWordsX: 20,
    amountWordsY: 80,
    amountFiguresX: 150,
    amountFiguresY: 80,
    dateX: 150,
    dateY: 40,
    pageWidth: 210,
    pageHeight: 148,
  });
  const [assignForms, setAssignForms] = useState<AssignChequeForm[]>([]);

  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.group === "Bank Accounts" || a.group === "Bank OD Accounts");
  }, [accounts]);

  const filteredCheques = useMemo(() => {
    return cheques.filter((c) => {
      const matchesBank = !bankFilter || c.bankAccountId === bankFilter;
      const matchesDateFrom = !dateFrom || c.chequeDate >= dateFrom;
      const matchesDateTo = !dateTo || c.chequeDate <= dateTo;
      const matchesStatus = showPrinted ? c.isPrinted : !c.isPrinted;
      return matchesBank && matchesDateFrom && matchesDateTo && matchesStatus;
    });
  }, [cheques, bankFilter, dateFrom, dateTo, showPrinted]);

  const unassignedVouchers = useMemo(() => {
    const voucherIdsWithCheques = new Set(cheques.map((c) => c.voucherId));
    return vouchers.filter(
      (v) =>
        v.type === "payment" &&
        (v.paymentMode === "cheque" || v.paymentMode === "Cheque") &&
        !voucherIdsWithCheques.has(v.id),
    );
  }, [vouchers, cheques]);

  const handleChequeSelection = (id: string) => {
    setSelectedCheques((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedCheques.length === filteredCheques.length) {
      setSelectedCheques([]);
    } else {
      setSelectedCheques(filteredCheques.map((c) => c.id));
    }
  };

  const handlePrintSelected = () => {
    if (selectedCheques.length === 0) return;
    setPrintPreviewOpen(true);
  };

  const handlePrintNow = async () => {
    window.print();

    // Mark cheques as printed
    try {
      await markChequePrinted(selectedCheques, currentUser?.id);
      toast.success("Cheques marked as printed");
      setSelectedCheques([]);
      setPrintPreviewOpen(false);
    } catch (error) {
      toast.error("Failed to mark cheques as printed");
    }
  };

  const handleAssignChequeNumbers = async () => {
    if (!assignForms.length) return;

    try {
      for (const form of assignForms) {
        const voucher = vouchers.find((v) => v.id === form.voucherId);
        if (!voucher) continue;

        // Find the associated bank account to determine the cheque book
        const bankAccount = accounts.find((a) => a.id === voucher.bankAccountId);
        if (!bankAccount) continue;

        // Find the cheque book for this account
        const chequeBook = chequeBooks.find((cb) => cb.bankAccountId === voucher.bankAccountId);
        if (!chequeBook) {
          toast.error("No cheque book configured for this bank account");
          continue;
        }

        // Save the cheque
        await saveCheque({
          voucherId: form.voucherId,
          voucherNo: voucher.voucherNo,
          bankAccountId: voucher.bankAccountId,
          chequeNo: form.chequeNo,
          chequeDate: voucher.date,
          chequeDateNepali: voucher.dateNepali,
          payeeName: voucher.partyName || "",
          amount: voucher.grandTotal || 0,
          amountInWords: numberToWords(voucher.grandTotal || 0, "Rupees"),
          status: "issued",
          isPrinted: false,
          createdAt: new Date().toISOString(),
        });

        // Update the cheque book's current number
        const nextChequeNo = incrementChequeNumber(form.chequeNo);
        await updateChequeBookStore(chequeBook.id, { currentChequeNo: nextChequeNo });
      }

      toast.success("Cheque numbers assigned successfully");
      setAssignModalOpen(false);
      setAssignForms([]);
    } catch (error) {
      toast.error("Failed to assign cheque numbers");
    }
  };

  const incrementChequeNumber = (current: string): string => {
    // Simple numeric increment assuming format is just a number
    const num = parseInt(current);
    if (!isNaN(num)) {
      return (num + 1).toString().padStart(current.length, "0");
    }
    return current;
  };

  const handleChequeBookSave = async () => {
    try {
      const layout = JSON.stringify({
        payeeX: chequeBookForm.payeeX,
        payeeY: chequeBookForm.payeeY,
        amountWordsX: chequeBookForm.amountWordsX,
        amountWordsY: chequeBookForm.amountWordsY,
        amountFiguresX: chequeBookForm.amountFiguresX,
        amountFiguresY: chequeBookForm.amountFiguresY,
        dateX: chequeBookForm.dateX,
        dateY: chequeBookForm.dateY,
        pageWidth: chequeBookForm.pageWidth,
        pageHeight: chequeBookForm.pageHeight,
        fontSize: 12,
        fontFamily: "Arial",
      });

      if (chequeBookForm.id) {
        await updateChequeBookStore(chequeBookForm.id, {
          bankAccountId: chequeBookForm.bankAccountId,
          bankName: chequeBookForm.bankName,
          branchName: chequeBookForm.branchName,
          accountNumber: chequeBookForm.accountNumber,
          chequeBookNo: chequeBookForm.chequeBookNo,
          fromChequeNo: chequeBookForm.fromChequeNo,
          toChequeNo: chequeBookForm.toChequeNo,
          currentChequeNo: chequeBookForm.currentChequeNo,
          printLayout: layout,
        });
      } else {
        await saveChequeBook({
          bankAccountId: chequeBookForm.bankAccountId,
          bankName: chequeBookForm.bankName,
          branchName: chequeBookForm.branchName,
          accountNumber: chequeBookForm.accountNumber,
          chequeBookNo: chequeBookForm.chequeBookNo,
          fromChequeNo: chequeBookForm.fromChequeNo,
          toChequeNo: chequeBookForm.toChequeNo,
          currentChequeNo: chequeBookForm.currentChequeNo,
          isActive: true,
          printLayout: layout,
          createdAt: new Date().toISOString(),
        });
      }

      toast.success("Cheque book saved successfully");
      setSetupModalOpen(false);
      setChequeBookForm({
        bankAccountId: "",
        bankName: "",
        branchName: "",
        accountNumber: "",
        chequeBookNo: "",
        fromChequeNo: "",
        toChequeNo: "",
        currentChequeNo: "",
        payeeX: 20,
        payeeY: 60,
        amountWordsX: 20,
        amountWordsY: 80,
        amountFiguresX: 150,
        amountFiguresY: 80,
        dateX: 150,
        dateY: 40,
        pageWidth: 210,
        pageHeight: 148,
      });
    } catch (error) {
      toast.error("Failed to save cheque book");
    }
  };

  const handleEditChequeBook = (book: any) => {
    const layout = book.printLayout ? JSON.parse(book.printLayout) : {};
    setChequeBookForm({
      id: book.id,
      bankAccountId: book.bankAccountId,
      bankName: book.bankName,
      branchName: book.branchName,
      accountNumber: book.accountNumber,
      chequeBookNo: book.chequeBookNo,
      fromChequeNo: book.fromChequeNo,
      toChequeNo: book.toChequeNo,
      currentChequeNo: book.currentChequeNo,
      payeeX: layout.payeeX || 20,
      payeeY: layout.payeeY || 60,
      amountWordsX: layout.amountWordsX || 20,
      amountWordsY: layout.amountWordsY || 80,
      amountFiguresX: layout.amountFiguresX || 150,
      amountFiguresY: layout.amountFiguresY || 80,
      dateX: layout.dateX || 150,
      dateY: layout.dateY || 40,
      pageWidth: layout.pageWidth || 210,
      pageHeight: layout.pageHeight || 148,
    });
    setSetupModalOpen(true);
  };

  const handleReprint = (cheque: any) => {
    setSelectedCheques([cheque.id]);
    setReprintCheque(cheque);
    setPrintPreviewOpen(true);
  };

  // Prepare data for the assign modal
  useMemo(() => {
    if (assignModalOpen && unassignedVouchers.length > 0) {
      // Find the latest cheque number for the bank account
      const latestChequeNo = unassignedVouchers.reduce((latest, voucher) => {
        const book = chequeBooks.find((cb) => cb.bankAccountId === voucher.bankAccountId);
        if (book && book.currentChequeNo && book.currentChequeNo > latest) {
          return book.currentChequeNo;
        }
        return latest;
      }, "");

      const forms = unassignedVouchers.map((v, index) => ({
        voucherId: v.id,
        chequeNo: incrementChequeNumber(latestChequeNo || "000000"), // Start from 1 if no previous
      }));

      setAssignForms(forms);
    }
  }, [assignModalOpen, unassignedVouchers, chequeBooks]);

  const getChequeLayout = (chequeBook: any) => {
    if (!chequeBook.printLayout) return null;
    try {
      return JSON.parse(chequeBook.printLayout);
    } catch {
      return null;
    }
  };

  const getChequeBookForAccount = (accountId: string) => {
    return chequeBooks.find((cb) => cb.bankAccountId === accountId);
  };

  return (
    <div className="flex flex-col h-full">
      <ActionToolbar title="Print cheques" icon={<Printer size={16} />}>
        <Button size="sm" variant="outline" onClick={() => setSetupModalOpen(true)}>
          <Settings size={14} className="mr-1" />
          Cheque Book Setup
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAssignModalOpen(true)}>
          <Plus size={14} className="mr-1" />
          Assign Cheque Numbers
        </Button>
      </ActionToolbar>

      <div className="flex-1 overflow-auto p-4">
        {/* Filter Bar */}
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div className="w-48">
            <Select
              label="Bank Account"
              options={[
                { value: "", label: "All Banks" },
                ...bankAccounts.map((acc) => ({ value: acc.id, label: acc.name })),
              ]}
              value={bankFilter}
              onChange={setBankFilter}
            />
          </div>

          <div className="w-32">
            <NepaliDatePicker label="From Date" value={dateFrom} onChange={setDateFrom} />
          </div>

          <div className="w-32">
            <NepaliDatePicker label="To Date" value={dateTo} onChange={setDateTo} />
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={!showPrinted ? "primary" : "outline"}
              onClick={() => setShowPrinted(false)}
            >
              Pending
            </Button>
            <Button
              size="sm"
              variant={showPrinted ? "primary" : "outline"}
              onClick={() => setShowPrinted(true)}
            >
              Printed
            </Button>
          </div>
        </div>

        {/* Cheque Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 p-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedCheques.length === filteredCheques.length &&
                      filteredCheques.length > 0
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="p-3 text-left">Cheque No</th>
                <th className="p-3 text-left">Cheque Date</th>
                <th className="p-3 text-left">Payee Name</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Voucher No</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No cheques found
                  </td>
                </tr>
              ) : (
                filteredCheques.map((cheque) => {
                  const isSelected = selectedCheques.includes(cheque.id);
                  const voucher = vouchers.find((v) => v.id === cheque.voucherId);

                  return (
                    <tr key={cheque.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleChequeSelection(cheque.id)}
                        />
                      </td>
                      <td className="p-3">{cheque.chequeNo}</td>
                      <td className="p-3">{cheque.chequeDate}</td>
                      <td className="p-3">{cheque.payeeName}</td>
                      <td className="p-3 text-right">{formatNumber(cheque.amount)}</td>
                      <td className="p-3">{voucher?.voucherNo || cheque.voucherNo}</td>
                      <td className="p-3">
                        <Badge variant={cheque.isPrinted ? "success" : "warning"}>
                          {cheque.isPrinted ? "Printed" : "Pending"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {cheque.isPrinted && (
                          <Button size="xs" variant="ghost" onClick={() => handleReprint(cheque)}>
                            <RefreshCw size={12} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Print Button */}
        <div className="mt-4 flex justify-end">
          <Button disabled={selectedCheques.length === 0} onClick={handlePrintSelected}>
            Print Selected
          </Button>
        </div>
      </div>

      {/* Assign Cheque Numbers Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[var(--ds-z-dropdown)]">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">Assign Cheque Numbers</h3>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Assign cheque numbers to unassigned payment vouchers
              </p>

              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Voucher No</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Party</th>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">Cheque Number</th>
                  </tr>
                </thead>
                <tbody>
                  {assignForms.map((form, index) => {
                    const voucher = vouchers.find((v) => v.id === form.voucherId);

                    return (
                      <tr key={form.voucherId} className="border-t">
                        <td className="p-2">{voucher?.voucherNo || "-"}</td>
                        <td className="p-2">{voucher?.date || "-"}</td>
                        <td className="p-2">{voucher?.partyName || "-"}</td>
                        <td className="p-2 text-right">{formatNumber(voucher?.grandTotal || 0)}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={form.chequeNo}
                            onChange={(e) => {
                              setAssignForms((prev) =>
                                prev.map((f) =>
                                  f.voucherId === form.voucherId
                                    ? { ...f, chequeNo: e.target.value }
                                    : f,
                                ),
                              );
                            }}
                            className="w-full p-1 border rounded text-sm"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignChequeNumbers}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Cheque Book Setup Modal */}
      {setupModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[var(--ds-z-dropdown)]">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">
                {chequeBookForm.id ? "Edit Cheque Book" : "New Cheque Book"}
              </h3>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Select
                  label="Bank Account"
                  options={bankAccounts.map((acc) => ({ value: acc.id, label: acc.name }))}
                  value={chequeBookForm.bankAccountId}
                  onChange={(val) => setChequeBookForm((prev) => ({ ...prev, bankAccountId: val }))}
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Bank Name"
                  value={chequeBookForm.bankName}
                  onChange={(e) =>
                    setChequeBookForm((prev) => ({ ...prev, bankName: e.target.value }))
                  }
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Branch Name"
                  value={chequeBookForm.branchName}
                  onChange={(e) =>
                    setChequeBookForm((prev) => ({ ...prev, branchName: e.target.value }))
                  }
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Account Number"
                  value={chequeBookForm.accountNumber}
                  onChange={(e) =>
                    setChequeBookForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                  }
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Cheque Book No"
                  value={chequeBookForm.chequeBookNo}
                  onChange={(e) =>
                    setChequeBookForm((prev) => ({ ...prev, chequeBookNo: e.target.value }))
                  }
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="From Cheque No"
                  value={chequeBookForm.fromChequeNo}
                  onChange={(e) =>
                    setChequeBookForm((prev) => ({ ...prev, fromChequeNo: e.target.value }))
                  }
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="To Cheque No"
                  value={chequeBookForm.toChequeNo}
                  onChange={(e) =>
                    setChequeBookForm((prev) => ({ ...prev, toChequeNo: e.target.value }))
                  }
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Current Cheque No"
                  value={chequeBookForm.currentChequeNo}
                  onChange={(e) =>
                    setChequeBookForm((prev) => ({ ...prev, currentChequeNo: e.target.value }))
                  }
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div className="col-span-2 border-t pt-4">
                <h4 className="font-medium mb-3">Print Layout Configuration</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Payee Name X (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.payeeX}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({ ...prev, payeeX: Number(e.target.value) }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Payee Name Y (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.payeeY}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({ ...prev, payeeY: Number(e.target.value) }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Amount Words X (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.amountWordsX}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({
                          ...prev,
                          amountWordsX: Number(e.target.value),
                        }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Amount Words Y (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.amountWordsY}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({
                          ...prev,
                          amountWordsY: Number(e.target.value),
                        }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Amount Figures X (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.amountFiguresX}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({
                          ...prev,
                          amountFiguresX: Number(e.target.value),
                        }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Amount Figures Y (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.amountFiguresY}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({
                          ...prev,
                          amountFiguresY: Number(e.target.value),
                        }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Date X (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.dateX}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({ ...prev, dateX: Number(e.target.value) }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Date Y (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.dateY}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({ ...prev, dateY: Number(e.target.value) }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Page Width (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.pageWidth}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({
                          ...prev,
                          pageWidth: Number(e.target.value),
                        }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Page Height (mm)</label>
                    <input
                      type="number"
                      value={chequeBookForm.pageHeight}
                      onChange={(e) =>
                        setChequeBookForm((prev) => ({
                          ...prev,
                          pageHeight: Number(e.target.value),
                        }))
                      }
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSetupModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleChequeBookSave}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printPreviewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[var(--ds-z-dropdown)]">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Cheque preview</h3>
              <Button variant="outline" onClick={() => setPrintPreviewOpen(false)}>
                Close
              </Button>
            </div>

            <div className="p-4">
              <div className="print-container">
                {selectedCheques.map((id) => {
                  const cheque = reprintCheque || cheques.find((c) => c.id === id);
                  if (!cheque) return null;

                  const voucher = vouchers.find((v) => v.id === cheque.voucherId);
                  const chequeBook = getChequeBookForAccount(cheque.bankAccountId);
                  const layout = getChequeLayout(chequeBook);

                  return (
                    <div
                      key={id}
                      className="cheque-preview border border-gray-800 p-8 mb-8 relative"
                      style={{
                        width: layout?.pageWidth ? `${layout.pageWidth}mm` : "210mm",
                        height: layout?.pageHeight ? `${layout.pageHeight}mm` : "148mm",
                      }}
                    >
                      {/* Payee Name */}
                      <div
                        className="absolute font-serif text-sm"
                        style={{
                          left: `${layout?.payeeX || 20}mm`,
                          top: `${layout?.payeeY || 60}mm`,
                        }}
                      >
                        {cheque.payeeName}
                      </div>

                      {/* Amount in Words */}
                      <div
                        className="absolute font-serif text-sm"
                        style={{
                          left: `${layout?.amountWordsX || 20}mm`,
                          top: `${layout?.amountWordsY || 80}mm`,
                        }}
                      >
                        {cheque.amountInWords}
                      </div>

                      {/* Amount in Figures */}
                      <div
                        className="absolute font-bold"
                        style={{
                          left: `${layout?.amountFiguresX || 150}mm`,
                          top: `${layout?.amountFiguresY || 80}mm`,
                        }}
                      >
                        {formatNumber(cheque.amount)}
                      </div>

                      {/* Date */}
                      <div
                        className="absolute text-sm"
                        style={{
                          left: `${layout?.dateX || 150}mm`,
                          top: `${layout?.dateY || 40}mm`,
                        }}
                      >
                        {cheque.chequeDate}
                      </div>

                      {/* Watermark */}
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-45 text-gray-300 text-2xl font-bold pointer-events-none">
                        SAMPLE
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintPreviewOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePrintNow}>Print Now</Button>
            </div>
          </div>
        </div>
      )}

      {/* Print styles for the cheques */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .cheque-preview {
            break-inside: avoid;
            margin-bottom: 20px;
          }
          .fixed.inset-0 {
             position: absolute;
             background: transparent;
          }
        }
      `}</style>
    </div>
  );
}
