// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  Phone,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  User,
  Download,
  Search,
  Calendar,
  MessageSquare,
  Mail,
  MapPin,
  Home,
} from "lucide-react";
import { formatADToBS } from "../lib/nepaliDate";

const BORDER = "1px solid #000";
const BG = "#E4F1D9";
const BG_CARD = "#EBF5E2";
const BG_HEADER = "#D4EABD";
const BG_DEEP = "#C9DEB5";
const OVERDUE_BG = "#fee2e2";
const DUE_TODAY_BG = "#fef9c3";
const RESOLVED_BG = "#dcfce7";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

export default function FollowUpTracker() {
  const { parties, invoices, vouchers, companySettings, currentUser } = useStore();

  const [activeTab, setActiveTab] = useState("tasks");
  const [followUpNotes, setFollowUpNotes] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [addNoteForm, setAddNoteForm] = useState({
    contactMethod: "Phone Call",
    contactPerson: "",
    note: "",
    promisedAmount: "",
    promisedDate: "",
    followUpDate: "",
    priority: "Normal",
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Performance filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userFilter, setUserFilter] = useState("ALL");

  // Load follow-up notes
  useEffect(() => {
    const db = getDB();
    db.followUpNotes
      .toArray()
      .catch(() => [])
      .then(setFollowUpNotes);
  }, []);

  // Get today's date
  const today = new Date().toISOString().split("T")[0];

  // Compute today's tasks
  const todayTasks = useMemo(() => {
    const notes = followUpNotes.filter((note) => !note.isResolved);
    const overdue = notes.filter((note) => note.followUpDate < today);
    const dueToday = notes.filter((note) => note.followUpDate === today);
    const upcoming = notes.filter(
      (note) =>
        note.followUpDate > today &&
        new Date(note.followUpDate) <= new Date(new Date().setDate(new Date().getDate() + 7)),
    );

    return { overdue, dueToday, upcoming };
  }, [followUpNotes, today]);

  // Compute outstanding parties
  const outstandingParties = useMemo(() => {
    const partyOutstandings = {};

    invoices.forEach((inv) => {
      if (inv.paymentStatus === "unpaid" || inv.paymentStatus === "partial") {
        if (!partyOutstandings[inv.partyId]) {
          partyOutstandings[inv.partyId] = {
            totalOutstanding: 0,
            oldestDate: inv.date,
            invoiceCount: 0,
            lastFollowUpDate: null,
          };
        }

        partyOutstandings[inv.partyId].totalOutstanding += inv.grandTotal;
        partyOutstandings[inv.partyId].invoiceCount++;

        if (new Date(inv.date) < new Date(partyOutstandings[inv.partyId].oldestDate)) {
          partyOutstandings[inv.partyId].oldestDate = inv.date;
        }
      }
    });

    // Find last follow-up for each party
    followUpNotes.forEach((note) => {
      const existing = partyOutstandings[note.partyId];
      if (
        existing &&
        (!existing.lastFollowUpDate ||
          new Date(note.createdAt) > new Date(existing.lastFollowUpDate))
      ) {
        existing.lastFollowUpDate = note.createdAt;
      }
    });

    return Object.entries(partyOutstandings)
      .map(([partyId, data]) => {
        const party = parties.find((p) => p.id === partyId);
        return {
          party,
          ...data,
          daysSinceLastFollowUp: data.lastFollowUpDate
            ? Math.floor((new Date() - new Date(data.lastFollowUpDate)) / (1000 * 60 * 60 * 24))
            : "Never",
        };
      })
      .filter((p) => p.totalOutstanding > 0)
      .filter(
        (p) =>
          !searchTerm ||
          p.party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.party.code.toLowerCase().includes(searchTerm.toLowerCase()),
      );
  }, [parties, invoices, followUpNotes, searchTerm]);

  // Handle adding a follow-up note
  const handleAddNote = async () => {
    if (!selectedParty || !addNoteForm.note.trim()) {
      toast.error("Please select a party and enter a note");
      return;
    }

    if (!addNoteForm.followUpDate) {
      toast.error("Please set next follow-up date");
      return;
    }

    try {
      const db = getDB();
      const noteData = {
        id: generateId(),
        partyId: selectedParty.id,
        invoiceId: null, // Could be linked to specific invoice
        contactMethod: addNoteForm.contactMethod,
        contactPerson: addNoteForm.contactPerson,
        note: addNoteForm.note,
        promisedAmount: Number(addNoteForm.promisedAmount) || 0,
        promisedDate: addNoteForm.promisedDate || null,
        followUpDate: addNoteForm.followUpDate,
        priority: addNoteForm.priority,
        isResolved: false,
        createdBy: currentUser?.name || "System",
        createdAt: new Date().toISOString(),
      };

      await db.followUpNotes.put(noteData);
      toast.success("Follow-up note added successfully");

      // Refresh notes
      const updated = await db.followUpNotes.toArray();
      setFollowUpNotes(updated);

      // Reset form
      setAddNoteForm({
        contactMethod: "Phone Call",
        contactPerson: "",
        note: "",
        promisedAmount: "",
        promisedDate: "",
        followUpDate: "",
        priority: "Normal",
      });
    } catch (error) {
      console.error("Error adding follow-up note:", error);
      toast.error("Failed to add follow-up note");
    }
  };

  // Handle marking as resolved
  const handleMarkResolved = async (noteId) => {
    try {
      const db = getDB();
      await db.followUpNotes.update(noteId, {
        isResolved: true,
        resolvedAt: new Date().toISOString(),
      });
      toast.success("Follow-up marked as resolved");

      // Refresh notes
      const updated = await db.followUpNotes.toArray();
      setFollowUpNotes(updated);
    } catch (error) {
      console.error("Error resolving follow-up:", error);
      toast.error("Failed to resolve follow-up");
    }
  };

  // Handle follow-up done
  const handleFollowUpDone = async (noteId) => {
    // For now, just open the modal to add a new note
    const note = followUpNotes.find((n) => n.id === noteId);
    if (note) {
      setSelectedParty(parties.find((p) => p.id === note.partyId));
    }
  };

  // Render today's tasks
  const renderTodayTasks = () => (
    <div style={{ padding: "20px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}>
        Today's Follow-Up Tasks
      </h2>

      {/* Overdue Section */}
      {todayTasks.overdue.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              backgroundColor: "#dc2626",
              color: "white",
              padding: "10px",
              borderRadius: "4px",
              marginBottom: "10px",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <AlertTriangle size={16} />
              OVERDUE ({todayTasks.overdue.length})
            </h3>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "15px",
            }}
          >
            {todayTasks.overdue.map((note) => {
              const party = parties.find((p) => p.id === note.partyId);
              const invoice = invoices.find((i) => i.id === note.invoiceId);

              return (
                <div
                  key={note.id}
                  style={{
                    backgroundColor: OVERDUE_BG,
                    border: BORDER,
                    borderRadius: "8px",
                    padding: "15px",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                    {party?.name || "N/A"}
                  </div>
                  <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                    Invoice: {invoice?.invoiceNo || "N/A"} | Amount:{" "}
                    {money(invoice?.grandTotal || 0)}
                  </div>
                  <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                    <strong>Last Note:</strong> {note.note.substring(0, 50)}...
                  </div>
                  <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                    <strong>Follow-up Date:</strong> {formatADToBS(note.followUpDate)}
                  </div>
                  {note.promisedDate && (
                    <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                      <strong>Promised By:</strong> {formatADToBS(note.promisedDate)}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", marginBottom: "10px" }}>
                    <strong>Contact:</strong> {note.contactPerson || "N/A"} via {note.contactMethod}
                  </div>
                  <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => handleFollowUpDone(note.id)}
                      style={{
                        backgroundColor: "#1557b0",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Follow-up Done
                    </button>
                    <button
                      onClick={() => handleMarkResolved(note.id)}
                      style={{
                        backgroundColor: "#059669",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Due Today Section */}
      {todayTasks.dueToday.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              backgroundColor: "#d97706",
              color: "white",
              padding: "10px",
              borderRadius: "4px",
              marginBottom: "10px",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Clock size={16} />
              DUE TODAY ({todayTasks.dueToday.length})
            </h3>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "15px",
            }}
          >
            {todayTasks.dueToday.map((note) => {
              const party = parties.find((p) => p.id === note.partyId);
              const invoice = invoices.find((i) => i.id === note.invoiceId);

              return (
                <div
                  key={note.id}
                  style={{
                    backgroundColor: DUE_TODAY_BG,
                    border: BORDER,
                    borderRadius: "8px",
                    padding: "15px",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                    {party?.name || "N/A"}
                  </div>
                  <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                    Invoice: {invoice?.invoiceNo || "N/A"} | Amount:{" "}
                    {money(invoice?.grandTotal || 0)}
                  </div>
                  <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                    <strong>Last Note:</strong> {note.note.substring(0, 50)}...
                  </div>
                  <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                    <strong>Follow-up Date:</strong> {formatADToBS(note.followUpDate)}
                  </div>
                  {note.promisedDate && (
                    <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                      <strong>Promised By:</strong> {formatADToBS(note.promisedDate)}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", marginBottom: "10px" }}>
                    <strong>Contact:</strong> {note.contactPerson || "N/A"} via {note.contactMethod}
                  </div>
                  <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => handleFollowUpDone(note.id)}
                      style={{
                        backgroundColor: "#1557b0",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Follow-up Done
                    </button>
                    <button
                      onClick={() => handleMarkResolved(note.id)}
                      style={{
                        backgroundColor: "#059669",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Section */}
      {todayTasks.upcoming.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              backgroundColor: BG_HEADER,
              padding: "10px",
              borderRadius: "4px",
              marginBottom: "10px",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Calendar size={16} />
              UPCOMING ({todayTasks.upcoming.length})
            </h3>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "15px",
            }}
          >
            {todayTasks.upcoming.map((note) => {
              const party = parties.find((p) => p.id === note.partyId);
              const invoice = invoices.find((i) => i.id === note.invoiceId);

              return (
                <div
                  key={note.id}
                  style={{
                    backgroundColor: BG_CARD,
                    border: BORDER,
                    borderRadius: "8px",
                    padding: "15px",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                    {party?.name || "N/A"}
                  </div>
                  <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                    Invoice: {invoice?.invoiceNo || "N/A"} | Amount:{" "}
                    {money(invoice?.grandTotal || 0)}
                  </div>
                  <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                    <strong>Last Note:</strong> {note.note.substring(0, 50)}...
                  </div>
                  <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                    <strong>Follow-up Date:</strong> {formatADToBS(note.followUpDate)}
                  </div>
                  {note.promisedDate && (
                    <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                      <strong>Promised By:</strong> {formatADToBS(note.promisedDate)}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", marginBottom: "10px" }}>
                    <strong>Contact:</strong> {note.contactPerson || "N/A"} via {note.contactMethod}
                  </div>
                  <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => handleFollowUpDone(note.id)}
                      style={{
                        backgroundColor: "#1557b0",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Follow-up Done
                    </button>
                    <button
                      onClick={() => handleMarkResolved(note.id)}
                      style={{
                        backgroundColor: "#059669",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Render add/view notes
  const renderAddViewNotes = () => (
    <div style={{ display: "flex", gap: "20px", padding: "20px" }}>
      {/* Left Panel - Party List */}
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#000000" }}>Parties</h2>
          <button
            onClick={() => {}}
            style={{
              backgroundColor: "#1557b0",
              color: "white",
              border: BORDER,
              padding: "4px 8px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Search size={12} />
          </button>
        </div>

        <input
          type="text"
          placeholder="Search parties..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "6px",
            border: BORDER,
            borderRadius: "4px",
            marginBottom: "10px",
            fontSize: "12px",
          }}
        />

        <div style={{ maxHeight: "500px", overflowY: "auto" }}>
          {outstandingParties.map((p) => (
            <div
              key={p.party.id}
              onClick={() => setSelectedParty(p.party)}
              style={{
                padding: "8px",
                border: BORDER,
                borderRadius: "4px",
                marginBottom: "5px",
                cursor: "pointer",
                backgroundColor: selectedParty?.id === p.party.id ? BG_HEADER : "transparent",
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "12px" }}>{p.party.name}</div>
              <div style={{ fontSize: "11px", color: "#666" }}>Rs. {money(p.totalOutstanding)}</div>
              <div style={{ fontSize: "10px", color: "#888" }}>
                Since: {p.oldestDate} | Last: {p.daysSinceLastFollowUp}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Follow-up History */}
      <div
        style={{
          flex: 1,
          backgroundColor: BG_CARD,
          border: BORDER,
          padding: "20px",
          borderRadius: "8px",
        }}
      >
        {selectedParty ? (
          <div>
            <div style={{ marginBottom: "20px", paddingBottom: "15px", borderBottom: BORDER }}>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#000000",
                  marginBottom: "5px",
                }}
              >
                {selectedParty.name}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px" }}>
                <div style={{ backgroundColor: BG_HEADER, padding: "10px", borderRadius: "6px" }}>
                  <div style={{ fontSize: "12px", color: "#000000" }}>Total Outstanding</div>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#000000" }}>
                    {money(
                      outstandingParties.find((p) => p.party.id === selectedParty.id)
                        ?.totalOutstanding || 0,
                    )}
                  </div>
                </div>
                <div style={{ backgroundColor: BG_HEADER, padding: "10px", borderRadius: "6px" }}>
                  <div style={{ fontSize: "12px", color: "#000000" }}>Oldest Invoice</div>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#000000" }}>
                    {outstandingParties.find((p) => p.party.id === selectedParty.id)?.oldestDate ||
                      "N/A"}
                  </div>
                </div>
                <div style={{ backgroundColor: BG_HEADER, padding: "10px", borderRadius: "6px" }}>
                  <div style={{ fontSize: "12px", color: "#000000" }}>Credit Limit</div>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#000000" }}>
                    {money(selectedParty.creditLimit || 0)}
                  </div>
                </div>
              </div>
            </div>

            <h3
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#000000",
                marginBottom: "15px",
              }}
            >
              Follow-up History
            </h3>

            <div style={{ maxHeight: "400px", overflowY: "auto", marginBottom: "20px" }}>
              {followUpNotes
                .filter((note) => note.partyId === selectedParty.id)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((note) => (
                  <div
                    key={note.id}
                    style={{
                      border: BORDER,
                      borderRadius: "6px",
                      padding: "12px",
                      marginBottom: "10px",
                      backgroundColor: note.isResolved ? RESOLVED_BG : BG_DEEP,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "5px",
                      }}
                    >
                      <div style={{ fontWeight: "bold", fontSize: "13px" }}>
                        {formatADToBS(note.createdAt.split("T")[0])} |{" "}
                        {note.createdAt.split("T")[1].substring(0, 5)}
                      </div>
                      <div>
                        <span
                          style={{
                            backgroundColor:
                              note.priority === "High"
                                ? "#dc2626"
                                : note.priority === "Urgent"
                                  ? "#d97706"
                                  : "#059669",
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "12px",
                            fontSize: "10px",
                            fontWeight: "bold",
                          }}
                        >
                          {note.priority}
                        </span>
                        <span
                          style={{
                            backgroundColor: note.isResolved ? "#059669" : "#d97706",
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "12px",
                            fontSize: "10px",
                            fontWeight: "bold",
                            marginLeft: "5px",
                          }}
                        >
                          {note.isResolved ? "RESOLVED" : "OPEN"}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                      <strong>Contacted By:</strong> {note.createdBy}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        marginBottom: "5px",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      {note.contactMethod === "Phone Call" && <Phone size={14} />}
                      {note.contactMethod === "WhatsApp" && <MessageSquare size={14} />}
                      {note.contactMethod === "Email" && <Mail size={14} />}
                      {note.contactMethod === "In-person Visit" && <User size={14} />}
                      {note.contactMethod === "Letter" && <Home size={14} />}
                      <span>
                        <strong>Contact:</strong> {note.contactMethod}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                      <strong>Contact Person:</strong> {note.contactPerson}
                    </div>
                    <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                      <strong>Note:</strong> {note.note}
                    </div>
                    {note.promisedAmount > 0 && (
                      <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                        <strong>Promised Payment:</strong> Rs. {money(note.promisedAmount)} by{" "}
                        {formatADToBS(note.promisedDate)}
                      </div>
                    )}
                    <div style={{ fontSize: "12px" }}>
                      <strong>Next Follow-up:</strong> {formatADToBS(note.followUpDate)}
                    </div>
                  </div>
                ))}
            </div>

            {/* Add Note Form */}
            <div
              style={{
                backgroundColor: BG_HEADER,
                padding: "15px",
                borderRadius: "8px",
                border: BORDER,
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#000000",
                  marginBottom: "15px",
                }}
              >
                Add New Follow-up Note
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "15px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                      fontSize: "12px",
                    }}
                  >
                    Contact Method
                  </label>
                  <select
                    value={addNoteForm.contactMethod}
                    onChange={(e) =>
                      setAddNoteForm({ ...addNoteForm, contactMethod: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "6px",
                      border: BORDER,
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                  >
                    <option value="Phone Call">Phone Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="In-person Visit">In-person Visit</option>
                    <option value="Letter">Letter</option>
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
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={addNoteForm.contactPerson}
                    onChange={(e) =>
                      setAddNoteForm({ ...addNoteForm, contactPerson: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "6px",
                      border: BORDER,
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                  />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                      fontSize: "12px",
                    }}
                  >
                    Note/Summary
                  </label>
                  <textarea
                    value={addNoteForm.note}
                    onChange={(e) => setAddNoteForm({ ...addNoteForm, note: e.target.value })}
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
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                      fontSize: "12px",
                    }}
                  >
                    Promised Amount
                  </label>
                  <input
                    type="number"
                    value={addNoteForm.promisedAmount}
                    onChange={(e) =>
                      setAddNoteForm({ ...addNoteForm, promisedAmount: e.target.value })
                    }
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
                    Promised Date
                  </label>
                  <input
                    type="date"
                    value={addNoteForm.promisedDate}
                    onChange={(e) =>
                      setAddNoteForm({ ...addNoteForm, promisedDate: e.target.value })
                    }
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
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={addNoteForm.followUpDate}
                    onChange={(e) =>
                      setAddNoteForm({ ...addNoteForm, followUpDate: e.target.value })
                    }
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
                    Priority
                  </label>
                  <select
                    value={addNoteForm.priority}
                    onChange={(e) => setAddNoteForm({ ...addNoteForm, priority: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "6px",
                      border: BORDER,
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: "15px", textAlign: "right" }}>
                <button
                  onClick={handleAddNote}
                  style={{
                    backgroundColor: "#1557b0",
                    color: "white",
                    border: BORDER,
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#666", padding: "40px" }}>
            Select a party to view follow-up history
          </div>
        )}
      </div>
    </div>
  );

  // Render collection performance
  const renderCollectionPerformance = () => {
    const performanceData = useMemo(() => {
      // Calculate metrics based on date range and user filter
      let filteredNotes = followUpNotes;
      if (fromDate) {
        filteredNotes = filteredNotes.filter((n) => n.createdAt >= fromDate);
      }
      if (toDate) {
        filteredNotes = filteredNotes.filter((n) => n.createdAt <= toDate);
      }
      if (userFilter !== "ALL") {
        filteredNotes = filteredNotes.filter((n) => n.createdBy === userFilter);
      }

      const totalOutstanding = outstandingParties.reduce((sum, p) => sum + p.totalOutstanding, 0);
      const followUpsMade = filteredNotes.length;
      const amountsPromised = filteredNotes.reduce((sum, n) => sum + n.promisedAmount, 0);
      // Amounts collected would require linking to receipts
      const amountsCollected = 0; // Placeholder
      const collectionEfficiency =
        amountsPromised > 0 ? (amountsCollected / amountsPromised) * 100 : 0;

      return {
        totalOutstanding,
        followUpsMade,
        amountsPromised,
        amountsCollected,
        collectionEfficiency,
      };
    }, [followUpNotes, outstandingParties, fromDate, toDate, userFilter]);

    return (
      <div style={{ padding: "20px" }}>
        <h2
          style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}
        >
          Collection Performance
        </h2>

        <div style={{ display: "flex", gap: "15px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div
            style={{
              backgroundColor: BG_HEADER,
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
              minWidth: "150px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
              Total Outstanding
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
              {money(performanceData.totalOutstanding)}
            </div>
          </div>
          <div
            style={{
              backgroundColor: BG_HEADER,
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
              minWidth: "150px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
              Follow-ups Made
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
              {performanceData.followUpsMade}
            </div>
          </div>
          <div
            style={{
              backgroundColor: BG_HEADER,
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
              minWidth: "150px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
              Amounts Promised
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
              {money(performanceData.amountsPromised)}
            </div>
          </div>
          <div
            style={{
              backgroundColor: BG_HEADER,
              padding: "15px",
              borderRadius: "8px",
              border: BORDER,
              minWidth: "150px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#000000", marginBottom: "5px" }}>
              Collection Efficiency
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>
              {performanceData.collectionEfficiency.toFixed(2)}%
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
            <thead>
              <tr style={{ backgroundColor: BG_HEADER }}>
                <th style={{ border: BORDER, padding: "8px" }}>Party Name</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Total Outstanding
                </th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  No. of Follow-ups
                </th>
                <th style={{ border: BORDER, padding: "8px" }}>Last Follow-up Date</th>
                <th style={{ border: BORDER, padding: "8px" }}>Last Promised Date</th>
                <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                  Promised Amount
                </th>
                <th style={{ border: BORDER, padding: "8px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {outstandingParties.map((p) => {
                const partyNotes = followUpNotes.filter((n) => n.partyId === p.party.id);
                const lastNote = partyNotes.length > 0 ? partyNotes[partyNotes.length - 1] : null;

                // Determine status
                let status = "No Follow-up";
                if (lastNote) {
                  if (lastNote.isResolved) {
                    status = "Resolved";
                  } else if (
                    lastNote.promisedDate &&
                    new Date(lastNote.promisedDate) < new Date()
                  ) {
                    status = "Broken Promise";
                  } else {
                    status = "On Track";
                  }
                }

                return (
                  <tr
                    key={p.party.id}
                    style={{
                      backgroundColor:
                        status === "Broken Promise"
                          ? OVERDUE_BG
                          : status === "Resolved"
                            ? RESOLVED_BG
                            : "transparent",
                    }}
                  >
                    <td style={{ border: BORDER, padding: "8px" }}>{p.party.name}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(p.totalOutstanding)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {partyNotes.length}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      {lastNote ? formatADToBS(lastNote.createdAt.split("T")[0]) : "N/A"}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      {lastNote?.promisedDate ? formatADToBS(lastNote.promisedDate) : "N/A"}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(lastNote?.promisedAmount || 0)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px" }}>
                      <span
                        style={{
                          backgroundColor:
                            status === "On Track"
                              ? "#059669"
                              : status === "Broken Promise"
                                ? "#dc2626"
                                : status === "Resolved"
                                  ? "#10b981"
                                  : "#d97706",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh" }}>
      <h1
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          color: "#000000",
          padding: "20px",
          marginBottom: "0",
        }}
      >
        Follow-Up Tracker
      </h1>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "5px",
          padding: "0 20px",
          marginBottom: "20px",
          borderBottom: BORDER,
        }}
      >
        {[
          { id: "tasks", label: "Today's Tasks" },
          { id: "notes", label: "Follow-Up Notes" },
          { id: "performance", label: "Collection Performance" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              backgroundColor: activeTab === tab.id ? BG_HEADER : "transparent",
              color: activeTab === tab.id ? "#000000" : "#666",
              border: BORDER,
              padding: "10px 16px",
              borderRadius: "4px 4px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === tab.id ? "bold" : "normal",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "tasks" && renderTodayTasks()}
      {activeTab === "notes" && renderAddViewNotes()}
      {activeTab === "performance" && renderCollectionPerformance()}
    </div>
  );
}
