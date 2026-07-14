// @ts-nocheck
import React, { useState, useMemo } from "react";
import { ActionToolbar, Select, NepaliDatePicker, Button, Badge } from "../components/ui";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { generateId } from "../lib/db";
import toast from "@/lib/appToast";
import { Send, Plus, Eye, Download, Upload, FileText } from "lucide-react";
import { formatADToBS } from "../lib/nepaliDate";

export default function EPayments() {
  const {
    accounts,
    vouchers,
    parties,
    ePaymentBatches,
    companySettings,
    saveEPaymentBatch,
    updateEPaymentBatch,
  } = useStore();

  const [view, setView] = useState<"list" | "form">("list");
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [editingBatch, setEditingBatch] = useState<any>(null);

  // Form state
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [fileFormat, setFileFormat] = useState("csv-standard");
  const [narration, setNarration] = useState("");
  const [rtgsThreshold, setRtgsThreshold] = useState(200000);
  const [enableImps, setEnableImps] = useState(false);
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);

  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.group === "Bank Accounts" || a.group === "Bank OD Accounts");
  }, [accounts]);

  const unbatchedVouchers = useMemo(() => {
    const batchedVoucherIds = new Set();
    ePaymentBatches.forEach((batch) => {
      try {
        const entries = JSON.parse(batch.entries || "[]");
        entries.forEach((entry: any) => batchedVoucherIds.add(entry.voucherId));
      } catch (e) {
        console.error("Error parsing batch entries:", e);
      }
    });

    return vouchers.filter(
      (v) =>
        v.type === "payment" &&
        (v.paymentMode?.toLowerCase() === "neft" ||
          v.paymentMode?.toLowerCase() === "rtgs" ||
          v.paymentMode?.toLowerCase() === "imps" ||
          v.paymentMode?.toLowerCase() === "online" ||
          v.paymentMode?.toLowerCase() === "e-payment") &&
        !batchedVoucherIds.has(v.id),
    );
  }, [vouchers, ePaymentBatches]);

  const selectedVoucherData = useMemo(() => {
    return selectedVouchers
      .map((voucherId) => {
        const voucher = vouchers.find((v) => v.id === voucherId);
        if (!voucher) return null;

        const party = parties.find((p) => p.id === voucher.partyId);
        const amount = voucher.grandTotal || 0;

        // Determine payment type based on amount and threshold
        let paymentType = "NEFT";
        if (amount >= rtgsThreshold) {
          paymentType = "RTGS";
        } else if (enableImps && party?.bankAccountNo) {
          paymentType = "IMPS";
        }

        return {
          voucherId: voucher.id,
          voucherNo: voucher.voucherNo,
          partyId: party?.id || "",
          partyName: party?.name || "Unknown",
          amount,
          accountNo: party?.bankAccountNo || "",
          ifscCode: party?.bankBranch || "",
          bankName: party?.bankName || "",
          paymentType,
        };
      })
      .filter(Boolean);
  }, [selectedVouchers, vouchers, parties, rtgsThreshold, enableImps]);

  const totalAmount = useMemo(() => {
    return selectedVoucherData.reduce((sum, v) => sum + v.amount, 0);
  }, [selectedVoucherData]);

  const handleNewBatch = () => {
    // Generate batch number
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const count = ePaymentBatches.filter((b) => b.batchNo.startsWith(`EP-${today}`)).length + 1;
    const batchNo = `EP-${today}-${count.toString().padStart(3, "0")}`;

    setEditingBatch({ batchNo });
    setBankAccountId("");
    setPaymentDate("");
    setFileFormat("csv-standard");
    setNarration("");
    setRtgsThreshold(200000);
    setEnableImps(false);
    setSelectedVouchers([]);
    setView("form");
  };

  const handleViewBatch = (batch: any) => {
    setSelectedBatch(batch);
    setView("form");
  };

  const handleToggleVoucher = (voucherId: string) => {
    setSelectedVouchers((prev) =>
      prev.includes(voucherId) ? prev.filter((id) => id !== voucherId) : [...prev, voucherId],
    );
  };

  const handleToggleAllVouchers = () => {
    if (selectedVouchers.length === unbatchedVouchers.length) {
      setSelectedVouchers([]);
    } else {
      setSelectedVouchers(unbatchedVouchers.map((v) => v.id));
    }
  };

  const handleGenerateFile = async () => {
    if (!bankAccountId || !paymentDate) {
      toast.error("Bank account and payment date are required");
      return;
    }

    if (selectedVoucherData.length === 0) {
      toast.error("Please select at least one voucher");
      return;
    }

    // Validate beneficiary details
    const missingDetails = selectedVoucherData.filter((v) => !v.accountNo || !v.ifscCode);

    if (missingDetails.length > 0) {
      toast.error(
        `Missing beneficiary details for: ${missingDetails.map((v) => v.partyName).join(", ")}. ` +
          "Please update ledger master.",
      );
      return;
    }

    try {
      let fileContent = "";
      let fileName = "";
      let mimeType = "";

      // Generate file content based on format
      if (fileFormat === "csv-standard") {
        const headers = [
          "Beneficiary Name",
          "Account Number",
          "IFSC Code",
          "Bank Name",
          "Amount",
          "Payment Type",
          "Narration",
        ];
        const rows = selectedVoucherData.map((v) => [
          `"${v.partyName}"`,
          `"${v.accountNo}"`,
          `"${v.ifscCode}"`,
          `"${v.bankName}"`,
          v.amount.toFixed(2),
          `"${v.paymentType}"`,
          `"${narration || v.voucherNo}"`,
        ]);

        fileContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
        fileName = `epayment-${editingBatch.batchNo}.csv`;
        mimeType = "text/csv";
      } else if (fileFormat === "text-fixed-width") {
        const rows = selectedVoucherData.map((v) => {
          const name = v.partyName.substring(0, 30).padEnd(30);
          const account = v.accountNo.substring(0, 20).padEnd(20);
          const ifsc = v.ifscCode.substring(0, 11).padEnd(11);
          const amount = v.amount.toFixed(2).padStart(15);
          const type = v.paymentType.substring(0, 4).padEnd(4);
          return `${name}${account}${ifsc}${amount}${type}`;
        });

        fileContent = rows.join("\n");
        fileName = `epayment-${editingBatch.batchNo}.txt`;
        mimeType = "text/plain";
      } else if (fileFormat === "xml") {
        const paymentsXml = selectedVoucherData
          .map(
            (v) => `
  <payment>
    <beneficiary>${v.partyName}</beneficiary>
    <accountNo>${v.accountNo}</accountNo>
    <ifsc>${v.ifscCode}</ifsc>
    <amount>${v.amount.toFixed(2)}</amount>
    <type>${v.paymentType}</type>
  </payment>`,
          )
          .join("");

        fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<payments>
${paymentsXml}
</payments>`;
        fileName = `epayment-${editingBatch.batchNo}.xml`;
        mimeType = "application/xml";
      }

      // Save the batch
      const batchData = {
        batchNo: editingBatch.batchNo,
        bankAccountId,
        paymentDate,
        paymentDateNepali: formatADToBS(paymentDate),
        entries: JSON.stringify(selectedVoucherData),
        totalAmount,
        entryCount: selectedVoucherData.length,
        fileFormat,
        generatedFileContent: fileContent,
        status: "generated",
        narration,
      };

      let batchId;
      if (editingBatch.id) {
        batchId = editingBatch.id;
        await updateEPaymentBatch(batchId, batchData);
      } else {
        batchId = await saveEPaymentBatch(batchData);
      }

      // Trigger download
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("File generated and downloaded. Upload it to your bank portal.");
      setView("list");
    } catch (error) {
      toast.error("Failed to generate file");
    }
  };

  const handleMarkUploaded = async (batchId: string) => {
    try {
      await updateEPaymentBatch(batchId, {
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
      });
      toast.success("Batch marked as uploaded");
    } catch (error) {
      toast.error("Failed to mark as uploaded");
    }
  };

  const handleResponseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResponseFile(file);
    }
  };

  const handleImportResponse = async (batchId: string) => {
    if (!responseFile) {
      toast.error("Please select a response file");
      return;
    }

    setIsProcessingResponse(true);
    try {
      const text = await responseFile.text();
      const lines = text.split("\n").filter((line) => line.trim() !== "");

      // Parse CSV response - assume format: Account No, Amount, Status, Error Reason
      const results: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        // Skip header
        const cols = lines[i].split(",").map((col) => col.trim());
        if (cols.length >= 3) {
          results.push({
            accountNo: cols[0],
            amount: parseFloat(cols[1]),
            status: cols[2],
            errorReason: cols[3] || "",
          });
        }
      }

      // Update batch entries based on response
      const batch = ePaymentBatches.find((b) => b.id === batchId);
      if (!batch) return;

      const entries = JSON.parse(batch.entries || "[]");
      const updatedEntries = entries.map((entry: any) => {
        const result = results.find(
          (r) => r.accountNo === entry.accountNo && Math.abs(r.amount - entry.amount) < 0.01,
        );

        if (result) {
          return {
            ...entry,
            status: result.status.toLowerCase() === "success" ? "success" : "failed",
            errorReason: result.errorReason,
          };
        }
        return entry;
      });

      await updateEPaymentBatch(batchId, {
        entries: JSON.stringify(updatedEntries),
        status: "processed",
        processedAt: new Date().toISOString(),
      });

      const successCount = updatedEntries.filter((e: any) => e.status === "success").length;
      const failCount = updatedEntries.filter((e: any) => e.status === "failed").length;

      toast.success(`Processed: ${successCount} successful, ${failCount} failed`);
      setResponseFile(null);
    } catch (error) {
      toast.error("Failed to process response file");
    } finally {
      setIsProcessingResponse(false);
    }
  };

  if (view === "form" && selectedBatch) {
    const entries = JSON.parse(selectedBatch.entries || "[]");

    return (
      <div className="flex flex-col h-full">
        <ActionToolbar title={`Batch: ${selectedBatch.batchNo}`} icon={<Send size={16} />}>
          <Button size="sm" variant="outline" onClick={() => setView("list")}>
            Back to List
          </Button>
        </ActionToolbar>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--ds-text-strong)]">Batch Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p>
                  <strong>Batch No:</strong> {selectedBatch.batchNo}
                </p>
                <p>
                  <strong>Payment Date:</strong> {selectedBatch.paymentDate}
                </p>
              </div>

              <div>
                <p>
                  <strong>Bank Account:</strong>{" "}
                  {bankAccounts.find((a) => a.id === selectedBatch.bankAccountId)?.name}
                </p>
                <p>
                  <strong>Total Amount:</strong> {formatNumber(selectedBatch.totalAmount)}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p>
                <strong>Format:</strong> {selectedBatch.fileFormat}
              </p>
              <p>
                <strong>Status:</strong>
                <Badge
                  variant={
                    selectedBatch.status === "draft"
                      ? "warning"
                      : selectedBatch.status === "generated"
                        ? "info"
                        : selectedBatch.status === "uploaded"
                          ? "secondary"
                          : "success"
                  }
                >
                  {selectedBatch.status.charAt(0).toUpperCase() + selectedBatch.status.slice(1)}
                </Badge>
              </p>
              {selectedBatch.narration && (
                <p>
                  <strong>Narration:</strong> {selectedBatch.narration}
                </p>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--ds-text-strong)]">Payment Entries</h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Voucher No</th>
                    <th className="p-2 text-left">Party Name</th>
                    <th className="p-2 text-left">Account No</th>
                    <th className="p-2 text-left">Bank</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry: any, index: number) => (
                    <tr
                      key={index}
                      className={`border-t ${entry.status === "failed" ? "bg-red-50" : ""}`}
                    >
                      <td className="p-2">{entry.voucherNo}</td>
                      <td className="p-2">{entry.partyName}</td>
                      <td className="p-2">{entry.accountNo}</td>
                      <td className="p-2">{entry.bankName}</td>
                      <td className="p-2 text-right">{formatNumber(entry.amount)}</td>
                      <td className="p-2">{entry.paymentType}</td>
                      <td className="p-2">
                        <Badge
                          variant={
                            entry.status === "success"
                              ? "success"
                              : entry.status === "failed"
                                ? "danger"
                                : "secondary"
                          }
                        >
                          {entry.status}
                        </Badge>
                        {entry.status === "failed" && entry.errorReason && (
                          <div className="text-xs text-red-600 mt-1">{entry.errorReason}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const link = document.createElement("a");
                const blob = new Blob([selectedBatch.generatedFileContent || ""], {
                  type:
                    selectedBatch.fileFormat === "csv-standard"
                      ? "text/csv"
                      : selectedBatch.fileFormat === "text-fixed-width"
                        ? "text/plain"
                        : "application/xml",
                });
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.download = `epayment-${selectedBatch.batchNo}.${selectedBatch.fileFormat.split("-")[0]}`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={14} className="mr-1" />
              Download File
            </Button>

            {selectedBatch.status === "generated" && (
              <Button onClick={() => handleMarkUploaded(selectedBatch.id)}>Mark as Uploaded</Button>
            )}

            {selectedBatch.status === "uploaded" && (
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleResponseFileChange}
                  className="hidden"
                  id="response-file"
                />
                <label
                  htmlFor="response-file"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Import Response
                </label>
                <Button
                  disabled={!responseFile || isProcessingResponse}
                  onClick={() => handleImportResponse(selectedBatch.id)}
                >
                  {isProcessingResponse ? "Processing..." : "Process Response"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "form") {
    return (
      <div className="flex flex-col h-full">
        <ActionToolbar
          title={editingBatch?.id ? `Edit Batch: ${editingBatch.batchNo}` : "New e-Payment Batch"}
          icon={<Send size={16} />}
        >
          <Button size="sm" variant="outline" onClick={() => setView("list")}>
            Back to List
          </Button>
        </ActionToolbar>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--ds-text-strong)]">Batch Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <Select
                  label="Bank Account"
                  options={bankAccounts.map((acc) => ({ value: acc.id, label: acc.name }))}
                  value={bankAccountId}
                  onChange={setBankAccountId}
                />
              </div>

              <div>
                <NepaliDatePicker
                  label="Payment Date"
                  value={paymentDate}
                  onChange={setPaymentDate}
                />
              </div>

              <div>
                <Select
                  label="File Format"
                  options={[
                    { value: "csv-standard", label: "CSV Standard" },
                    { value: "text-fixed-width", label: "Text Fixed Width" },
                    { value: "xml", label: "XML" },
                  ]}
                  value={fileFormat}
                  onChange={setFileFormat}
                />
              </div>

              <div>
                <input
                  type="text"
                  label="Batch No"
                  value={editingBatch?.batchNo || ""}
                  readOnly
                  className="w-full p-2 border rounded text-sm bg-gray-100"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Narration</label>
              <textarea
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="w-full p-2 border rounded text-sm"
                rows={2}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <div className="mb-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--ds-text-strong)]">Payment Type Rules</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">RTGS Threshold (₹)</label>
                <input
                  type="number"
                  value={rtgsThreshold}
                  onChange={(e) => setRtgsThreshold(Number(e.target.value))}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="200000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Amounts ≥ this value will be marked as RTGS
                </p>
              </div>

              <div className="flex items-center pt-6">
                <input
                  type="checkbox"
                  id="enable-imps"
                  checked={enableImps}
                  onChange={(e) => setEnableImps(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="enable-imps" className="ml-2 block text-sm text-gray-900">
                  Enable IMPS for eligible payments
                </label>
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--ds-text-strong)]">Select Payment Vouchers</h3>

            <p className="text-sm text-gray-600 mb-4">
              Select payment vouchers to include in this batch
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 p-2">
                      <input
                        type="checkbox"
                        checked={
                          selectedVouchers.length === unbatchedVouchers.length &&
                          unbatchedVouchers.length > 0
                        }
                        onChange={handleToggleAllVouchers}
                      />
                    </th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Payee Name</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Account No</th>
                    <th className="p-2 text-left">IFSC</th>
                    <th className="p-2 text-left">Bank</th>
                    <th className="p-2 text-left">Auto Type</th>
                  </tr>
                </thead>
                <tbody>
                  {unbatchedVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-gray-500">
                        No unbatched e-payment vouchers found
                      </td>
                    </tr>
                  ) : (
                    unbatchedVouchers.map((voucher) => {
                      const party = parties.find((p) => p.id === voucher.partyId);
                      const isSelected = selectedVouchers.includes(voucher.id);
                      const hasMissingDetails = !party?.bankAccountNo || !party?.bankBranch;

                      return (
                        <tr
                          key={voucher.id}
                          className={`border-t ${hasMissingDetails ? "bg-red-50" : "hover:bg-gray-50"}`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleVoucher(voucher.id)}
                            />
                          </td>
                          <td className="p-2">{voucher.date}</td>
                          <td className="p-2">{party?.name || "Unknown"}</td>
                          <td className="p-2 text-right">
                            {formatNumber(voucher.grandTotal || 0)}
                          </td>
                          <td className="p-2">{party?.bankAccountNo || "—"}</td>
                          <td className="p-2">{party?.bankBranch || "—"}</td>
                          <td className="p-2">{party?.bankName || "—"}</td>
                          <td className="p-2">
                            {hasMissingDetails ? (
                              <div className="flex items-center text-red-600">
                                <span>Missing</span>
                                <span
                                  className="ml-1 text-xs"
                                  title="Missing beneficiary details — update ledger master"
                                >
                                  ⚠️
                                </span>
                              </div>
                            ) : (
                              (() => {
                                const amount = voucher.grandTotal || 0;
                                if (amount >= rtgsThreshold) return "RTGS";
                                if (enableImps) return "IMPS";
                                return "NEFT";
                              })()
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500">Selected Entries</p>
                <p className="font-bold">{selectedVoucherData.length}</p>
              </div>

              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p className="text-xs text-blue-600">Total Amount</p>
                <p className="font-bold text-blue-800">{formatNumber(totalAmount)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setView("list")}>
              Cancel
            </Button>
            <Button onClick={handleGenerateFile}>Generate File</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ActionToolbar title="e-Payments" icon={<Send size={16} />}>
        <Button size="sm" onClick={handleNewBatch}>
          <Plus size={14} className="mr-1" />
          New Batch
        </Button>
        <Button size="sm" variant="outline" onClick={() => setView("list")}>
          <Eye size={14} className="mr-1" />
          View Batches
        </Button>
      </ActionToolbar>

      <div className="flex-1 overflow-auto p-4">
        {/* e-Payment Batches Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Batch No</th>
                <th className="p-3 text-left">Payment Date</th>
                <th className="p-3 text-left">Bank Account</th>
                <th className="p-3 text-right">Entries</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-left">Format</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ePaymentBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No e-payment batches found
                  </td>
                </tr>
              ) : (
                ePaymentBatches.map((batch) => {
                  const bankAccount = accounts.find((a) => a.id === batch.bankAccountId);

                  return (
                    <tr key={batch.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">{batch.batchNo}</td>
                      <td className="p-3">{batch.paymentDate}</td>
                      <td className="p-3">{bankAccount?.name || "Unknown"}</td>
                      <td className="p-3 text-right">{batch.entryCount}</td>
                      <td className="p-3 text-right">{formatNumber(batch.totalAmount)}</td>
                      <td className="p-3">{batch.fileFormat}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            batch.status === "draft"
                              ? "warning"
                              : batch.status === "generated"
                                ? "info"
                                : batch.status === "uploaded"
                                  ? "secondary"
                                  : "success"
                          }
                        >
                          {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button size="xs" variant="ghost" onClick={() => handleViewBatch(batch)}>
                            <Eye size={12} className="mr-1" />
                            View
                          </Button>

                          {batch.generatedFileContent && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                const link = document.createElement("a");
                                const blob = new Blob([batch.generatedFileContent], {
                                  type:
                                    batch.fileFormat === "csv-standard"
                                      ? "text/csv"
                                      : batch.fileFormat === "text-fixed-width"
                                        ? "text/plain"
                                        : "application/xml",
                                });
                                const url = URL.createObjectURL(blob);
                                link.href = url;
                                link.download = `epayment-${batch.batchNo}.${batch.fileFormat.split("-")[0]}`;
                                link.click();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              <Download size={12} className="mr-1" />
                              Download
                            </Button>
                          )}

                          {batch.status === "generated" && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleMarkUploaded(batch.id)}
                            >
                              <Upload size={12} className="mr-1" />
                              Upload
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
