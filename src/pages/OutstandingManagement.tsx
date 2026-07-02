// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import toast from "react-hot-toast";
import {
  Printer,
  Mail,
  FileText,
  CheckCircle,
  Plus,
  CheckSquare,
  Bell,
  Clock,
  Search,
  AlertTriangle,
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const OutstandingManagement: React.FC = () => {
  const { invoices, parties, vouchers, companySettings, accounts, addVoucher } = useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [minAmount, setMinAmount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [pdcs, setPdcs] = useState<any[]>([]);
  const [showPdcForm, setShowPdcForm] = useState(false);
  const [pdcForm, setPdcForm] = useState({
    partyId: "",
    chequeNo: "",
    bankName: "",
    chequeDate: "",
    amount: 0,
    receivedDate: new Date().toISOString().split("T")[0],
    linkedInvoiceId: "",
  });
  const [showBounceForm, setShowBounceForm] = useState(false);
  const [bounceForm, setBounceForm] = useState({
    bankCharge: 0,
    bankChargeDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });
  const [selectedPdc, setSelectedPdc] = useState<any>(null);

  const [statementParty, setStatementParty] = useState("");
  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState(new Date().toISOString().split("T")[0]);
  const [statementData, setStatementData] = useState<any[]>([]);

  const [agingBucket, setAgingBucket] = useState("30");
  const [tone, setTone] = useState("gentle");
  const [selectedParties, setSelectedParties] = useState<Set<string>>(new Set());
  const [reminderLetters, setReminderLetters] = useState<string[]>([]);

  useEffect(() => {
    const db = getDB();
    db.table("pdcRecords")
      .toArray()
      .then(setPdcs)
      .catch(() => setPdcs([]));
  }, []);

  const getPartyOutstanding = (partyId: string, invoicesList: any[], vouchersList: any[]) => {
    const partyInvoices = invoicesList.filter(
      (i) =>
        i.partyId === partyId &&
        (i.paymentStatus === "unpaid" || i.paymentStatus === "partial") &&
        i.status === "posted",
    );

    return partyInvoices.map((inv) => {
      const paid = (vouchersList || [])
        .filter(
          (v) =>
            v.billWiseDetails?.some((b: any) => b.invoiceId === inv.id) ||
            v.linkedInvoiceId === inv.id,
        )
        .reduce((s: number, v: any) => s + (v.amount || v.grandTotal || 0), 0);

      const balance = (inv.grandTotal || 0) - paid;
      const party = parties.find((p) => p.id === partyId);
      const creditDays = party?.creditDays || 30;
      const dueDate = new Date(inv.date);
      dueDate.setDate(dueDate.getDate() + creditDays);
      const daysOverdue = Math.max(
        0,
        Math.floor((new Date().getTime() - dueDate.getTime()) / 86400000),
      );
      const interestRate = party?.interestRate || 0;
      const interest = balance * (interestRate / 100 / 365) * daysOverdue;

      return {
        ...inv,
        paid,
        balance,
        dueDate: dueDate.toISOString().split("T")[0],
        daysOverdue,
        interest,
      };
    });
  };

  const receivables = useMemo(() => {
    const salesInvoices = invoices.filter(
      (i) =>
        (i.type === "sales-invoice" || i.type === "sales") &&
        (i.paymentStatus === "unpaid" || i.paymentStatus === "partial") &&
        i.status === "posted",
    );

    const filtered = salesInvoices.filter((inv) => {
      const outstanding = getPartyOutstanding(inv.partyId, [inv], vouchers)[0];
      const matchesDate = new Date(inv.date) <= new Date(asOfDate);
      const matchesAmount = outstanding?.balance >= minAmount;
      const matchesSearch = parties.some(
        (p) => p.id === inv.partyId && p.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      return matchesDate && matchesAmount && matchesSearch;
    });

    return filtered
      .map((inv) => getPartyOutstanding(inv.partyId, [inv], vouchers)[0])
      .filter((i) => i.balance > 0);
  }, [invoices, vouchers, asOfDate, minAmount, searchTerm, parties]);

  const payables = useMemo(() => {
    const purchaseInvoices = invoices.filter(
      (i) =>
        (i.type === "purchase-invoice" || i.type === "purchase") &&
        (i.paymentStatus === "unpaid" || i.paymentStatus === "partial") &&
        i.status === "posted",
    );

    const filtered = purchaseInvoices.filter((inv) => {
      const outstanding = getPartyOutstanding(inv.partyId, [inv], vouchers)[0];
      const matchesDate = new Date(inv.date) <= new Date(asOfDate);
      const matchesAmount = outstanding?.balance >= minAmount;
      const matchesSearch = parties.some(
        (p) => p.id === inv.partyId && p.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      return matchesDate && matchesAmount && matchesSearch;
    });

    return filtered
      .map((inv) => getPartyOutstanding(inv.partyId, [inv], vouchers)[0])
      .filter((i) => i.balance > 0);
  }, [invoices, vouchers, asOfDate, minAmount, searchTerm, parties]);

  const receivableTotals = useMemo(() => {
    return receivables.reduce(
      (acc, inv) => {
        acc.totalOutstanding += inv.balance;
        acc.totalInterest += inv.interest;
        return acc;
      },
      { totalOutstanding: 0, totalInterest: 0 },
    );
  }, [receivables]);

  const payableTotals = useMemo(() => {
    return payables.reduce(
      (acc, inv) => {
        acc.totalOutstanding += inv.balance;
        acc.totalInterest += inv.interest;
        return acc;
      },
      { totalOutstanding: 0, totalInterest: 0 },
    );
  }, [payables]);

  const handlePdcFormChange = (field: string, value: any) => {
    setPdcForm((prev) => ({ ...prev, [field]: value }));
  };

  const savePdc = async () => {
    if (!pdcForm.partyId || !pdcForm.chequeNo || !pdcForm.chequeDate || pdcForm.amount <= 0) {
      toast.error("Please fill all required fields");
      return;
    }

    const db = getDB();
    const pdcRecord = {
      id: generateId(),
      ...pdcForm,
      status: "held",
      createdAt: new Date().toISOString(),
    };

    try {
      await db.table("pdcRecords").add(pdcRecord);
      setPdcs((prev) => [...prev, pdcRecord]);
      setShowPdcForm(false);
      setPdcForm({
        partyId: "",
        chequeNo: "",
        bankName: "",
        chequeDate: "",
        amount: 0,
        receivedDate: new Date().toISOString().split("T")[0],
        linkedInvoiceId: "",
      });
      toast.success("PDC saved successfully");
    } catch (error) {
      toast.error("Failed to save PDC");
    }
  };

  const markDeposited = (id: string) => {
    const db = getDB();
    db.table("pdcRecords").update(id, {
      status: "deposited",
      depositDate: new Date().toISOString(),
    });
    setPdcs((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "deposited", depositDate: new Date().toISOString() } : p,
      ),
    );
    toast.success("PDC marked as deposited");
  };

  const markBounced = (pdc: any) => {
    setSelectedPdc(pdc);
    setShowBounceForm(true);
  };

  const executeBounce = async () => {
    if (!selectedPdc) return;
    try {
      const partyAccount = accounts.find(
        (a) => a.name === parties.find((p) => p.id === selectedPdc.partyId)?.name,
      );
      const bankAccount = accounts.find((a) => a.name.toLowerCase().includes("bank"));

      if (!partyAccount || !bankAccount) {
        toast.error("Required accounts not found");
        return;
      }

      await addVoucher({
        id: generateId(),
        type: "payment",
        status: "posted",
        date: bounceForm.bankChargeDate,
        narration: `PDC bounce reversal: Cheque ${selectedPdc.chequeNo}`,
        lines: [
          {
            accountId: partyAccount.id,
            accountName: partyAccount.name,
            debit: selectedPdc.amount,
            credit: 0,
          },
          {
            accountId: bankAccount.id,
            accountName: bankAccount.name,
            debit: 0,
            credit: selectedPdc.amount,
          },
        ],
        totalDebit: selectedPdc.amount,
        totalCredit: selectedPdc.amount,
      });

      const bankChargeAccount = accounts.find((a) => a.name.toLowerCase().includes("bank charge"));
      if (bankChargeAccount && bounceForm.bankCharge > 0) {
        await addVoucher({
          id: generateId(),
          type: "journal",
          status: "posted",
          date: bounceForm.bankChargeDate,
          narration: `Bank charges for bounced PDC ${selectedPdc.chequeNo}`,
          lines: [
            {
              accountId: bankChargeAccount.id,
              accountName: bankChargeAccount.name,
              debit: bounceForm.bankCharge,
              credit: 0,
            },
            {
              accountId: bankAccount.id,
              accountName: bankAccount.name,
              debit: 0,
              credit: bounceForm.bankCharge,
            },
          ],
          totalDebit: bounceForm.bankCharge,
          totalCredit: bounceForm.bankCharge,
        });
      }

      const db = getDB();
      await db
        .table("pdcRecords")
        .update(selectedPdc.id, { status: "bounced", bouncedDate: new Date().toISOString() });
      setPdcs((prev) =>
        prev.map((p) =>
          p.id === selectedPdc.id
            ? { ...p, status: "bounced", bouncedDate: new Date().toISOString() }
            : p,
        ),
      );

      setShowBounceForm(false);
      setSelectedPdc(null);
      toast.success("PDC marked as bounced and reversed");
    } catch (error) {
      toast.error("Failed to process bounce");
    }
  };

  const generateInterestJournal = async () => {
    const overdueInvoices = receivables.filter((inv) => inv.interest > 0);

    if (overdueInvoices.length === 0) {
      toast.info("No overdue invoices with interest");
      return;
    }

    let processed = 0;
    for (const inv of overdueInvoices) {
      const party = parties.find((p) => p.id === inv.partyId);
      const partyAccount = accounts.find((a) => a.name === party?.name || a.partyId === party?.id);
      const interestIncomeAccount = accounts.find((a) =>
        a.name.toLowerCase().includes("interest income"),
      );

      if (!partyAccount || !interestIncomeAccount) continue;

      await addVoucher({
        id: generateId(),
        type: "journal",
        status: "posted",
        date: new Date().toISOString().split("T")[0],
        narration: `Interest on overdue invoice ${inv.invoiceNo}`,
        lines: [
          {
            accountId: partyAccount.id,
            accountName: partyAccount.name,
            debit: inv.interest,
            credit: 0,
          },
          {
            accountId: interestIncomeAccount.id,
            accountName: interestIncomeAccount.name,
            debit: 0,
            credit: inv.interest,
          },
        ],
        totalDebit: inv.interest,
        totalCredit: inv.interest,
      });
      processed++;
    }

    toast.success(`Interest journal entries created for ${processed} invoices`);
  };

  const generateStatement = () => {
    if (!statementParty || !statementFrom || !statementTo) {
      toast.error("Please fill party and dates");
      return;
    }
    const party = parties.find((p) => p.id === statementParty);
    if (!party) return;

    const startDate = new Date(statementFrom);
    const endDate = new Date(statementTo);

    const partyTransactions = vouchers
      .filter(
        (v) =>
          v.status === "posted" &&
          v.lines?.some((l: any) => l.accountId === party.accountId) &&
          new Date(v.date) >= startDate &&
          new Date(v.date) <= endDate,
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const openingVouchers = vouchers.filter(
      (v) =>
        v.status === "posted" &&
        v.lines?.some((l: any) => l.accountId === party.accountId) &&
        new Date(v.date) < startDate,
    );

    let runningBalance = openingVouchers.reduce((sum, v) => {
      const line = v.lines?.find((l: any) => l.accountId === party.accountId);
      if (line) {
        return sum + (line.debit || 0) - (line.credit || 0);
      }
      return sum;
    }, 0);

    const statementRows = partyTransactions
      .map((v) => {
        const line = v.lines?.find((l: any) => l.accountId === party.accountId);
        if (line) {
          const dr = line.debit || 0;
          const cr = line.credit || 0;
          runningBalance += dr - cr;

          return {
            date: v.date,
            voucherNo: v.voucherNo || v.referenceNo || "N/A",
            description: v.narration || line.narration || "Transaction",
            dr: dr,
            cr: cr,
            balance: runningBalance,
          };
        }
        return null;
      })
      .filter(Boolean);

    setStatementData([
      {
        date: statementFrom,
        voucherNo: "OPENING",
        description: "Opening Balance",
        dr: runningBalance > 0 ? runningBalance : 0,
        cr: runningBalance < 0 ? Math.abs(runningBalance) : 0,
        balance: runningBalance,
      },
      ...statementRows,
    ]);
  };

  const generateReminderLetters = () => {
    const selectedPartyList = Array.from(selectedParties);
    if (selectedPartyList.length === 0) {
      toast.error("No parties selected");
      return;
    }

    const letters = selectedPartyList
      .map((partyId) => {
        const party = parties.find((p) => p.id === partyId);
        const partyInvoices = receivables.filter(
          (inv) => inv.partyId === partyId && inv.daysOverdue >= Number(agingBucket),
        );

        if (!party || partyInvoices.length === 0) return "";

        const inv = partyInvoices[0]; // Primary overdue invoice

        let letter = "";
        if (tone === "gentle") {
          letter = `Dear ${party.name},\n\nWe hope this letter finds you in good health. We wish to bring to your attention that invoice number ${inv.invoiceNo} dated ${inv.date} for Rs. ${money(inv.balance)} is now ${inv.daysOverdue} days past its due date of ${inv.dueDate}.\n\nWe kindly request you to arrange payment at your earliest convenience. Please feel free to contact us if you have any queries.\n\nThank you for your continued business.\n\nWarm regards,\n${companySettings?.name || "Accounts Department"}`;
        } else if (tone === "firm") {
          letter = `Dear ${party.name},\n\nThis is a formal reminder that invoice no. ${inv.invoiceNo} dated ${inv.date} for Rs. ${money(inv.balance)} was due on ${inv.dueDate} and remains unpaid after ${inv.daysOverdue} days. We request immediate payment or contact within 7 days to avoid further action.\n\nSincerely,\n${companySettings?.name || "Accounts Department"}`;
        } else if (tone === "final") {
          letter = `Dear ${party.name},\n\nDespite our previous reminders, invoice ${inv.invoiceNo} for Rs. ${money(inv.balance)} remains unpaid since ${inv.daysOverdue} days beyond its due date. We are obliged to inform you that unless payment is received within 72 hours, we shall be constrained to initiate legal proceedings to recover the outstanding amount.\n\nFinal Notice,\n${companySettings?.name || "Accounts Department"}`;
        }

        return letter;
      })
      .filter((l) => l !== "");

    setReminderLetters(letters);
    toast.success("Letters generated successfully");
  };

  const exportToPdf = (data: any[], title: string) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(title, 14, 15);

    if (data.length > 0) {
      (doc as any).autoTable({
        startY: 20,
        head: [
          Object.keys(data[0]).map((k) =>
            k.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
          ),
        ],
        body: data.map((item) => Object.values(item)),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [21, 87, 176] },
      });
    }

    doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
    toast.success("Exported to PDF");
  };

  const todaysDueCheques = pdcs.filter(
    (pdc) => pdc.chequeDate === new Date().toISOString().split("T")[0] && pdc.status === "held",
  );
  const todaysDueTotal = todaysDueCheques.reduce((sum, pdc) => sum + pdc.amount, 0);

  const getAgingBgColor = (days: number) => {
    if (days === 0) return "bg-white";
    if (days <= 30) return "bg-yellow-50/50";
    if (days <= 60) return "bg-amber-50/50";
    if (days <= 90) return "bg-orange-50/50";
    return "bg-red-50/50";
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Outstanding Management</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Manage receivables, payables, PDCs, statements, and reminders
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm overflow-x-auto hide-scrollbar">
          {[
            "Bills Receivable",
            "Bills Payable",
            "PDC Register",
            "Statement of Account",
            "Reminder Letters",
          ].map((tab, index) => (
            <button
              key={index}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === index
                  ? "border-[#1557b0] text-[#1557b0]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab(index)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex flex-wrap items-end gap-3 mb-4 bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="w-40">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  As of Date
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Min Amount
                </label>
                <input
                  type="number"
                  value={minAmount || ""}
                  placeholder="0.00"
                  onChange={(e) => setMinAmount(Number(e.target.value))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Search Party
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search party name..."
                    className="h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
              </div>
              <button
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm ml-auto"
                onClick={generateInterestJournal}
              >
                <Clock size={14} />
                Generate Interest Journal
              </button>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Invoice No
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Party
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Inv Date
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Due Date
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Received
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Balance
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Days Due
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Interest
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((inv) => {
                    const party = parties.find((p) => p.id === inv.partyId);
                    return (
                      <tr
                        key={inv.id}
                        className={`${getAgingBgColor(inv.daysOverdue)} hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors`}
                      >
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{inv.invoiceNo}</td>
                        <td className="px-3 py-2.5 text-gray-700">{party?.name || "Unknown"}</td>
                        <td className="px-3 py-2.5 text-gray-700">{inv.date}</td>
                        <td className="px-3 py-2.5 text-gray-700">{inv.dueDate}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">
                          {money(inv.grandTotal)}
                        </td>
                        <td className="px-3 py-2.5 text-green-600 text-right">{money(inv.paid)}</td>
                        <td className="px-3 py-2.5 text-red-600 font-medium text-right">
                          {money(inv.balance)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 text-right font-medium">
                          {inv.daysOverdue}
                        </td>
                        <td className="px-3 py-2.5 text-amber-600 text-right">
                          {money(inv.interest)}
                        </td>
                      </tr>
                    );
                  })}
                  {receivables.length > 0 && (
                    <tr className="bg-[#f5f6fa] border-t-2 border-gray-200">
                      <td
                        className="px-3 py-2.5 text-[11px] font-bold text-gray-700 uppercase"
                        colSpan={4}
                      >
                        Totals
                      </td>
                      <td
                        className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right"
                        colSpan={3}
                      >
                        {money(receivableTotals.totalOutstanding)}
                      </td>
                      <td className="px-3 py-2.5" colSpan={1}></td>
                      <td className="px-3 py-2.5 text-[12px] font-bold text-amber-600 text-right">
                        {money(receivableTotals.totalInterest)}
                      </td>
                    </tr>
                  )}
                  {receivables.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No outstanding receivables found matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex flex-wrap items-end gap-3 mb-4 bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="w-40">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  As of Date
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Min Amount
                </label>
                <input
                  type="number"
                  value={minAmount || ""}
                  placeholder="0.00"
                  onChange={(e) => setMinAmount(Number(e.target.value))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Search Party
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search party name..."
                    className="h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  />
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Invoice No
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Party
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Inv Date
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Due Date
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Paid
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Balance
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Days Due
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Interest
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map((inv) => {
                    const party = parties.find((p) => p.id === inv.partyId);
                    return (
                      <tr
                        key={inv.id}
                        className={`${getAgingBgColor(inv.daysOverdue)} hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors`}
                      >
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{inv.invoiceNo}</td>
                        <td className="px-3 py-2.5 text-gray-700">{party?.name || "Unknown"}</td>
                        <td className="px-3 py-2.5 text-gray-700">{inv.date}</td>
                        <td className="px-3 py-2.5 text-gray-700">{inv.dueDate}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">
                          {money(inv.grandTotal)}
                        </td>
                        <td className="px-3 py-2.5 text-green-600 text-right">{money(inv.paid)}</td>
                        <td className="px-3 py-2.5 text-red-600 font-medium text-right">
                          {money(inv.balance)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 text-right font-medium">
                          {inv.daysOverdue}
                        </td>
                        <td className="px-3 py-2.5 text-amber-600 text-right">
                          {money(inv.interest)}
                        </td>
                      </tr>
                    );
                  })}
                  {payables.length > 0 && (
                    <tr className="bg-[#f5f6fa] border-t-2 border-gray-200">
                      <td
                        className="px-3 py-2.5 text-[11px] font-bold text-gray-700 uppercase"
                        colSpan={4}
                      >
                        Totals
                      </td>
                      <td
                        className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right"
                        colSpan={3}
                      >
                        {money(payableTotals.totalOutstanding)}
                      </td>
                      <td className="px-3 py-2.5" colSpan={1}></td>
                      <td className="px-3 py-2.5 text-[12px] font-bold text-amber-600 text-right">
                        {money(payableTotals.totalInterest)}
                      </td>
                    </tr>
                  )}
                  {payables.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No outstanding payables found matching the criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">
                Post-Dated Cheque Register
              </h2>
              <button
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={() => setShowPdcForm(true)}
              >
                <Plus size={14} />
                Add PDC
              </button>
            </div>

            {todaysDueCheques.length > 0 && (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 mb-4 flex items-center gap-2 text-[13px] font-medium shadow-sm">
                <Bell size={16} className="text-amber-500" />
                {todaysDueCheques.length} cheque(s) are due TODAY for deposit! Total: NPR{" "}
                {money(todaysDueTotal)}
              </div>
            )}

            {showPdcForm && (
              <div className="mb-6 bg-white border border-gray-200 shadow-sm rounded-md p-4">
                <h3 className="text-[14px] font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  Add New PDC
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Party <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={pdcForm.partyId}
                      onChange={(e) => handlePdcFormChange("partyId", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="">Select Party</option>
                      {parties
                        .filter((p) => p.type === "customer" || p.type === "both")
                        .map((party) => (
                          <option key={party.id} value={party.id}>
                            {party.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Cheque Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pdcForm.chequeNo}
                      onChange={(e) => handlePdcFormChange("chequeNo", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pdcForm.bankName}
                      onChange={(e) => handlePdcFormChange("bankName", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Cheque Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={pdcForm.chequeDate}
                      onChange={(e) => handlePdcFormChange("chequeDate", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={pdcForm.amount || ""}
                      onChange={(e) => handlePdcFormChange("amount", Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white text-right focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Linked Invoice
                    </label>
                    <select
                      value={pdcForm.linkedInvoiceId}
                      onChange={(e) => handlePdcFormChange("linkedInvoiceId", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="">Select Invoice</option>
                      {invoices
                        .filter((inv) => inv.partyId === pdcForm.partyId)
                        .map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoiceNo} - Rs. {money(inv.grandTotal)}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                    onClick={() => setShowPdcForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                    onClick={savePdc}
                  >
                    Save PDC
                  </button>
                </div>
              </div>
            )}

            {showBounceForm && selectedPdc && (
              <div className="mb-6 bg-red-50 border border-red-200 shadow-sm rounded-md p-4">
                <h3 className="text-[14px] font-semibold text-red-800 mb-4 pb-2 border-b border-red-100 flex items-center gap-2">
                  <AlertTriangle size={16} /> Mark PDC as Bounced
                </h3>
                <div className="text-[12px] text-red-700 mb-4">
                  Cheque <strong>{selectedPdc.chequeNo}</strong> from{" "}
                  <strong>{parties.find((p) => p.id === selectedPdc.partyId)?.name}</strong> for NPR{" "}
                  <strong>{money(selectedPdc.amount)}</strong>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-red-700 mb-1">
                      Bank Charges (NPR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={bounceForm.bankCharge}
                      onChange={(e) =>
                        setBounceForm((prev) => ({ ...prev, bankCharge: Number(e.target.value) }))
                      }
                      className="h-8 px-2.5 text-[12px] border border-red-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-red-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={bounceForm.bankChargeDate}
                      onChange={(e) =>
                        setBounceForm((prev) => ({ ...prev, bankChargeDate: e.target.value }))
                      }
                      className="h-8 px-2.5 text-[12px] border border-red-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-red-100">
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setShowBounceForm(false);
                      setSelectedPdc(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-8 px-4 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                    onClick={executeBounce}
                  >
                    Execute Bounce & Reverse
                  </button>
                </div>
              </div>
            )}

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Cheque No
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Bank
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Party
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Cheque Date
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Days to Maturity
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Linked Invoice
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pdcs.map((pdc) => {
                    const party = parties.find((p) => p.id === pdc.partyId);
                    const invoice = invoices.find((i) => i.id === pdc.linkedInvoiceId);
                    const chequeDate = new Date(pdc.chequeDate);
                    const today = new Date();
                    const daysToMaturity = Math.ceil(
                      (chequeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    );

                    const isPastDue = chequeDate < today && pdc.status === "held";

                    return (
                      <tr
                        key={pdc.id}
                        className={`${isPastDue ? "bg-red-50" : "bg-white"} hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors`}
                      >
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{pdc.chequeNo}</td>
                        <td className="px-3 py-2.5 text-gray-700">{pdc.bankName}</td>
                        <td className="px-3 py-2.5 text-gray-700">{party?.name || "Unknown"}</td>
                        <td className="px-3 py-2.5 text-gray-700">{pdc.chequeDate}</td>
                        <td className="px-3 py-2.5 text-gray-800 text-right font-medium">
                          {money(pdc.amount)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                              pdc.status === "held"
                                ? "bg-amber-100 text-amber-700"
                                : pdc.status === "deposited"
                                  ? "bg-blue-100 text-blue-700"
                                  : pdc.status === "cleared"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                            }`}
                          >
                            {pdc.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 text-right">
                          {pdc.status === "held" ? daysToMaturity : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{invoice?.invoiceNo || "-"}</td>
                        <td className="px-3 py-2.5 text-center">
                          {pdc.status === "held" && (
                            <div className="flex items-center justify-center gap-3">
                              <button
                                className="text-green-600 hover:text-green-700 font-medium transition-colors"
                                onClick={() => markDeposited(pdc.id)}
                              >
                                Deposit
                              </button>
                              <button
                                className="text-red-600 hover:text-red-700 font-medium transition-colors"
                                onClick={() => markBounced(pdc)}
                              >
                                Bounce
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {pdcs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No post-dated cheques recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex flex-wrap items-end gap-3 mb-6 bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Select Party <span className="text-red-500">*</span>
                </label>
                <select
                  value={statementParty}
                  onChange={(e) => setStatementParty(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="">Select Party</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={statementFrom}
                  onChange={(e) => setStatementFrom(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={statementTo}
                  onChange={(e) => setStatementTo(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                onClick={generateStatement}
              >
                Generate Statement
              </button>
            </div>

            {statementData.length > 0 && (
              <div className="border border-gray-200 rounded-md p-6 bg-white shadow-sm mb-4">
                <div className="text-center mb-6">
                  <h2 className="text-[18px] font-bold text-gray-800">
                    {companySettings?.name || "Company Name"}
                  </h2>
                  <div className="text-[14px] font-semibold text-gray-600 mt-1 uppercase tracking-widest">
                    Statement of Account
                  </div>
                  <div className="text-[12px] text-gray-500 mt-2">
                    Party:{" "}
                    <span className="font-semibold text-gray-700">
                      {parties.find((p) => p.id === statementParty)?.name}
                    </span>
                  </div>
                  <div className="text-[12px] text-gray-500">
                    Period: {statementFrom || "Start"} to {statementTo}
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-md">
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Date
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Voucher No
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-1/3">
                          Description
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Debit
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Credit
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementData.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors"
                        >
                          <td className="px-3 py-2 text-gray-700">{row.date}</td>
                          <td className="px-3 py-2 text-gray-700">{row.voucherNo}</td>
                          <td
                            className="px-3 py-2 text-gray-700 truncate max-w-xs"
                            title={row.description}
                          >
                            {row.description}
                          </td>
                          <td className="px-3 py-2 text-gray-700 text-right">
                            {row.dr > 0 ? money(row.dr) : ""}
                          </td>
                          <td className="px-3 py-2 text-gray-700 text-right">
                            {row.cr > 0 ? money(row.cr) : ""}
                          </td>
                          <td className="px-3 py-2 text-gray-800 font-medium text-right">
                            {money(row.balance)} {row.balance >= 0 ? "Dr" : "Cr"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200 text-right">
                  <span className="text-[12px] text-gray-600 mr-4">Closing Balance:</span>
                  <span className="text-[16px] font-bold text-[#1557b0]">
                    Rs. {money(Math.abs(statementData[statementData.length - 1]?.balance || 0))}{" "}
                    {statementData[statementData.length - 1]?.balance >= 0 ? "Dr" : "Cr"}
                  </span>
                </div>

                <div className="mt-6 flex gap-2 justify-end">
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-sm"
                    onClick={() => window.print()}
                  >
                    <Printer size={14} />
                    Print
                  </button>
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-sm"
                    onClick={() =>
                      exportToPdf(
                        statementData,
                        `Statement_${parties.find((p) => p.id === statementParty)?.name || "Unknown"}`,
                      )
                    }
                  >
                    <FileText size={14} />
                    Export PDF
                  </button>
                  <button
                    className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                    onClick={() => {
                      const party = parties.find((p) => p.id === statementParty);
                      window.location.href = `mailto:${party?.email}?subject=Statement of Account&body=Dear%20${encodeURIComponent(party?.name || "")}%20,%0D%0A%0D%0APlease%20find%20attached%20your%20statement%20of%20account.%0D%0A%0D%0AThanks%20and%20regards,%0D%0A${encodeURIComponent(companySettings?.name || "")}`;
                    }}
                  >
                    <Mail size={14} />
                    Email Statement
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 4 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex flex-wrap items-end gap-3 mb-6 bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="w-48">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Aging Bucket
                </label>
                <select
                  value={agingBucket}
                  onChange={(e) => setAgingBucket(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="30">30+ days overdue</option>
                  <option value="60">60+ days overdue</option>
                  <option value="90">90+ days overdue</option>
                </select>
              </div>
              <div className="w-48">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="gentle">Gentle Reminder</option>
                  <option value="firm">Firm Reminder</option>
                  <option value="final">Final Notice</option>
                </select>
              </div>

              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm ml-auto"
                onClick={generateReminderLetters}
              >
                Generate Letters
              </button>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden mb-6">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-10">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const allSelected = new Set(
                              parties
                                .filter((p) =>
                                  getPartyOutstanding(p.id, invoices, vouchers).some(
                                    (inv) => inv.daysOverdue >= Number(agingBucket),
                                  ),
                                )
                                .map((p) => p.id),
                            );
                            setSelectedParties(allSelected);
                          } else {
                            setSelectedParties(new Set());
                          }
                        }}
                        checked={
                          parties.filter((p) =>
                            getPartyOutstanding(p.id, invoices, vouchers).some(
                              (inv) => inv.daysOverdue >= Number(agingBucket),
                            ),
                          ).length > 0 &&
                          selectedParties.size ===
                            parties.filter((p) =>
                              getPartyOutstanding(p.id, invoices, vouchers).some(
                                (inv) => inv.daysOverdue >= Number(agingBucket),
                              ),
                            ).length
                        }
                        className="h-3.5 w-3.5 text-[#1557b0] rounded border-gray-300 focus:ring-[#1557b0]"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Party
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Contact
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Outstanding Amount
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Max Days Overdue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parties.map((party) => {
                    const partyOutstandings = getPartyOutstanding(
                      party.id,
                      invoices,
                      vouchers,
                    ).filter((inv) => inv.daysOverdue >= Number(agingBucket));
                    if (partyOutstandings.length === 0) return null;

                    const totalOutstanding = partyOutstandings.reduce(
                      (sum, inv) => sum + inv.balance,
                      0,
                    );
                    const maxDaysOverdue = Math.max(
                      ...partyOutstandings.map((inv) => inv.daysOverdue),
                    );

                    return (
                      <tr
                        key={party.id}
                        className="bg-white hover:bg-gray-50 border-b border-gray-100 text-[12px] transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedParties.has(party.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedParties);
                              if (e.target.checked) {
                                newSelected.add(party.id);
                              } else {
                                newSelected.delete(party.id);
                              }
                              setSelectedParties(newSelected);
                            }}
                            className="h-3.5 w-3.5 text-[#1557b0] rounded border-gray-300 focus:ring-[#1557b0]"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{party.name}</td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {party.email || party.phone || "N/A"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-800 font-medium text-right">
                          {money(totalOutstanding)}
                        </td>
                        <td className="px-3 py-2.5 text-red-600 font-medium text-right">
                          {maxDaysOverdue}
                        </td>
                      </tr>
                    );
                  })}
                  {parties.filter((p) =>
                    getPartyOutstanding(p.id, invoices, vouchers).some(
                      (inv) => inv.daysOverdue >= Number(agingBucket),
                    ),
                  ).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No parties found with outstandings matching this aging criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {reminderLetters.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[14px] font-semibold text-gray-800">
                    Generated Letters ({reminderLetters.length})
                  </h3>
                  <button
                    className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                    onClick={() => window.print()}
                  >
                    <Printer size={14} />
                    Print All Letters
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reminderLetters.map((letter, index) => (
                    <div
                      key={index}
                      className="bg-white border border-gray-200 p-6 rounded-md shadow-sm whitespace-pre-wrap text-[13px] font-serif leading-relaxed text-gray-800"
                    >
                      {letter}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutstandingManagement;
