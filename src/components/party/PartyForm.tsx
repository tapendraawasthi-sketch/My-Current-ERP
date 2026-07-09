// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { queuePartyPhoneSavedNotice } from "@/ai/actions/partyPhoneSavedBridge";
import {
  peekAgingSetphoneReturnDraft,
  consumeAgingSetphoneReturnDraft,
} from "@/ai/actions/chatQueryDraft";
import { saveAiAgingReportDraft } from "@/ai/actions/agingReportDraft";
import { useStore } from "../../store";
import toast from "react-hot-toast";
import { PartyType } from "../../lib/types";
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Percent,
  Save,
  X,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";

// ─── Sub-types ───────────────────────────────────────────────────────────────

interface ContactRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  designation: string;
}

interface BankRow {
  id: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  accountType: string; // "savings" | "current" | "cc" | "od"
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyContact = (): ContactRow => ({
  id: crypto.randomUUID(),
  name: "",
  phone: "",
  email: "",
  designation: "",
});

const emptyBank = (): BankRow => ({
  id: crypto.randomUUID(),
  bankName: "",
  accountNo: "",
  ifsc: "",
  branch: "",
  accountType: "current",
});

// ─── Component ───────────────────────────────────────────────────────────────

interface PartyFormProps {
  partyId?: string;
  onClose: () => void;
  prefillPhone?: string;
  focusPhone?: boolean;
}

const PartyForm: React.FC<PartyFormProps> = ({ partyId, onClose, prefillPhone, focusPhone }) => {
  const {
    parties,
    accounts,
    addParty,
    updateParty,
    priceLists, // string[] or PriceList[] – use what's in your store
    salesPersons, // string[] or SalesPerson[] – use what's in your store
  } = useStore();

  const isEdit = Boolean(partyId);
  const existing = isEdit ? parties.find((p) => p.id === partyId) : null;

  // ── Basic ─────────────────────────────────────────────────────────────────
  const [partyType, setPartyType] = useState<PartyType>(existing?.partyType ?? "customer");
  const [name, setName] = useState(existing?.name ?? "");
  const [alias, setAlias] = useState(existing?.alias ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [gstin, setGstin] = useState(existing?.gstin ?? "");
  const [pan, setPan] = useState(existing?.pan ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  // ── Address ───────────────────────────────────────────────────────────────
  const [address, setAddress] = useState(existing?.address ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [state, setState] = useState(existing?.state ?? "");
  const [pincode, setPincode] = useState(existing?.pincode ?? "");
  const [country, setCountry] = useState(existing?.country ?? "India");

  // ── Multiple Contacts (Task 3.1) ──────────────────────────────────────────
  const [contacts, setContacts] = useState<ContactRow[]>(
    existing?.contacts?.length
      ? existing.contacts.map((c: any) => ({ id: crypto.randomUUID(), ...c }))
      : [emptyContact()],
  );

  const updateContact = (id: string, field: keyof ContactRow, value: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const addContactRow = () => setContacts((prev) => [...prev, emptyContact()]);

  const removeContactRow = (id: string) => {
    if (contacts.length === 1) {
      toast.error("At least one contact row is required.");
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  // ── Multiple Bank Accounts (Task 3.2) ────────────────────────────────────
  const [banks, setBanks] = useState<BankRow[]>(
    existing?.bankAccounts?.length
      ? existing.bankAccounts.map((b: any) => ({ id: crypto.randomUUID(), ...b }))
      : [emptyBank()],
  );

  const updateBank = (id: string, field: keyof BankRow, value: string) => {
    setBanks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const addBankRow = () => setBanks((prev) => [...prev, emptyBank()]);

  const removeBankRow = (id: string) => {
    if (banks.length === 1) {
      toast.error("At least one bank account row is required.");
      return;
    }
    setBanks((prev) => prev.filter((b) => b.id !== id));
  };

  // ── Financial / Ledger ────────────────────────────────────────────────────
  const [creditLimit, setCreditLimit] = useState<number>(existing?.creditLimit ?? 0);
  const [creditPeriod, setCreditPeriod] = useState<number>(existing?.creditPeriod ?? 0);
  const [ledgerId, setLedgerId] = useState<string>(existing?.ledgerId ?? "");

  // ── Sales-person & Price-list (Task 3.3) ─────────────────────────────────
  const [salesPersonId, setSalesPersonId] = useState<string>(existing?.salesPersonId ?? "");
  const [priceListId, setPriceListId] = useState<string>(existing?.priceListId ?? "");

  // ── TDS / Tax ─────────────────────────────────────────────────────────────
  const [tdsApplicable, setTdsApplicable] = useState<boolean>(existing?.tdsApplicable ?? false);
  const [tdsRate, setTdsRate] = useState<number>(existing?.tdsRate ?? 0);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"basic" | "contact" | "bank" | "financial" | "tax">(
    focusPhone ? "contact" : "basic",
  );

  useEffect(() => {
    if (!prefillPhone) return;
    setContacts((prev) => {
      const next = [...prev];
      next[0] = { ...next[0], phone: prefillPhone };
      return next;
    });
    if (focusPhone) setActiveTab("contact");
  }, [prefillPhone, focusPhone]);

  // ── Derived account lists ─────────────────────────────────────────────────
  const debtorAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.level === "ledger" &&
          (a.name.toLowerCase().includes("debtor") || a.name.toLowerCase().includes("receivable")),
      ),
    [accounts],
  );

  const creditorAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.level === "ledger" &&
          (a.name.toLowerCase().includes("creditor") || a.name.toLowerCase().includes("payable")),
      ),
    [accounts],
  );

  // Auto-select ledger based on party type
  useEffect(() => {
    if (!isEdit) {
      if (partyType === "customer" && debtorAccounts.length > 0) {
        setLedgerId(debtorAccounts[0].id);
      } else if (partyType === "supplier" && creditorAccounts.length > 0) {
        setLedgerId(creditorAccounts[0].id);
      }
    }
  }, [partyType, isEdit]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!name.trim()) return "Party name is required.";
    if (!code.trim()) return "Party code is required.";
    const dupCode = parties.find((p) => p.code === code.trim() && p.id !== partyId);
    if (dupCode) return `Code "${code}" is already in use.`;
    const dupName = parties.find(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase() && p.id !== partyId,
    );
    if (dupName) return `Party "${name}" already exists.`;
    return null;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    // Strip the local UUID from contact/bank rows before saving
    const cleanContacts = contacts.map(({ id, ...rest }) => rest);
    const cleanBanks = banks.map(({ id, ...rest }) => rest);

    const payload = {
      partyType,
      name: name.trim(),
      alias: alias.trim(),
      code: code.trim(),
      gstin: gstin.trim(),
      pan: pan.trim(),
      isActive,
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country.trim(),
      contacts: cleanContacts,
      bankAccounts: cleanBanks,
      creditLimit,
      creditPeriod,
      ledgerId,
      salesPersonId,
      priceListId,
      tdsApplicable,
      tdsRate: tdsApplicable ? tdsRate : 0,
    };

    try {
      if (isEdit && partyId) {
        await updateParty({ ...payload, id: partyId });
        toast.success("Party updated successfully.");
      } else {
        await addParty(payload);
        toast.success("Party created successfully.");
      }
      if (prefillPhone || focusPhone) {
        const savedPhone = cleanContacts[0]?.phone?.trim() || prefillPhone?.trim();
        if (savedPhone) {
          const balance =
            typeof existing?.balance === "number" ? existing.balance : undefined;
          queuePartyPhoneSavedNotice(name.trim(), savedPhone, balance);
          const agingReturn = peekAgingSetphoneReturnDraft();
          if (
            agingReturn &&
            agingReturn.searchTerm.trim().toLowerCase() === name.trim().toLowerCase()
          ) {
            saveAiAgingReportDraft({
              direction: agingReturn.direction,
              searchTerm: agingReturn.searchTerm,
            });
            consumeAgingSetphoneReturnDraft();
            useStore.getState().setCurrentPage("aging-report");
          }
        }
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save party.");
    }
  };

  // ── Tab definitions ───────────────────────────────────────────────────────
  const tabs = [
    { key: "basic", label: "Basic" },
    { key: "contact", label: "Contacts" },
    { key: "bank", label: "Bank Accounts" },
    { key: "financial", label: "Financial" },
    { key: "tax", label: "Tax / TDS" },
  ] as const;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1557b0]/10 rounded-lg">
              <Building2 className="w-5 h-5 text-[#1557b0]" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-800">
                {isEdit ? "Edit Party" : "New Party"}
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {isEdit ? `Editing: ${existing?.name}` : "Create a new party record"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-gray-200 px-6 flex-shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-[12px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.key
                  ? "border-[#1557b0] text-[#1557b0]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* ── BASIC TAB ─────────────────────────────────────────── */}
            {activeTab === "basic" && (
              <div className="space-y-4">
                {/* Party Type */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Party Type *
                  </label>
                  <div className="flex gap-4">
                    {(["customer", "supplier", "both"] as PartyType[]).map((pt) => (
                      <label key={pt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="partyType"
                          value={pt}
                          checked={partyType === pt}
                          onChange={() => setPartyType(pt)}
                          className="accent-[#1557b0]"
                        />
                        <span className="text-[12px] font-medium text-gray-700 capitalize">
                          {pt}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Party Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sharma Traders Pvt. Ltd."
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>

                  {/* Code */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Party Code *
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SHAR001"
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>

                  {/* Alias */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Alias / Short Name
                    </label>
                    <input
                      type="text"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="e.g. Sharma T"
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>

                  {/* GSTIN */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      GSTIN
                    </label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 07AABCU9603R1ZX"
                      maxLength={15}
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>

                  {/* PAN */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">PAN</label>
                    <input
                      type="text"
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      placeholder="e.g. AABCU9603R"
                      maxLength={10}
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Address
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={2}
                      placeholder="Street / Area"
                      className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] resize-none"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. New Delhi"
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Delhi"
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>

                  {/* Pincode */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Pincode
                    </label>
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="e.g. 110001"
                      maxLength={6}
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. India"
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    />
                  </div>
                </div>

                {/* Active toggle */}
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="accent-[#1557b0]"
                  />
                  <span className="text-[12px] font-medium text-gray-700">Active</span>
                </label>
              </div>
            )}

            {/* ── CONTACTS TAB (Task 3.1) ──────────────────────────── */}
            {activeTab === "contact" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-wide">
                    Contact Persons
                  </h3>
                  <button
                    type="button"
                    onClick={addContactRow}
                    className="flex items-center gap-1 text-[11px] text-[#1557b0] hover:text-[#0f4a96] font-semibold uppercase tracking-wide"
                  >
                    <Plus className="w-3 h-3" />
                    Add Contact
                  </button>
                </div>

                <div className="space-y-3">
                  {contacts.map((c, idx) => (
                    <div
                      key={c.id}
                      className="border border-gray-200 rounded-lg p-4 bg-[#f5f6fa] relative"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase">
                          Contact {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeContactRow(c.id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Remove contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            Name
                          </label>
                          <div className="relative">
                            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="text"
                              value={c.name}
                              onChange={(e) => updateContact(c.id, "name", e.target.value)}
                              placeholder="Contact name"
                              className="w-full h-8 pl-8 pr-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            Designation
                          </label>
                          <input
                            type="text"
                            value={c.designation}
                            onChange={(e) => updateContact(c.id, "designation", e.target.value)}
                            placeholder="e.g. Manager"
                            className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            Phone
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="tel"
                              value={c.phone}
                              onChange={(e) => updateContact(c.id, "phone", e.target.value)}
                              placeholder="+91 98XXXXXXXX"
                              className="w-full h-8 pl-8 pr-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            Email
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="email"
                              value={c.email}
                              onChange={(e) => updateContact(c.id, "email", e.target.value)}
                              placeholder="contact@example.com"
                              className="w-full h-8 pl-8 pr-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── BANK ACCOUNTS TAB (Task 3.2) ─────────────────────── */}
            {activeTab === "bank" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-bold text-gray-800 uppercase tracking-wide">
                    Bank Accounts
                  </h3>
                  <button
                    type="button"
                    onClick={addBankRow}
                    className="flex items-center gap-1 text-[11px] text-[#1557b0] hover:text-[#0f4a96] font-semibold uppercase tracking-wide"
                  >
                    <Plus className="w-3 h-3" />
                    Add Bank Account
                  </button>
                </div>

                <div className="space-y-3">
                  {banks.map((b, idx) => (
                    <div key={b.id} className="border border-gray-200 rounded-lg p-4 bg-[#f5f6fa]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase">
                          Bank Account {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeBankRow(b.id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Remove bank account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            Bank Name
                          </label>
                          <input
                            type="text"
                            value={b.bankName}
                            onChange={(e) => updateBank(b.id, "bankName", e.target.value)}
                            placeholder="e.g. State Bank of India"
                            className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            Account Type
                          </label>
                          <select
                            value={b.accountType}
                            onChange={(e) => updateBank(b.id, "accountType", e.target.value)}
                            className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                          >
                            <option value="savings">Savings</option>
                            <option value="current">Current</option>
                            <option value="cc">Cash Credit (CC)</option>
                            <option value="od">Overdraft (OD)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            Account Number
                          </label>
                          <div className="relative">
                            <CreditCard className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="text"
                              value={b.accountNo}
                              onChange={(e) => updateBank(b.id, "accountNo", e.target.value)}
                              placeholder="Account number"
                              className="w-full h-8 pl-8 pr-2.5 border border-gray-300 rounded-md text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            IFSC / SWIFT Code
                          </label>
                          <input
                            type="text"
                            value={b.ifsc}
                            onChange={(e) => updateBank(b.id, "ifsc", e.target.value.toUpperCase())}
                            placeholder="e.g. SBIN0001234"
                            maxLength={11}
                            className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            Branch
                          </label>
                          <div className="relative">
                            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="text"
                              value={b.branch}
                              onChange={(e) => updateBank(b.id, "branch", e.target.value)}
                              placeholder="Branch name / address"
                              className="w-full h-8 pl-8 pr-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── FINANCIAL TAB ────────────────────────────────────── */}
            {activeTab === "financial" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ledger Account */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Linked Ledger Account
                    </label>
                    <select
                      value={ledgerId}
                      onChange={(e) => setLedgerId(e.target.value)}
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                    >
                      <option value="">— Select ledger —</option>
                      <optgroup label="Debtors / Receivables">
                        {debtorAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Creditors / Payables">
                        {creditorAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Credit Limit */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Credit Limit (Rs)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(Number(e.target.value))}
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-right"
                    />
                  </div>

                  {/* Credit Period */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Credit Period (days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={creditPeriod}
                      onChange={(e) => setCreditPeriod(Number(e.target.value))}
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] text-right"
                    />
                  </div>

                  {/* Sales Person (Task 3.3) */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Sales Person
                    </label>
                    <select
                      value={salesPersonId}
                      onChange={(e) => setSalesPersonId(e.target.value)}
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                    >
                      <option value="">— None —</option>
                      {(salesPersons ?? []).map((sp: any) => (
                        <option key={sp.id ?? sp} value={sp.id ?? sp}>
                          {sp.name ?? sp}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Price List (Task 3.3) */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Price List
                    </label>
                    <select
                      value={priceListId}
                      onChange={(e) => setPriceListId(e.target.value)}
                      className="w-full h-8 px-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] bg-white"
                    >
                      <option value="">— Default —</option>
                      {(priceLists ?? []).map((pl: any) => (
                        <option key={pl.id ?? pl} value={pl.id ?? pl}>
                          {pl.name ?? pl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAX / TDS TAB ────────────────────────────────────── */}
            {activeTab === "tax" && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tdsApplicable}
                    onChange={(e) => setTdsApplicable(e.target.checked)}
                    className="accent-[#1557b0]"
                  />
                  <span className="text-[12px] font-medium text-gray-700">TDS Applicable</span>
                </label>

                {tdsApplicable && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        TDS Rate (%)
                      </label>
                      <div className="relative">
                        <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={tdsRate}
                          onChange={(e) => setTdsRate(Number(e.target.value))}
                          className="w-full h-8 pl-8 pr-2.5 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 text-[12px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            className="flex items-center gap-2 h-8 px-4 text-[12px] font-medium text-white bg-[#1557b0] rounded-md hover:bg-[#0f4a96] transition-colors"
          >
            <Save className="w-4 h-4" />
            {isEdit ? "Update Party" : "Save Party"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartyForm;
