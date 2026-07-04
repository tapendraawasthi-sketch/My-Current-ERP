import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Search,
  FileText,
  MapPin,
  Receipt,
  Building2,
  Settings,
} from "lucide-react";
import toast from "react-hot-toast";
import { generateId } from "../lib/db";
import { useScreenF12 } from "../hooks/useF12Config";
import { ReportEmptyState } from "../components/ReportEmptyState";

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";

const NEPAL_PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
];

const LedgerMaster: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("ledger-master");

  const {
    accounts,
    addAccount,
    updateAccount,
    deleteAccount,
    upsertLedgerExtension,
    getLedgerExtension,
    costCenters,
    vatClassifications,
    costCentreClasses,
  } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("basic");

  const [basicForm, setBasicForm] = useState({
    name: "",
    alias: "",
    parentId: "",
    openingBalance: 0,
    drCr: "Dr" as "Dr" | "Cr",
    isActive: true,
  });

  const [extForm, setExtForm] = useState({
    mailingName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    province: "",
    postalCode: "",
    contactPerson: "",
    phone: "",
    mobile: "",
    email: "",
    website: "",
    whatsappNumber: "",
    sendDocsByEmail: false,
    sendDocsByWhatsapp: false,
    vatRegistrationType: "",
    panNumber: "",
    vatNumber: "",
    placeOfSupply: "",
    vatApplicable: false,
    vatClassificationId: "",
    hsCode: "",
    reverseChargeApplicable: false,
    subjectToTDS: false,
    tdsRate: 0,
    eBillingApplicable: false,
    bankName: "",
    bankBranch: "",
    bankAccountNo: "",
    ifscSwift: "",
    accountType: "",
    chequePrintingEnabled: false,
    ePaymentEnabled: false,
    bankReconEnabled: false,
    upiId: "",
    defaultPaymentMode: "",
    maintainBillByBill: false,
    defaultCreditPeriodDays: 0,
    creditLimit: 0,
    costCentresApplicable: false,
    costCentreClassId: "",
    interestCalculationApplicable: false,
    interestRate: 0,
    interestStyle: "simple",
    interestPeriod: "monthly",
    calculateFrom: "bill_date",
    gracePeriodDays: 0,
    inventoryValuesAffected: false,
  });

  const [panValidationMsg, setPanValidationMsg] = useState("");

  const filteredAccounts = useMemo(
    () =>
      (accounts || []).filter(
        (acc) => acc.isGroup === false && acc.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [accounts, searchTerm],
  );

  const parentGroups = useMemo(
    () => (accounts || []).filter((acc) => acc.isGroup === true),
    [accounts],
  );

  const resetForms = () => {
    setBasicForm({
      name: "",
      alias: "",
      parentId: "",
      openingBalance: 0,
      drCr: "Dr",
      isActive: true,
    });
    setExtForm({
      mailingName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      province: "",
      postalCode: "",
      contactPerson: "",
      phone: "",
      mobile: "",
      email: "",
      website: "",
      whatsappNumber: "",
      sendDocsByEmail: false,
      sendDocsByWhatsapp: false,
      vatRegistrationType: "",
      panNumber: "",
      vatNumber: "",
      placeOfSupply: "",
      vatApplicable: false,
      vatClassificationId: "",
      hsCode: "",
      reverseChargeApplicable: false,
      subjectToTDS: false,
      tdsRate: 0,
      eBillingApplicable: false,
      bankName: "",
      bankBranch: "",
      bankAccountNo: "",
      ifscSwift: "",
      accountType: "",
      chequePrintingEnabled: false,
      ePaymentEnabled: false,
      bankReconEnabled: false,
      upiId: "",
      defaultPaymentMode: "",
      maintainBillByBill: false,
      defaultCreditPeriodDays: 0,
      creditLimit: 0,
      costCentresApplicable: false,
      costCentreClassId: "",
      interestCalculationApplicable: false,
      interestRate: 0,
      interestStyle: "simple",
      interestPeriod: "monthly",
      calculateFrom: "bill_date",
      gracePeriodDays: 0,
      inventoryValuesAffected: false,
    });
    setSelected(null);
    setShowForm(false);
    setPanValidationMsg("");
  };

  const handleEdit = async (account: any) => {
    setBasicForm({
      name: account.name || "",
      alias: account.alias || "",
      parentId: account.parentId || "",
      openingBalance: account.openingBalance || 0,
      drCr: account.drCr || "Dr",
      isActive: account.isActive ?? true,
    });

    const extension = await getLedgerExtension(account.id);
    if (extension) {
      setExtForm({
        ...extForm,
        ...extension,
      });
    }

    setSelected(account);
    setShowForm(true);
    setActiveTab("basic");
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm("Delete this ledger? This will also delete associated transactions.")) {
      try {
        await deleteAccount(id);
        toast.success("Ledger deleted successfully");
        if (selected && selected.id === id) {
          resetForms();
        }
      } catch (error) {
        console.error("Delete error:", error);
        toast.error("An error occurred while deleting the ledger.");
      }
    }
  };

  const handleSubmit = async () => {
    if (!basicForm.name.trim()) {
      toast.error("Ledger Name is required");
      return;
    }
    if (!basicForm.parentId) {
      toast.error("Under Group is required");
      return;
    }

    try {
      if (selected) {
        await updateAccount(selected.id, {
          name: basicForm.name,
          alias: basicForm.alias,
          parentId: basicForm.parentId,
          openingBalance: basicForm.openingBalance,
          drCr: basicForm.drCr,
          isActive: basicForm.isActive,
        });
        await upsertLedgerExtension(selected.id, extForm);
        toast.success("Ledger updated successfully");
      } else {
        const newId = generateId();
        await addAccount({
          id: newId,
          name: basicForm.name,
          alias: basicForm.alias,
          parentId: basicForm.parentId,
          openingBalance: basicForm.openingBalance,
          drCr: basicForm.drCr,
          isActive: basicForm.isActive,
          isGroup: false,
          type: "asset", // Default type for ledgers
        });
        await upsertLedgerExtension(newId, extForm);
        toast.success("Ledger created successfully");
      }
      resetForms();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving the ledger.");
    }
  };

  const validatePan = (pan: string) => {
    if (pan && !/^\d{9}$/.test(pan)) {
      setPanValidationMsg("Invalid PAN: must be 9 digits");
    } else {
      setPanValidationMsg("");
    }
  };

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 9) {
      setExtForm({ ...extForm, panNumber: value });
      validatePan(value);
    }
  };

  const inputClass =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full";
  const labelClass = "text-[11px] font-medium text-gray-600 mb-1 block";

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa] overflow-hidden">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Ledger Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage accounts and ledgers</p>
            </div>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                resetForms();
                setShowForm(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add ledger
            </button>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search ledgers..."
              className={`${inputClass} pl-8`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          {filteredAccounts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={searchTerm ? "No ledgers match your search" : "No ledgers found"}
                hint={
                  searchTerm
                    ? "Try a different search term."
                    : 'Click "Add ledger" to create your first ledger.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={`${th} w-12`}>#</th>
                    <th className={th}>Ledger name</th>
                    <th className={th}>Group</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account, index) => {
                    const parentGroup = parentGroups.find((g) => g.id === account.parentId);
                    return (
                      <tr
                        key={account.id}
                        className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                        onClick={() => handleEdit(account)}
                      >
                        <td className={td}>{index + 1}</td>
                        <td className={`${td} font-medium text-gray-800`}>{account.name}</td>
                        <td className={td}>{parentGroup?.name || "—"}</td>
                        <td className={`${td} text-center`}>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              account.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {account.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className={`${td} text-right`}>
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(account);
                              }}
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                              onClick={(e) => handleDelete(account.id, e)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {filteredAccounts.length} ledger{filteredAccounts.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-full lg:w-[650px] xl:w-[750px] shrink-0 bg-white flex flex-col border-l border-gray-200 min-h-0">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-gray-800">
              {selected ? "Edit ledger" : "New ledger"}
            </h3>
            <button
              type="button"
              onClick={resetForms}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tab Bar */}
          <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
            {[
              { id: "basic", label: "Basic Details", icon: FileText },
              { id: "contact", label: "Mailing & Contact", icon: MapPin },
              { id: "tax", label: "VAT & Tax", icon: Receipt },
              { id: "bank", label: "Bank Config", icon: Building2 },
              { id: "advanced", label: "Advanced", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors
                  ${
                    activeTab === tab.id
                      ? "bg-white text-[#1557b0] border-b-2 border-[#1557b0]"
                      : "text-gray-600 hover:bg-gray-100 border-b-2 border-transparent"
                  }
                `}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Basic Details Tab */}
            {activeTab === "basic" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <div className="mb-4">
                    <label className={labelClass}>
                      Ledger Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      value={basicForm.name}
                      onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })}
                      placeholder="Enter ledger name"
                      autoFocus
                    />
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>Alias</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={basicForm.alias}
                      onChange={(e) => setBasicForm({ ...basicForm, alias: e.target.value })}
                      placeholder="Enter alias"
                    />
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>
                      Under Group <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={inputClass}
                      value={basicForm.parentId}
                      onChange={(e) => setBasicForm({ ...basicForm, parentId: e.target.value })}
                    >
                      <option value="">-- Select Group --</option>
                      {parentGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="mb-4">
                    <label className={labelClass}>Opening Balance (NPR)</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={basicForm.openingBalance}
                      onChange={(e) =>
                        setBasicForm({
                          ...basicForm,
                          openingBalance: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      step="any"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="mb-5">
                    <label className={labelClass}>Dr / Cr</label>
                    <div className="flex gap-4 items-center h-8">
                      <label className="flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="drCr"
                          className="text-[#1557b0] focus:ring-[#1557b0] cursor-pointer"
                          checked={basicForm.drCr === "Dr"}
                          onChange={() => setBasicForm({ ...basicForm, drCr: "Dr" })}
                        />
                        Dr
                      </label>
                      <label className="flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="drCr"
                          className="text-[#1557b0] focus:ring-[#1557b0] cursor-pointer"
                          checked={basicForm.drCr === "Cr"}
                          onChange={() => setBasicForm({ ...basicForm, drCr: "Cr" })}
                        />
                        Cr
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={basicForm.isActive}
                        onChange={(e) => setBasicForm({ ...basicForm, isActive: e.target.checked })}
                      />
                      Is Active
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Mailing & Contact Tab */}
            {activeTab === "contact" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <div className="mb-4">
                    <label className={labelClass}>Mailing Name</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={extForm.mailingName}
                      onChange={(e) => setExtForm({ ...extForm, mailingName: e.target.value })}
                    />
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>Address Line 1</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={extForm.addressLine1}
                      onChange={(e) => setExtForm({ ...extForm, addressLine1: e.target.value })}
                    />
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>Address Line 2</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={extForm.addressLine2}
                      onChange={(e) => setExtForm({ ...extForm, addressLine2: e.target.value })}
                    />
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>City</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={extForm.city}
                      onChange={(e) => setExtForm({ ...extForm, city: e.target.value })}
                    />
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>Province</label>
                    <select
                      className={inputClass}
                      value={extForm.province}
                      onChange={(e) => setExtForm({ ...extForm, province: e.target.value })}
                    >
                      <option value="">-- Select Province --</option>
                      {NEPAL_PROVINCES.map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>Postal Code</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={extForm.postalCode}
                      onChange={(e) => setExtForm({ ...extForm, postalCode: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-4">
                    <label className={labelClass}>Contact Person</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={extForm.contactPerson}
                      onChange={(e) => setExtForm({ ...extForm, contactPerson: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={extForm.phone}
                        onChange={(e) => setExtForm({ ...extForm, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Mobile</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={extForm.mobile}
                        onChange={(e) => setExtForm({ ...extForm, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      className={inputClass}
                      value={extForm.email}
                      onChange={(e) => setExtForm({ ...extForm, email: e.target.value })}
                    />
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>Website</label>
                    <input
                      type="url"
                      className={inputClass}
                      value={extForm.website}
                      onChange={(e) => setExtForm({ ...extForm, website: e.target.value })}
                    />
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>WhatsApp Number</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={extForm.whatsappNumber}
                      onChange={(e) => setExtForm({ ...extForm, whatsappNumber: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2.5 bg-gray-50 p-3 rounded-md border border-gray-200">
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.sendDocsByEmail}
                        onChange={(e) =>
                          setExtForm({ ...extForm, sendDocsByEmail: e.target.checked })
                        }
                      />
                      Send Documents by Email
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.sendDocsByWhatsapp}
                        onChange={(e) =>
                          setExtForm({ ...extForm, sendDocsByWhatsapp: e.target.checked })
                        }
                      />
                      Send Documents by WhatsApp
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* VAT & Tax Tab */}
            {activeTab === "tax" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <div className="mb-4">
                    <label className={labelClass}>VAT Registration Type</label>
                    <select
                      className={inputClass}
                      value={extForm.vatRegistrationType}
                      onChange={(e) =>
                        setExtForm({ ...extForm, vatRegistrationType: e.target.value })
                      }
                    >
                      <option value="">-- Select Type --</option>
                      <option value="regular">Regular VAT Registered</option>
                      <option value="composition">Composition Scheme</option>
                      <option value="unregistered">Unregistered</option>
                      <option value="consumer">Consumer</option>
                      <option value="export">Export</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className={labelClass}>PAN Number</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={extForm.panNumber}
                        onChange={handlePanChange}
                        onBlur={() => validatePan(extForm.panNumber)}
                        maxLength={9}
                        placeholder="9 digits"
                      />
                      {panValidationMsg && (
                        <div className="text-red-600 text-[10px] mt-1">{panValidationMsg}</div>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>VAT Number</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={extForm.vatNumber}
                        onChange={(e) => setExtForm({ ...extForm, vatNumber: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>Place of Supply</label>
                    <select
                      className={inputClass}
                      value={extForm.placeOfSupply}
                      onChange={(e) => setExtForm({ ...extForm, placeOfSupply: e.target.value })}
                    >
                      <option value="">-- Select Province --</option>
                      {NEPAL_PROVINCES.map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2.5 bg-gray-50 p-3 rounded-md border border-gray-200">
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.vatApplicable}
                        onChange={(e) =>
                          setExtForm({ ...extForm, vatApplicable: e.target.checked })
                        }
                      />
                      VAT Applicable
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.reverseChargeApplicable}
                        onChange={(e) =>
                          setExtForm({ ...extForm, reverseChargeApplicable: e.target.checked })
                        }
                      />
                      Reverse Charge Applicable
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.subjectToTDS}
                        onChange={(e) => setExtForm({ ...extForm, subjectToTDS: e.target.checked })}
                      />
                      Subject to TDS
                    </label>
                    {extForm.subjectToTDS && (
                      <div className="ml-5 mt-1">
                        <label className="text-[10px] font-medium text-gray-500 mb-1 block">
                          TDS Rate %
                        </label>
                        <input
                          type="number"
                          className="h-7 px-2 text-[11px] border border-gray-300 rounded bg-white w-24"
                          value={extForm.tdsRate}
                          onChange={(e) =>
                            setExtForm({ ...extForm, tdsRate: parseFloat(e.target.value) || 0 })
                          }
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none mt-1">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.eBillingApplicable}
                        onChange={(e) =>
                          setExtForm({ ...extForm, eBillingApplicable: e.target.checked })
                        }
                      />
                      e-Billing Applicable (IRD &gt; 50L)
                    </label>
                  </div>
                </div>
                <div>
                  <div className="mb-4">
                    <label className={labelClass}>VAT Classification</label>
                    <select
                      className={inputClass}
                      value={extForm.vatClassificationId}
                      onChange={(e) =>
                        setExtForm({ ...extForm, vatClassificationId: e.target.value })
                      }
                    >
                      <option value="">-- None --</option>
                      {(vatClassifications || []).map((vc) => (
                        <option key={vc.id} value={vc.id}>
                          {vc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>HS Code (Customs, 6-8 digits)</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={extForm.hsCode}
                      onChange={(e) =>
                        setExtForm({ ...extForm, hsCode: e.target.value.replace(/\D/g, "") })
                      }
                      placeholder="e.g. 100199"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bank Config Tab */}
            {activeTab === "bank" && (
              <div>
                <div className="mb-4 bg-blue-50 text-blue-800 text-[11px] p-2 rounded-md border border-blue-100 flex items-center gap-2">
                  <Building2 size={14} className="text-blue-600" />
                  Fill this tab only if this ledger represents a Bank Account or Wallet.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <div className="mb-4">
                      <label className={labelClass}>Bank Name</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={extForm.bankName}
                        onChange={(e) => setExtForm({ ...extForm, bankName: e.target.value })}
                      />
                    </div>
                    <div className="mb-4">
                      <label className={labelClass}>Branch Name</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={extForm.bankBranch}
                        onChange={(e) => setExtForm({ ...extForm, bankBranch: e.target.value })}
                      />
                    </div>
                    <div className="mb-4">
                      <label className={labelClass}>Account Number</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={extForm.bankAccountNo}
                        onChange={(e) => setExtForm({ ...extForm, bankAccountNo: e.target.value })}
                      />
                    </div>
                    <div className="mb-4">
                      <label className={labelClass}>SWIFT Code / IFSC</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={extForm.ifscSwift}
                        onChange={(e) => setExtForm({ ...extForm, ifscSwift: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-4">
                      <label className={labelClass}>Account Type</label>
                      <select
                        className={inputClass}
                        value={extForm.accountType}
                        onChange={(e) => setExtForm({ ...extForm, accountType: e.target.value })}
                      >
                        <option value="">-- Select Type --</option>
                        <option value="current">Current</option>
                        <option value="savings">Savings</option>
                        <option value="overdraft">Overdraft</option>
                        <option value="cc">Cash Credit</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2.5 bg-gray-50 p-3 rounded-md border border-gray-200 mb-4">
                      <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                          checked={extForm.chequePrintingEnabled}
                          onChange={(e) =>
                            setExtForm({ ...extForm, chequePrintingEnabled: e.target.checked })
                          }
                        />
                        Cheque Printing Enabled
                      </label>
                      <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                          checked={extForm.ePaymentEnabled}
                          onChange={(e) =>
                            setExtForm({ ...extForm, ePaymentEnabled: e.target.checked })
                          }
                        />
                        e-Payment Enabled
                      </label>
                      <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                          checked={extForm.bankReconEnabled}
                          onChange={(e) =>
                            setExtForm({ ...extForm, bankReconEnabled: e.target.checked })
                          }
                        />
                        Bank Reconciliation Enabled
                      </label>
                    </div>

                    <div className="mb-4">
                      <label className={labelClass}>UPI / eSewa / Khalti ID (optional)</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={extForm.upiId}
                        onChange={(e) => setExtForm({ ...extForm, upiId: e.target.value })}
                      />
                    </div>
                    <div className="mb-4">
                      <label className={labelClass}>Default Payment Mode</label>
                      <select
                        className={inputClass}
                        value={extForm.defaultPaymentMode}
                        onChange={(e) =>
                          setExtForm({ ...extForm, defaultPaymentMode: e.target.value })
                        }
                      >
                        <option value="">-- Select Mode --</option>
                        <option value="NEFT">NEFT</option>
                        <option value="RTGS">RTGS</option>
                        <option value="eSewa">eSewa</option>
                        <option value="Khalti">Khalti</option>
                        <option value="ConnectIPS">ConnectIPS</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Tab */}
            {activeTab === "advanced" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <div className="flex flex-col gap-2.5 bg-gray-50 p-3 rounded-md border border-gray-200">
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.maintainBillByBill}
                        onChange={(e) =>
                          setExtForm({ ...extForm, maintainBillByBill: e.target.checked })
                        }
                      />
                      Maintain Balances Bill-by-Bill
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.inventoryValuesAffected}
                        onChange={(e) =>
                          setExtForm({ ...extForm, inventoryValuesAffected: e.target.checked })
                        }
                      />
                      Inventory Values Affected
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.costCentresApplicable}
                        onChange={(e) =>
                          setExtForm({ ...extForm, costCentresApplicable: e.target.checked })
                        }
                      />
                      Cost Centres Applicable
                    </label>
                    {extForm.costCentresApplicable && (
                      <div className="ml-5 mt-1">
                        <label className="text-[10px] font-medium text-gray-500 mb-1 block">
                          Cost Centre Class
                        </label>
                        <select
                          className="h-7 px-2 text-[11px] border border-gray-300 rounded bg-white w-full"
                          value={extForm.costCentreClassId}
                          onChange={(e) =>
                            setExtForm({ ...extForm, costCentreClassId: e.target.value })
                          }
                        >
                          <option value="">-- None --</option>
                          {(costCentreClasses || []).map((ccc) => (
                            <option key={ccc.id} value={ccc.id}>
                              {ccc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                        checked={extForm.interestCalculationApplicable}
                        onChange={(e) =>
                          setExtForm({
                            ...extForm,
                            interestCalculationApplicable: e.target.checked,
                          })
                        }
                      />
                      Interest Calculation Applicable
                    </label>
                  </div>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className={labelClass}>Default Credit (Days)</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={extForm.defaultCreditPeriodDays}
                        onChange={(e) =>
                          setExtForm({
                            ...extForm,
                            defaultCreditPeriodDays: parseInt(e.target.value) || 0,
                          })
                        }
                        min="0"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Credit Limit (NPR)</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={extForm.creditLimit}
                        onChange={(e) =>
                          setExtForm({ ...extForm, creditLimit: parseFloat(e.target.value) || 0 })
                        }
                        min="0"
                        step="any"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {extForm.interestCalculationApplicable && (
                    <div className="p-3 border border-gray-200 rounded-md bg-gray-50 mt-4">
                      <div className="text-[11px] font-semibold mb-3 text-gray-800 uppercase tracking-wide">
                        Interest Settings
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="mb-2">
                          <label className="text-[10px] font-medium text-gray-600 mb-1 block">
                            Rate %
                          </label>
                          <input
                            type="number"
                            className="h-7 px-2 text-[11px] border border-gray-300 rounded bg-white w-full focus:outline-none focus:ring-1 focus:ring-[#1557b0]/50"
                            value={extForm.interestRate}
                            onChange={(e) =>
                              setExtForm({
                                ...extForm,
                                interestRate: parseFloat(e.target.value) || 0,
                              })
                            }
                            min="0"
                            max="100"
                            step="0.01"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="text-[10px] font-medium text-gray-600 mb-1 block">
                            Style
                          </label>
                          <select
                            className="h-7 px-2 text-[11px] border border-gray-300 rounded bg-white w-full focus:outline-none focus:ring-1 focus:ring-[#1557b0]/50"
                            value={extForm.interestStyle}
                            onChange={(e) =>
                              setExtForm({ ...extForm, interestStyle: e.target.value })
                            }
                          >
                            <option value="simple">Simple</option>
                            <option value="compound">Compound</option>
                          </select>
                        </div>
                        <div className="mb-2">
                          <label className="text-[10px] font-medium text-gray-600 mb-1 block">
                            Period
                          </label>
                          <select
                            className="h-7 px-2 text-[11px] border border-gray-300 rounded bg-white w-full focus:outline-none focus:ring-1 focus:ring-[#1557b0]/50"
                            value={extForm.interestPeriod}
                            onChange={(e) =>
                              setExtForm({ ...extForm, interestPeriod: e.target.value })
                            }
                          >
                            <option value="daily">Daily</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        <div className="mb-2">
                          <label className="text-[10px] font-medium text-gray-600 mb-1 block">
                            Calculate From
                          </label>
                          <select
                            className="h-7 px-2 text-[11px] border border-gray-300 rounded bg-white w-full focus:outline-none focus:ring-1 focus:ring-[#1557b0]/50"
                            value={extForm.calculateFrom}
                            onChange={(e) =>
                              setExtForm({ ...extForm, calculateFrom: e.target.value })
                            }
                          >
                            <option value="bill_date">Bill Date</option>
                            <option value="due_date">Due Date</option>
                            <option value="voucher_date">Voucher Date</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-medium text-gray-600 mb-1 block">
                            Grace Period (Days)
                          </label>
                          <input
                            type="number"
                            className="h-7 px-2 text-[11px] border border-gray-300 rounded bg-white w-full focus:outline-none focus:ring-1 focus:ring-[#1557b0]/50"
                            value={extForm.gracePeriodDays}
                            onChange={(e) =>
                              setExtForm({
                                ...extForm,
                                gracePeriodDays: parseInt(e.target.value) || 0,
                              })
                            }
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
            <button type="button" className={btnOutline} onClick={resetForms}>
              Cancel
            </button>
            <button type="button" className={btnPrimary} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {selected ? "Update" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerMaster;
