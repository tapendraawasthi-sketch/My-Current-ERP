// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { Clock, Mail, Calendar, Plus, Edit2, Trash2, Play, CheckCircle, Send } from "lucide-react";

const BORDER = "1px solid #000";
const BG = "#E4F1D9";
const BG_CARD = "#EBF5E2";
const BG_HEADER = "#D4EABD";
const BG_DEEP = "#C9DEB5";

function calculateNextRunDate(frequency, dayOfWeek, dayOfMonth, runTime) {
  const now = new Date();
  const [hours, minutes] = runTime.split(":").map(Number);
  now.setHours(hours, minutes, 0, 0);

  if (frequency === "daily") {
    now.setDate(now.getDate() + 1);
  } else if (frequency === "weekly") {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDay = days.indexOf(dayOfWeek);
    const currentDay = now.getDay();
    const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
    now.setDate(now.getDate() + daysUntil);
  } else if (frequency === "monthly") {
    now.setMonth(now.getMonth() + 1);
    now.setDate(Math.min(Number(dayOfMonth) || 1, 28));
  }

  return now.toISOString().split("T")[0];
}

export default function ReportScheduler() {
  const { items, stockMovements, invoices, vouchers, companySettings } = useStore();
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState({
    name: "",
    reportType: "",
    reportFilters: { dateRange: "Current Month", partyFilter: "ALL", limitN: "ALL" },
    frequency: "daily",
    dayOfWeek: "Monday",
    dayOfMonth: "1",
    runTime: "07:00",
    recipients: "",
    fileFormat: "excel",
    subjectLine: "",
    emailBodyNote: "",
    isActive: true,
  });

  // Load schedules from DB
  useEffect(() => {
    const db = getDB();
    db.reportSchedules
      .toArray()
      .catch(() => [])
      .then(setSchedules);
  }, []);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setEditingSchedule((prev) => ({ ...prev, [field]: value }));
  };

  // Handle report filters changes
  const handleFilterChange = (filterField, value) => {
    setEditingSchedule((prev) => ({
      ...prev,
      reportFilters: { ...prev.reportFilters, [filterField]: value },
    }));
  };

  // Handle recipients change
  const handleRecipientsChange = (e) => {
    handleInputChange("recipients", e.target.value);
  };

  // Handle save schedule
  const handleSaveSchedule = async () => {
    if (!editingSchedule.name.trim()) {
      toast.error("Schedule name is required");
      return;
    }
    if (!editingSchedule.reportType) {
      toast.error("Report type is required");
      return;
    }
    if (!editingSchedule.recipients.trim()) {
      toast.error("At least one recipient is required");
      return;
    }

    try {
      const db = getDB();
      const recipients = editingSchedule.recipients
        .split("\n")
        .map((email) => email.trim())
        .filter(Boolean);

      const nextRunDate = calculateNextRunDate(
        editingSchedule.frequency,
        editingSchedule.dayOfWeek,
        editingSchedule.dayOfMonth,
        editingSchedule.runTime,
      );

      const scheduleData = {
        id: selectedSchedule?.id || generateId(),
        name: editingSchedule.name,
        reportType: editingSchedule.reportType,
        reportFilters: editingSchedule.reportFilters,
        frequency: editingSchedule.frequency,
        dayOfWeek: editingSchedule.dayOfWeek,
        dayOfMonth: editingSchedule.dayOfMonth,
        runTime: editingSchedule.runTime,
        recipients,
        fileFormat: editingSchedule.fileFormat,
        subjectLine:
          editingSchedule.subjectLine ||
          `[${companySettings?.name || "Company"}] ${editingSchedule.reportType} - ${editingSchedule.reportFilters.dateRange}`,
        emailBodyNote: editingSchedule.emailBodyNote,
        isActive: editingSchedule.isActive,
        nextRunDate,
        lastRunDate: null,
        lastRunStatus: null,
        createdAt: new Date().toISOString(),
      };

      await db.reportSchedules.put(scheduleData);
      toast.success("Schedule saved successfully");

      // Refresh schedules
      const updated = await db.reportSchedules.toArray();
      setSchedules(updated);
      setSelectedSchedule(scheduleData);
      setEditingSchedule({
        name: "",
        reportType: "",
        reportFilters: { dateRange: "Current Month", partyFilter: "ALL", limitN: "ALL" },
        frequency: "daily",
        dayOfWeek: "Monday",
        dayOfMonth: "1",
        runTime: "07:00",
        recipients: "",
        fileFormat: "excel",
        subjectLine: "",
        emailBodyNote: "",
        isActive: true,
      });
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Failed to save schedule");
    }
  };

  // Handle test send
  const handleTestSend = () => {
    const recipients = editingSchedule.recipients
      .split("\n")
      .map((email) => email.trim())
      .filter(Boolean);

    toast.success(
      `Test email would be sent to ${recipients.length} recipients. (Email sending requires backend SMTP configuration.)`,
    );
  };

  // Handle run now
  const handleRunNow = () => {
    // Simulate report generation based on report type
    let data = [];
    let fileName = "";

    switch (editingSchedule.reportType) {
      case "Daily Cashbook Summary":
        // Simulate vouchers for today
        const today = new Date().toISOString().split("T")[0];
        data = vouchers
          .filter((v) => v.date === today)
          .map((v) => ({
            VoucherNo: v.voucherNo,
            Date: v.date,
            Type: v.type,
            Party: v.partyName || "N/A",
            Amount: v.grandTotal,
          }));
        fileName = `Daily_Cashbook_${today}.xlsx`;
        break;

      case "Stock Summary":
        // Aggregate stock by item
        const stockSummary = {};
        stockMovements.forEach((m) => {
          const existing = stockSummary[m.itemId] || { qty: 0, value: 0 };
          const qty = Number(m.quantity || m.qty || 0);
          const rate = Number(m.rate || m.costRate || 0);
          const type = m.type || m.movementType || "";

          if (type.toLowerCase().includes("in") || type.toLowerCase().includes("purchase")) {
            existing.qty += qty;
            existing.value += qty * rate;
          } else {
            existing.qty -= qty;
            existing.value -= qty * rate;
          }

          stockSummary[m.itemId] = existing;
        });

        data = Object.entries(stockSummary).map(([itemId, summary]) => {
          const item = items.find((i) => i.id === itemId);
          return {
            Item: item?.name || "N/A",
            Quantity: summary.qty,
            Value: summary.value,
            AvgRate: summary.qty !== 0 ? summary.value / summary.qty : 0,
          };
        });
        fileName = `Stock_Summary_${new Date().toISOString().split("T")[0]}.xlsx`;
        break;

      case "Monthly Sales Register":
        // Filter sales invoices for current month
        const currentMonth = new Date().toISOString().split("T")[0].substring(0, 7);
        data = invoices
          .filter((inv) => inv.type.includes("sales") && inv.date.startsWith(currentMonth))
          .map((inv) => ({
            InvoiceNo: inv.invoiceNo,
            Date: inv.date,
            Party: inv.partyName,
            Amount: inv.grandTotal,
            Tax: inv.vatAmount,
          }));
        fileName = `Monthly_Sales_Register_${currentMonth}.xlsx`;
        break;

      default:
        // Generic report
        data = [{ Message: "Report generated successfully", Type: editingSchedule.reportType }];
        fileName = `Report_${new Date().toISOString().split("T")[0]}.xlsx`;
    }

    // Create Excel file
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, fileName);

    toast.success("Report downloaded successfully");
  };

  // Handle delete schedule
  const handleDeleteSchedule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this schedule?")) return;

    try {
      const db = getDB();
      await db.reportSchedules.delete(id);
      toast.success("Schedule deleted successfully");

      // Refresh schedules
      const updated = await db.reportSchedules.toArray();
      setSchedules(updated);
      if (selectedSchedule?.id === id) {
        setSelectedSchedule(null);
        setEditingSchedule({
          name: "",
          reportType: "",
          reportFilters: { dateRange: "Current Month", partyFilter: "ALL", limitN: "ALL" },
          frequency: "daily",
          dayOfWeek: "Monday",
          dayOfMonth: "1",
          runTime: "07:00",
          recipients: "",
          fileFormat: "excel",
          subjectLine: "",
          emailBodyNote: "",
          isActive: true,
        });
      }
    } catch (error) {
      console.error("Error deleting schedule:", error);
      toast.error("Failed to delete schedule");
    }
  };

  // Handle edit schedule
  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setEditingSchedule({
      name: schedule.name,
      reportType: schedule.reportType,
      reportFilters: schedule.reportFilters,
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
      runTime: schedule.runTime,
      recipients: schedule.recipients.join("\n"),
      fileFormat: schedule.fileFormat,
      subjectLine: schedule.subjectLine,
      emailBodyNote: schedule.emailBodyNote,
      isActive: schedule.isActive,
    });
  };

  // Handle radio button change
  const handleRadioChange = (group, value) => {
    handleInputChange(group, value);
  };

  return (
    <div
      style={{
        backgroundColor: BG,
        minHeight: "100vh",
        padding: "20px",
        display: "flex",
        gap: "20px",
      }}
    >
      {/* Left Column - Schedule List */}
      <div
        style={{
          width: "260px",
          backgroundColor: BG_CARD,
          border: BORDER,
          padding: "15px",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            backgroundColor: BG_HEADER,
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "15px",
          }}
        >
          <h2
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              color: "#000000",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Calendar size={16} />
            Report Schedules
          </h2>
        </div>

        <button
          onClick={() => {
            setSelectedSchedule(null);
            setEditingSchedule({
              name: "",
              reportType: "",
              reportFilters: { dateRange: "Current Month", partyFilter: "ALL", limitN: "ALL" },
              frequency: "daily",
              dayOfWeek: "Monday",
              dayOfMonth: "1",
              runTime: "07:00",
              recipients: "",
              fileFormat: "excel",
              subjectLine: "",
              emailBodyNote: "",
              isActive: true,
            });
          }}
          style={{
            backgroundColor: "#1557b0",
            color: "white",
            border: BORDER,
            padding: "8px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
            marginBottom: "15px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Plus size={14} />
          New Schedule
        </button>

        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              onClick={() => handleEditSchedule(schedule)}
              style={{
                padding: "10px",
                border: BORDER,
                borderRadius: "4px",
                marginBottom: "5px",
                cursor: "pointer",
                backgroundColor: selectedSchedule?.id === schedule.id ? BG_HEADER : "transparent",
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "3px" }}>
                {schedule.name}
              </div>
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "3px" }}>
                <span
                  style={{
                    backgroundColor:
                      schedule.frequency === "daily"
                        ? "#059669"
                        : schedule.frequency === "weekly"
                          ? "#d97706"
                          : "#dc2626",
                    color: "white",
                    padding: "1px 4px",
                    borderRadius: "10px",
                    fontSize: "9px",
                    marginRight: "5px",
                  }}
                >
                  {schedule.frequency.toUpperCase()}
                </span>
                {schedule.reportType}
              </div>
              <div style={{ fontSize: "10px", color: "#888" }}>
                Recipients: {schedule.recipients.length}
              </div>
              <div style={{ fontSize: "10px", color: "#888" }}>Next: {schedule.nextRunDate}</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "5px",
                }}
              >
                <span
                  style={{
                    backgroundColor: schedule.isActive ? "#059669" : "#d97706",
                    color: "white",
                    padding: "1px 4px",
                    borderRadius: "10px",
                    fontSize: "9px",
                  }}
                >
                  {schedule.isActive ? "ACTIVE" : "PAUSED"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center Column - Schedule Form */}
      <div
        style={{
          flex: 1,
          backgroundColor: BG_CARD,
          border: BORDER,
          padding: "20px",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            backgroundColor: BG_HEADER,
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#000000", margin: 0 }}>
            {selectedSchedule ? "Edit Schedule" : "New Schedule Configuration"}
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Schedule Name*
            </label>
            <input
              type="text"
              value={editingSchedule.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Report Type*
            </label>
            <select
              value={editingSchedule.reportType}
              onChange={(e) => handleInputChange("reportType", e.target.value)}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <option value="">Select Report Type</option>
              <option value="Daily Cashbook Summary">Daily Cashbook Summary</option>
              <option value="Weekly Outstanding Receivables">Weekly Outstanding Receivables</option>
              <option value="Monthly Sales Register">Monthly Sales Register</option>
              <option value="Monthly Purchase Register">Monthly Purchase Register</option>
              <option value="Monthly P&L Statement">Monthly P&L Statement</option>
              <option value="Debtors Aging Report">Debtors Aging Report</option>
              <option value="Stock Summary">Stock Summary</option>
              <option value="TDS Status Report">TDS Status Report</option>
              <option value="Payroll Summary">Payroll Summary</option>
              <option value="VAT Summary">VAT Summary</option>
              <option value="Custom Report (URL)">Custom Report (URL)</option>
            </select>
          </div>
        </div>

        {/* Report Filters */}
        {(editingSchedule.reportType.includes("Outstanding") ||
          editingSchedule.reportType.includes("Aging")) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Party Filter
              </label>
              <select
                value={editingSchedule.reportFilters.partyFilter}
                onChange={(e) => handleFilterChange("partyFilter", e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px",
                  border: BORDER,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <option value="ALL">All Parties</option>
                {/* Add parties here */}
              </select>
            </div>
          </div>
        )}

        {(editingSchedule.reportType.includes("Stock") ||
          editingSchedule.reportType.includes("Sales")) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Limit to Top N Items
              </label>
              <select
                value={editingSchedule.reportFilters.limitN}
                onChange={(e) => handleFilterChange("limitN", e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px",
                  border: BORDER,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <option value="ALL">All</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Date Range
            </label>
            <select
              value={editingSchedule.reportFilters.dateRange}
              onChange={(e) => handleFilterChange("dateRange", e.target.value)}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <option value="Current Month">Current Month</option>
              <option value="Current Week">Current Week</option>
              <option value="Last Month">Last Month</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Time to Run
            </label>
            <input
              type="time"
              value={editingSchedule.runTime}
              onChange={(e) => handleInputChange("runTime", e.target.value)}
              style={{
                width: "100%",
                padding: "6px",
                border: BORDER,
                borderRadius: "4px",
                fontSize: "12px",
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Frequency*
          </label>
          <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center" }}>
              <input
                type="radio"
                name="frequency"
                checked={editingSchedule.frequency === "daily"}
                onChange={() => handleRadioChange("frequency", "daily")}
                style={{ marginRight: "5px" }}
              />
              Daily
            </label>
            <label style={{ display: "flex", alignItems: "center" }}>
              <input
                type="radio"
                name="frequency"
                checked={editingSchedule.frequency === "weekly"}
                onChange={() => handleRadioChange("frequency", "weekly")}
                style={{ marginRight: "5px" }}
              />
              Weekly
            </label>
            <label style={{ display: "flex", alignItems: "center" }}>
              <input
                type="radio"
                name="frequency"
                checked={editingSchedule.frequency === "monthly"}
                onChange={() => handleRadioChange("frequency", "monthly")}
                style={{ marginRight: "5px" }}
              />
              Monthly
            </label>
          </div>

          {editingSchedule.frequency === "weekly" && (
            <div style={{ marginTop: "10px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Day of Week
              </label>
              <select
                value={editingSchedule.dayOfWeek}
                onChange={(e) => handleInputChange("dayOfWeek", e.target.value)}
                style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
              >
                <option value="Sunday">Sunday</option>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
              </select>
            </div>
          )}

          {editingSchedule.frequency === "monthly" && (
            <div style={{ marginTop: "10px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Day of Month
              </label>
              <select
                value={editingSchedule.dayOfMonth}
                onChange={(e) => handleInputChange("dayOfMonth", e.target.value)}
                style={{ padding: "6px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
              >
                {[...Array(28)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
                <option value="29">29</option>
                <option value="30">30</option>
                <option value="31">31</option>
                <option value="last">Last Day</option>
              </select>
            </div>
          )}
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Recipients* (One email per line)
          </label>
          <textarea
            value={editingSchedule.recipients}
            onChange={handleRecipientsChange}
            rows={3}
            style={{
              width: "100%",
              padding: "6px",
              border: BORDER,
              borderRadius: "4px",
              fontSize: "12px",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              File Format
            </label>
            <div style={{ display: "flex", gap: "15px" }}>
              <label style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="radio"
                  name="fileFormat"
                  checked={editingSchedule.fileFormat === "pdf"}
                  onChange={() => handleRadioChange("fileFormat", "pdf")}
                  style={{ marginRight: "5px" }}
                />
                PDF
              </label>
              <label style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="radio"
                  name="fileFormat"
                  checked={editingSchedule.fileFormat === "excel"}
                  onChange={() => handleRadioChange("fileFormat", "excel")}
                  style={{ marginRight: "5px" }}
                />
                Excel
              </label>
              <label style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="radio"
                  name="fileFormat"
                  checked={editingSchedule.fileFormat === "both"}
                  onChange={() => handleRadioChange("fileFormat", "both")}
                  style={{ marginRight: "5px" }}
                />
                Both
              </label>
            </div>
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Is Active
            </label>
            <input
              type="checkbox"
              checked={editingSchedule.isActive}
              onChange={(e) => handleInputChange("isActive", e.target.checked)}
              style={{ marginRight: "5px" }}
            />
            Active
          </div>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Subject Line
          </label>
          <input
            type="text"
            value={editingSchedule.subjectLine}
            onChange={(e) => handleInputChange("subjectLine", e.target.value)}
            style={{
              width: "100%",
              padding: "6px",
              border: BORDER,
              borderRadius: "4px",
              fontSize: "12px",
            }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "12px" }}
          >
            Email Body Note
          </label>
          <textarea
            value={editingSchedule.emailBodyNote}
            onChange={(e) => handleInputChange("emailBodyNote", e.target.value)}
            rows={2}
            style={{
              width: "100%",
              padding: "6px",
              border: BORDER,
              borderRadius: "4px",
              fontSize: "12px",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleSaveSchedule}
            style={{
              backgroundColor: "#1557b0",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Send size={14} />
            Save Schedule
          </button>
          <button
            onClick={handleTestSend}
            style={{
              backgroundColor: "#059669",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Mail size={14} />
            Test Send
          </button>
          <button
            onClick={handleRunNow}
            style={{
              backgroundColor: "#d97706",
              color: "white",
              border: BORDER,
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Play size={14} />
            Run Now
          </button>
        </div>
      </div>

      {/* Right Column - Delivery Log */}
      <div
        style={{
          width: "300px",
          backgroundColor: BG_CARD,
          border: BORDER,
          padding: "15px",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            backgroundColor: BG_HEADER,
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "15px",
          }}
        >
          <h2
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              color: "#000000",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Clock size={16} />
            Delivery History
          </h2>
        </div>

        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {selectedSchedule ? (
            <div>
              <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "10px" }}>
                {selectedSchedule.name}
              </div>

              {/* Mock delivery history */}
              <div
                style={{
                  marginBottom: "10px",
                  padding: "8px",
                  border: BORDER,
                  borderRadius: "4px",
                }}
              >
                <div style={{ fontSize: "11px", color: "#666" }}>2023-06-15</div>
                <div style={{ fontSize: "10px", color: "#888" }}>Format: Excel</div>
                <div style={{ fontSize: "10px", color: "#059669", fontWeight: "bold" }}>
                  Downloaded
                </div>
              </div>
              <div
                style={{
                  marginBottom: "10px",
                  padding: "8px",
                  border: BORDER,
                  borderRadius: "4px",
                }}
              >
                <div style={{ fontSize: "11px", color: "#666" }}>2023-06-08</div>
                <div style={{ fontSize: "10px", color: "#888" }}>Format: PDF</div>
                <div style={{ fontSize: "10px", color: "#059669", fontWeight: "bold" }}>
                  Downloaded
                </div>
              </div>
              <div
                style={{
                  marginBottom: "10px",
                  padding: "8px",
                  border: BORDER,
                  borderRadius: "4px",
                }}
              >
                <div style={{ fontSize: "11px", color: "#666" }}>2023-06-01</div>
                <div style={{ fontSize: "10px", color: "#888" }}>Format: Excel</div>
                <div style={{ fontSize: "10px", color: "#d97706", fontWeight: "bold" }}>
                  Pending
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#666", padding: "20px" }}>
              Select a schedule to view its delivery history
            </div>
          )}
        </div>
      </div>

      {/* Note at top */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#fef3c7",
          border: "1px solid #f59e0b",
          padding: "10px 15px",
          borderRadius: "6px",
          zIndex: 1000,
          width: "90%",
          maxWidth: "800px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            color: "#92400e",
          }}
        >
          <span>
            ℹ️ Note: Reports run locally and download to your device. For automatic scheduled email
            delivery, configure your SMTP server in System Settings and deploy the backend
            scheduler.
          </span>
        </div>
      </div>
    </div>
  );
}
