// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { ActionToolbar, Select, NepaliDatePicker, Button, Badge } from "../components/ui";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { generateId } from "../lib/db";
import toast from "@/lib/appToast";
import {
  CalendarClock,
  Plus,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  Clock,
  Calendar,
} from "lucide-react";
import { formatADToBS } from "../lib/nepaliDate";

export default function PDCSummary() {
  const {
    parties,
    vouchers,
    pdCheques,
    accounts,
    companySettings,
    currentUser,
    savePDCheque,
    updatePDCheque,
    convertPDCToBank,
  } = useStore();

  const [activeTab, setActiveTab] = useState<"received" | "issued">("received");
  const [bucketView, setBucketView] = useState(false);
  const [filters, setFilters] = useState({
    partyId: "",
    bankName: "",
    dateFrom: "",
    dateTo: "",
    statuses: [] as string[],
    types: [] as string[],
  });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"issued" | "received">("received");
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingPDC, setConvertingPDC] = useState<any>(null);

  // Add PDC form state
  const [formState, setFormState] = useState({
    chequeNo: "",
    chequeDate: "",
    partyId: "",
    bankName: "",
    bankBranch: "",
    amount: 0,
    bankAccountId: "",
    voucherId: "",
    holdingAccountId: "",
    narration: "",
  });

  // Auto-update PDC statuses on mount
  useEffect(() => {
    const updatePDCStatuses = async () => {
      const today = new Date().toISOString().split("T")[0];
      const now = new Date();

      for (const pdc of pdCheques) {
        const chequeDate = new Date(pdc.chequeDate);
        const timeDiff = chequeDate.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        let newStatus = null;

        if (daysDiff < 0 && (pdc.status === "pending" || pdc.status === "due")) {
          newStatus = "overdue";
        } else if (daysDiff === 0 && pdc.status === "pending") {
          newStatus = "due";
        } else if (daysDiff > 0 && pdc.status === "due") {
          newStatus = "pending"; // If date passed and was due, go back to pending
        }

        if (newStatus) {
          await updatePDCheque(pdc.id, { status: newStatus });
        }
      }
    };

    updatePDCStatuses();
  }, []);

  // Apply filters
  const filteredPDCs = useMemo(() => {
    return pdCheques.filter((pdc) => {
      const matchesType = filters.types.length === 0 || filters.types.includes(pdc.type);
      const matchesParty = !filters.partyId || pdc.partyId === filters.partyId;
      const matchesBank =
        !filters.bankName || pdc.bankName.toLowerCase().includes(filters.bankName.toLowerCase());
      const matchesDateFrom = !filters.dateFrom || pdc.chequeDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || pdc.chequeDate <= filters.dateTo;
      const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(pdc.status);

      return (
        matchesType &&
        matchesParty &&
        matchesBank &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesStatus
      );
    });
  }, [pdCheques, filters]);

  // Separate into received and issued
  const receivedPDCs = useMemo(
    () => filteredPDCs.filter((p) => p.type === "received"),
    [filteredPDCs],
  );
  const issuedPDCs = useMemo(() => filteredPDCs.filter((p) => p.type === "issued"), [filteredPDCs]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalReceived = receivedPDCs.reduce((sum, p) => sum + p.amount, 0);
    const totalIssued = issuedPDCs.reduce((sum, p) => sum + p.amount, 0);

    const today = new Date();
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);

    const dueThisWeek = pdCheques.filter((p) => {
      const chequeDate = new Date(p.chequeDate);
      return (
        chequeDate >= today &&
        chequeDate <= thisWeekEnd &&
        (p.status === "pending" || p.status === "due")
      );
    });

    const overdue = pdCheques.filter((p) => {
      const chequeDate = new Date(p.chequeDate);
      return chequeDate < today && p.status === "overdue";
    });

    return {
      received: { count: receivedPDCs.length, amount: totalReceived },
      issued: { count: issuedPDCs.length, amount: totalIssued },
      dueThisWeek: {
        count: dueThisWeek.length,
        amount: dueThisWeek.reduce((sum, p) => sum + p.amount, 0),
      },
      overdue: {
        count: overdue.length,
        amount: overdue.reduce((sum, p) => sum + p.amount, 0),
      },
    };
  }, [receivedPDCs, issuedPDCs, pdCheques]);

  // Group PDCs by maturity bucket
  const bucketGroups = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(today);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const nextMonthEnd = new Date(today);
    nextMonthEnd.setMonth(nextMonthEnd.getMonth() + 2);

    const groups = {
      dueToday: [] as any[],
      dueThisWeek: [] as any[],
      dueThisMonth: [] as any[],
      dueNextMonth: [] as any[],
      beyondNextMonth: [] as any[],
    };

    const currentPDCs = activeTab === "received" ? receivedPDCs : issuedPDCs;

    currentPDCs.forEach((pdc) => {
      const chequeDate = new Date(pdc.chequeDate);
      const timeDiff = chequeDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      if (daysDiff === 0) {
        groups.dueToday.push(pdc);
      } else if (daysDiff > 0 && daysDiff <= 7) {
        groups.dueThisWeek.push(pdc);
      } else if (daysDiff > 7 && chequeDate <= monthEnd) {
        groups.dueThisMonth.push(pdc);
      } else if (chequeDate > monthEnd && chequeDate <= nextMonthEnd) {
        groups.dueNextMonth.push(pdc);
      } else {
        groups.beyondNextMonth.push(pdc);
      }
    });

    return groups;
  }, [activeTab, receivedPDCs, issuedPDCs]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "info";
      case "due":
        return "warning";
      case "overdue":
        return "danger";
      case "presented":
        return "secondary";
      case "cleared":
        return "success";
      case "bounced":
        return "destructive";
      case "cancelled":
        return "outline";
      default:
        return "default";
    }
  };

  const getDaysUntilMaturity = (chequeDate: string) => {
    const today = new Date();
    const cheque = new Date(chequeDate);
    const timeDiff = cheque.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff > 0) {
      return { days: daysDiff, label: `In ${daysDiff} days`, color: "text-green-600" };
    } else if (daysDiff === 0) {
      return { days: 0, label: "Due Today", color: "text-orange-600" };
    } else {
      return {
        days: Math.abs(daysDiff),
        label: `Overdue by ${Math.abs(daysDiff)} days`,
        color: "text-red-600",
      };
    }
  };

  const handleAddPDC = () => {
    setFormState({
      chequeNo: "",
      chequeDate: "",
      partyId: "",
      bankName: "",
      bankBranch: "",
      amount: 0,
      bankAccountId: "",
      voucherId: "",
      holdingAccountId: "",
      narration: "",
    });
    setAddModalOpen(true);
  };

  const handleSavePDC = async () => {
    try {
      const party = parties.find((p) => p.id === formState.partyId);
      if (!party) {
        toast.error("Invalid party selected");
        return;
      }

      const newPDC = {
        type: modalType,
        chequeNo: formState.chequeNo,
        chequeDate: formState.chequeDate,
        chequeDateNepali: formatADToBS(formState.chequeDate),
        partyId: formState.partyId,
        partyName: party.name,
        bankName: formState.bankName,
        bankBranch: formState.bankBranch,
        amount: formState.amount,
        bankAccountId: formState.bankAccountId,
        voucherId: formState.voucherId || undefined,
        voucherNo: vouchers.find((v) => v.id === formState.voucherId)?.voucherNo || undefined,
        holdingAccountId: formState.holdingAccountId || undefined,
        status: "pending",
        narration: formState.narration,
        createdAt: new Date().toISOString(),
      };

      await savePDCheque(newPDC);
      toast.success("PDC saved successfully");
      setAddModalOpen(false);
    } catch (error) {
      toast.error("Failed to save PDC");
    }
  };

  const handleConvertPDC = async () => {
    if (!convertingPDC) return;

    try {
      const today = new Date().toISOString().split("T")[0];

      const journalData = {
        type: "journal",
        date: today,
        dateNepali: formatADToBS(today),
        narration: `PDC Conversion - Cheque No ${convertingPDC.chequeNo} - ${convertingPDC.partyName}`,
        lines: [
          {
            id: generateId(),
            accountId: convertingPDC.bankAccountId,
            accountName: accounts.find((a) => a.id === convertingPDC.bankAccountId)?.name || "",
            drAmount: convertingPDC.amount,
            crAmount: 0,
            particulars: "",
          },
          {
            id: generateId(),
            accountId: convertingPDC.holdingAccountId || "",
            accountName: accounts.find((a) => a.id === convertingPDC.holdingAccountId)?.name || "",
            drAmount: 0,
            crAmount: convertingPDC.amount,
            particulars: "",
          },
        ],
        status: "posted",
        grandTotal: convertingPDC.amount,
        totalCredit: convertingPDC.amount,
        totalDebit: convertingPDC.amount,
        voucherNo: `JV-PDC-${convertingPDC.chequeNo}`,
      };

      await convertPDCToBank(convertingPDC.id, journalData);
      toast.success("PDC converted to bank entry successfully");
      setConvertModalOpen(false);
      setConvertingPDC(null);
    } catch (error) {
      toast.error("Failed to convert PDC");
    }
  };

  const handleFilterChange = (field: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const exportToCSV = () => {
    const currentPDCs = activeTab === "received" ? receivedPDCs : issuedPDCs;

    const headers = [
      "Cheque No",
      "Cheque Date",
      "Party Name",
      "Bank",
      "Branch",
      "Amount",
      "Status",
      "Days Until Maturity",
    ];

    const rows = currentPDCs.map((pdc) => {
      const maturity = getDaysUntilMaturity(pdc.chequeDate);
      return [
        pdc.chequeNo,
        pdc.chequeDate,
        pdc.partyName,
        pdc.bankName,
        pdc.bankBranch,
        pdc.amount,
        pdc.status,
        maturity.label,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `pdc-summary-${activeTab}-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.group === "Bank Accounts" || a.group === "Bank OD Accounts");
  }, [accounts]);

  const pdcHoldingAccounts = useMemo(() => {
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes("pdc") ||
        a.group === "Current Assets" ||
        a.group === "Current Liabilities",
    );
  }, [accounts]);

  return (
    <div className="flex flex-col h-full">
      <ActionToolbar title="Post-dated cheques" icon={<CalendarClock size={16} />}>
        <Button
          size="sm"
          onClick={() => {
            setModalType("received");
            handleAddPDC();
          }}
        >
          <Plus size={14} className="mr-1" />
          Add PDC Received
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setModalType("issued");
            handleAddPDC();
          }}
        >
          <Plus size={14} className="mr-1" />
          Add PDC Issued
        </Button>
        <Button size="sm" variant="outline" onClick={() => setBucketView(!bucketView)}>
          <Calendar size={14} className="mr-1" />
          {bucketView ? "List View" : "Bucket View"}
        </Button>
        <Button size="sm" variant="outline" onClick={exportToCSV}>
          Export CSV
        </Button>
      </ActionToolbar>

      <div className="flex-1 overflow-auto p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div
            className="bg-white p-4 border rounded-lg shadow-sm cursor-pointer hover:bg-gray-50"
            onClick={() => handleFilterChange("types", ["received"])}
          >
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-blue-100 mr-3">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">PDCs Received</p>
                <p className="text-2xl font-bold">{summaryStats.received.count}</p>
                <p className="text-sm text-gray-600">
                  {formatNumber(summaryStats.received.amount)}
                </p>
              </div>
            </div>
          </div>

          <div
            className="bg-white p-4 border rounded-lg shadow-sm cursor-pointer hover:bg-gray-50"
            onClick={() => handleFilterChange("types", ["issued"])}
          >
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-red-100 mr-3">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">PDCs Issued</p>
                <p className="text-2xl font-bold">{summaryStats.issued.count}</p>
                <p className="text-sm text-gray-600">{formatNumber(summaryStats.issued.amount)}</p>
              </div>
            </div>
          </div>

          <div
            className="bg-white p-4 border rounded-lg shadow-sm cursor-pointer hover:bg-gray-50"
            onClick={() => {
              handleFilterChange("statuses", ["due"]);
              handleFilterChange("types", []);
            }}
          >
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-orange-100 mr-3">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Due This Week</p>
                <p className="text-2xl font-bold">{summaryStats.dueThisWeek.count}</p>
                <p className="text-sm text-gray-600">
                  {formatNumber(summaryStats.dueThisWeek.amount)}
                </p>
              </div>
            </div>
          </div>

          <div
            className="bg-white p-4 border rounded-lg shadow-sm cursor-pointer hover:bg-gray-50"
            onClick={() => {
              handleFilterChange("statuses", ["overdue"]);
              handleFilterChange("types", []);
            }}
          >
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-red-100 mr-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <p className="text-2xl font-bold">{summaryStats.overdue.count}</p>
                <p className="text-sm text-gray-600">{formatNumber(summaryStats.overdue.amount)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("received")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "received"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              PDCs Received (Receivable)
            </button>
            <button
              onClick={() => setActiveTab("issued")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "issued"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              PDCs Issued (Payable)
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select
            label="Party"
            options={[
              { value: "", label: "All Parties" },
              ...parties.map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={filters.partyId}
            onChange={(val) => handleFilterChange("partyId", val)}
          />

          <input
            type="text"
            placeholder="Bank Name"
            value={filters.bankName}
            onChange={(e) => handleFilterChange("bankName", e.target.value)}
            className="p-2 border rounded text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <NepaliDatePicker
              label="From"
              value={filters.dateFrom}
              onChange={(val) => handleFilterChange("dateFrom", val)}
            />
            <NepaliDatePicker
              label="To"
              value={filters.dateTo}
              onChange={(val) => handleFilterChange("dateTo", val)}
            />
          </div>

          <Select
            label="Status"
            options={[
              { value: "pending", label: "Pending" },
              { value: "due", label: "Due Today" },
              { value: "overdue", label: "Overdue" },
              { value: "presented", label: "Presented" },
              { value: "cleared", label: "Cleared" },
              { value: "bounced", label: "Bounced" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            value={filters.statuses}
            onChange={(val) => handleFilterChange("statuses", val)}
            multiple
          />
        </div>

        {/* Bucket View */}
        {bucketView ? (
          <div className="space-y-6">
            {Object.entries(bucketGroups).map(([bucket, pdcList]) => {
              if (pdcList.length === 0) return null;

              const bucketName =
                bucket === "dueToday"
                  ? "Due Today"
                  : bucket === "dueThisWeek"
                    ? "Due This Week"
                    : bucket === "dueThisMonth"
                      ? "Due This Month"
                      : bucket === "dueNextMonth"
                        ? "Due Next Month"
                        : "Beyond Next Month";

              const totalAmount = pdcList.reduce((sum, p) => sum + p.amount, 0);

              return (
                <div key={bucket} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                    <h3 className="font-medium">
                      {bucketName} ({pdcList.length})
                    </h3>
                    <span className="text-sm font-medium">{formatNumber(totalAmount)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 text-left">Cheque No</th>
                          <th className="p-3 text-left">Cheque Date</th>
                          <th className="p-3 text-left">Party Name</th>
                          <th className="p-3 text-left">Bank</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-left">Status</th>
                          <th className="p-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdcList.map((pdc) => {
                          const maturity = getDaysUntilMaturity(pdc.chequeDate);

                          return (
                            <tr key={pdc.id} className="border-t hover:bg-gray-50">
                              <td className="p-3">{pdc.chequeNo}</td>
                              <td className="p-3">{pdc.chequeDate}</td>
                              <td className="p-3">{pdc.partyName}</td>
                              <td className="p-3">{pdc.bankName}</td>
                              <td className="p-3 text-right">{formatNumber(pdc.amount)}</td>
                              <td className="p-3">
                                <Badge
                                  variant={getStatusVariant(pdc.status)}
                                  className={pdc.status === "due" ? "animate-pulse" : ""}
                                >
                                  {pdc.status.charAt(0).toUpperCase() + pdc.status.slice(1)}
                                </Badge>
                              </td>
                              <td className="p-3">
                                {activeTab === "received" &&
                                  (pdc.status === "due" || pdc.status === "overdue") && (
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => {
                                        setConvertingPDC(pdc);
                                        setConvertModalOpen(true);
                                      }}
                                    >
                                      Convert
                                    </Button>
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Cheque No</th>
                  <th className="p-3 text-left">Cheque Date</th>
                  <th className="p-3 text-left">Party Name</th>
                  <th className="p-3 text-left">Bank</th>
                  <th className="p-3 text-left">Branch</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-left">Days Until Maturity</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === "received" && receivedPDCs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-gray-500">
                      No PDCs received found
                    </td>
                  </tr>
                )}

                {activeTab === "issued" && issuedPDCs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-gray-500">
                      No PDCs issued found
                    </td>
                  </tr>
                )}

                {(activeTab === "received" ? receivedPDCs : issuedPDCs).map((pdc) => {
                  const maturity = getDaysUntilMaturity(pdc.chequeDate);

                  return (
                    <tr key={pdc.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">{pdc.chequeNo}</td>
                      <td className="p-3">{pdc.chequeDate}</td>
                      <td className="p-3">{pdc.partyName}</td>
                      <td className="p-3">{pdc.bankName}</td>
                      <td className="p-3">{pdc.bankBranch}</td>
                      <td className="p-3 text-right">{formatNumber(pdc.amount)}</td>
                      <td className={`p-3 ${maturity.color}`}>{maturity.label}</td>
                      <td className="p-3">
                        <Badge
                          variant={getStatusVariant(pdc.status)}
                          className={pdc.status === "due" ? "animate-pulse" : ""}
                        >
                          {pdc.status.charAt(0).toUpperCase() + pdc.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {activeTab === "received" &&
                          (pdc.status === "due" || pdc.status === "overdue") && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                setConvertingPDC(pdc);
                                setConvertModalOpen(true);
                              }}
                            >
                              Convert
                            </Button>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add PDC Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[var(--ds-z-dropdown)]">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">
                Add PDC {modalType === "received" ? "Received" : "Issued"}
              </h3>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <input
                  type="text"
                  value={modalType === "received" ? "Received" : "Issued"}
                  readOnly
                  className="w-full p-2 border rounded text-sm bg-gray-100"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Cheque No"
                  value={formState.chequeNo}
                  onChange={(e) => setFormState((prev) => ({ ...prev, chequeNo: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <NepaliDatePicker
                  label="Cheque Date"
                  value={formState.chequeDate}
                  onChange={(val) => setFormState((prev) => ({ ...prev, chequeDate: val }))}
                />
              </div>

              <div>
                <Select
                  label="Party"
                  options={parties.map((p) => ({ value: p.id, label: p.name }))}
                  value={formState.partyId}
                  onChange={(val) => setFormState((prev) => ({ ...prev, partyId: val }))}
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Bank Name"
                  value={formState.bankName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, bankName: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Bank Branch"
                  value={formState.bankBranch}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, bankBranch: e.target.value }))
                  }
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <input
                  type="number"
                  placeholder="Amount"
                  value={formState.amount || ""}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, amount: Number(e.target.value) }))
                  }
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <Select
                  label="Our Bank Account"
                  options={bankAccounts.map((acc) => ({ value: acc.id, label: acc.name }))}
                  value={formState.bankAccountId}
                  onChange={(val) => setFormState((prev) => ({ ...prev, bankAccountId: val }))}
                />
              </div>

              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Associated Voucher No (Optional)"
                  value={formState.voucherId}
                  onChange={(e) => setFormState((prev) => ({ ...prev, voucherId: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                />
              </div>

              <div>
                <Select
                  label="Holding Account"
                  options={pdcHoldingAccounts.map((acc) => ({ value: acc.id, label: acc.name }))}
                  value={formState.holdingAccountId}
                  onChange={(val) => setFormState((prev) => ({ ...prev, holdingAccountId: val }))}
                />
              </div>

              <div className="md:col-span-2">
                <textarea
                  placeholder="Narration"
                  value={formState.narration}
                  onChange={(e) => setFormState((prev) => ({ ...prev, narration: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePDC}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Convert PDC Modal */}
      {convertModalOpen && convertingPDC && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[var(--ds-z-dropdown)]">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">Convert PDC to Bank Entry</h3>
            </div>

            <div className="p-4">
              <p className="mb-4">
                Convert cheque <strong>#{convertingPDC.chequeNo}</strong> from{" "}
                <strong>{convertingPDC.partyName}</strong> to bank entry?
              </p>

              <p className="text-sm text-gray-600">
                This will create a journal entry moving the amount from the PDC holding account to
                the bank account.
              </p>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConvertModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConvertPDC}>Confirm Conversion</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
