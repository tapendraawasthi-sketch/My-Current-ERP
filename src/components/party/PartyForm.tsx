// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Party, PartyType, TdsType } from "@/lib/types";
import { Input, Select, Button, Badge } from "../ui";
import { TDS_RATES, NEPAL_PROVINCES } from "@/lib/constants";
import {
  Info,
  AlertCircle,
  ShoppingBag,
  Landmark,
  ShieldCheck,
  Contact,
  MapPin,
  DollarSign,
  Percent,
} from "lucide-react";
import toast from "react-hot-toast";

interface PartyFormProps {
  party?: Party;
  partiesList?: Party[];
  onSave: (party: any) => void;
  onCancel: () => void;
}

type TabType = "basic" | "contact" | "financial" | "tds";

const PartyForm: React.FC<PartyFormProps> = ({ party, partiesList = [], onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<TabType>("basic");

  // Form states - Basic Info
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameNepali, setNameNepali] = useState("");
  const [selectedType, setSelectedType] = useState<"customer" | "supplier" | "both">("customer");
  const [pan, setPan] = useState("");
  const [vatNo, setVatNo] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  // Form states - Contact & Address
  const [address, setAddress] = useState("");
  const [addressNepali, setAddressNepali] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [wardNo, setWardNo] = useState("");
  const [country, setCountry] = useState("Nepal");
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankBranch, setBankBranch] = useState("");

  // Form states - Financials
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [creditDays, setCreditDays] = useState<number>(0);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<"Dr" | "Cr">("Dr");
  const [openingBalanceDate, setOpeningBalanceDate] = useState("2026-04-14");

  // Form states - TDS & Compliance
  const [subjectToTds, setSubjectToTds] = useState(false);
  const [tdsType, setTdsType] = useState<TdsType>(TdsType.NONE);
  const [tdsRate, setTdsRate] = useState<number>(0);

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 1. SMART CODE SEEDING & TAB NAVIGATION
  useEffect(() => {
    if (party) {
      setCode(party.code);
      setName(party.name);
      setNameNepali(party.nameNepali || "");

      // Determine type choice based on combined isBoth indicator or type
      if ((party as any).isBoth) {
        setSelectedType("both");
      } else {
        setSelectedType(party.type === PartyType.CUSTOMER ? "customer" : "supplier");
      }

      setPan(party.pan || "");
      setVatNo(party.vatNo || "");
      setContactPerson(party.contactPerson || "");
      setPhone(party.phone || "");
      setEmail(party.email || "");
      setWebsite(party.website || "");

      setAddress(party.address || "");
      setAddressNepali(party.addressNepali || "");
      setCity(party.city || "");
      setProvince(party.province || "");
      setWardNo(party.wardNo || "");
      setCountry(party.country || "Nepal");

      setBankName(party.bankName || "");
      setBankAccountNo(party.bankAccountNo || "");
      setBankBranch(party.bankBranch || "");

      setCreditLimit(party.creditLimit || 0);
      setCreditDays(party.creditDays || 0);
      setOpeningBalance(party.openingBalance || 0);
      setOpeningBalanceType(party.openingBalanceType || "Dr");
      setOpeningBalanceDate(party.openingBalanceDate || "2026-04-14");

      setSubjectToTds(!!party.subjectToTds);
      setTdsType(party.tdsType || TdsType.NONE);
      setTdsRate(party.tdsRate || 0);
    } else {
      // Direct auto generation for new partner files
      generateDynamicCode(selectedType);
    }
  }, [party]);

  const generateDynamicCode = (typeChoice: "customer" | "supplier" | "both") => {
    const prefix = typeChoice === "customer" ? "CUST" : typeChoice === "supplier" ? "SUPP" : "PART";
    const matches = partiesList.filter((p) => p.code.startsWith(prefix));
    let maxVal = 0;

    matches.forEach((p) => {
      const parts = p.code.split("-");
      if (parts[1]) {
        const val = parseInt(parts[1], 10);
        if (!isNaN(val) && val > maxVal) {
          maxVal = val;
        }
      }
    });

    const nextCodeNum = maxVal + 1;
    setCode(`${prefix}-${String(nextCodeNum).padStart(3, "0")}`);
  };

  const handleTypeChange = (value: "customer" | "supplier" | "both") => {
    setSelectedType(value);
    if (!party) {
      generateDynamicCode(value);
    }
  };

  // Auto rate population on TDS classification selection
  const handleTdsTypeChange = (val: string) => {
    const selectedTdsType = val as TdsType;
    setTdsType(selectedTdsType);
    const resolvedRate = TDS_RATES[selectedTdsType] !== undefined ? TDS_RATES[selectedTdsType] : 0;
    setTdsRate(resolvedRate);
  };

  // 2. COMPREHENSIVE FORM VALIDATION CONTROL
  const validateForm = (): boolean => {
    const tempErrors: Record<string, string> = {};

    if (!name.trim()) {
      tempErrors.name = "Party Legal Name (English) is required.";
    }

    if (!phone.trim()) {
      tempErrors.phone = "Primary Contact Phone number is required.";
    } else if (!/^[0-9\-\+\s]{7,15}$/.test(phone)) {
      tempErrors.phone = "Please specify a valid numeric phone number.";
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      tempErrors.email = "Specified email address format is invalid.";
    }

    if (pan.trim()) {
      if (pan.trim().length !== 9 || !/^\d+$/.test(pan)) {
        tempErrors.pan =
          "Nepalese Taxpayer Permanent Account Number (PAN) must be exactly 9 digits.";
      }
    }

    setErrors(tempErrors);

    if (Object.keys(tempErrors).length > 0) {
      // Jump to basic tab if any errors belong to Basic Info
      if (tempErrors.name || tempErrors.phone || tempErrors.email || tempErrors.pan) {
        setActiveTab("basic");
      }
      toast.error("Validation Error: Please resolve highlighted entries.");
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Build finalized schema payload
    // Map both or supplier/customer roles securely
    const finalType = selectedType === "supplier" ? PartyType.SUPPLIER : PartyType.CUSTOMER;
    const isBothChoice = selectedType === "both";

    // Account ID Mapping Auto Choice
    const resolvedAccountId =
      finalType === PartyType.CUSTOMER ? "acc-sundry-debtors" : "acc-sundry-creditors";

    const payload: Partial<Party> = {
      id: party?.id,
      code: code.trim(),
      name: name.trim(),
      nameNepali: nameNepali.trim() || undefined,
      type: finalType,
      pan: pan.trim() || undefined,
      vatNo: vatNo.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      phone: phone.trim(),
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      address: address.trim() || undefined,
      addressNepali: addressNepali.trim() || undefined,
      city: city.trim() || undefined,
      province: province || undefined,
      wardNo: wardNo.trim() || undefined,
      country: country || "Nepal",
      bankName: bankName.trim() || undefined,
      bankAccountNo: bankAccountNo.trim() || undefined,
      bankBranch: bankBranch.trim() || undefined,
      creditLimit: Number(creditLimit) || 0,
      creditDays: Number(creditDays) || 0,
      openingBalance: Number(openingBalance) || 0,
      openingBalanceType,
      openingBalanceDate,
      subjectToTds,
      tdsType: subjectToTds ? tdsType : TdsType.NONE,
      tdsRate: subjectToTds ? Number(tdsRate) : 0,
      isActive: party ? party.isActive : true,
      accountId: resolvedAccountId,
      balance: party ? party.balance : 0,
      status: party ? party.status : "active",
      // Store flag for composite roles
      ...({ isBoth: isBothChoice } as any),
    };

    onSave(payload);
  };

  // Determine indicator warning state for PAN requirement above 10,000 Rs transactions
  const showPanWarning = subjectToTds && (!pan || pan.trim().length !== 9);

  const isEdit = !!party;

  return (
    <div className="flex flex-col h-full bg-white text-xs text-gray-700">
      {/* Form Header */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0 select-none">
        <h3 className="text-[13px] font-semibold text-gray-800">
          {isEdit ? "Edit Party" : "New Party"}
        </h3>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6"
      >
        {/* Section 1: Basic Information */}
        <div>
          <div className="section-header text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Basic Information
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Partner Registration Code (Auto)"
              value={code}
              onChange={setCode}
              required
              disabled={true}
              error={errors.code}
              placeholder="e.g. CUST-012"
            />

            <div className="flex flex-col gap-1">
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                Corporate Role Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4 items-center bg-white border border-gray-300 rounded-md px-3 h-8 text-[12px]">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-normal text-gray-700 select-none">
                  <input
                    type="radio"
                    name="roleType"
                    checked={selectedType === "customer"}
                    onChange={() => handleTypeChange("customer")}
                    className="accent-[#1557b0] h-4 w-4"
                  />
                  <span>Customer</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-normal text-gray-700 select-none">
                  <input
                    type="radio"
                    name="roleType"
                    checked={selectedType === "supplier"}
                    onChange={() => handleTypeChange("supplier")}
                    className="accent-[#1557b0] h-4 w-4"
                  />
                  <span>Supplier</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-normal text-gray-700 select-none">
                  <input
                    type="radio"
                    name="roleType"
                    checked={selectedType === "both"}
                    onChange={() => handleTypeChange("both")}
                    className="accent-[#1557b0] h-4 w-4"
                  />
                  <span>Both</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <Input
              label="Partner Trading Name (English)"
              placeholder="e.g. Syakar Trading Company Pvt. Ltd."
              value={name}
              onChange={setName}
              required
              error={errors.name}
            />
            <Input
              label="Partner Trading Name (Nepali / देवनागरी)"
              placeholder="जस्तै: स्याकार ट्रेडिङ कम्पनी प्रा. लि."
              value={nameNepali}
              onChange={setNameNepali}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <Input
              label="Contact Phone / Mobile"
              placeholder="e.g. 9851084920"
              value={phone}
              onChange={setPhone}
              required
              error={errors.phone}
            />
            <Input
              label="Billing Email Address"
              placeholder="e.g. finance@syakar.com"
              type="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
            />
            <Input
              label="Corporate Site URL / Contact Person"
              placeholder="e.g. www.syakar.com"
              value={website || contactPerson}
              onChange={(val) => {
                setWebsite(val);
                setContactPerson(val);
              }}
            />
          </div>
        </div>

        {/* Section 2: Address */}
        <div>
          <div className="section-header text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">
            Address
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Street Address (English)"
              placeholder="e.g. Kantipath Link Road"
              value={address}
              onChange={setAddress}
            />
            <Input
              label="Street Address (Nepali)"
              placeholder="जस्तै: कान्तिपथ लिङ्क रोड"
              value={addressNepali}
              onChange={setAddressNepali}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
            <Input label="City" placeholder="e.g. Kathmandu" value={city} onChange={setCity} />
            <Select
              label="State / Province"
              options={NEPAL_PROVINCES.map((p) => ({ value: p, label: p }))}
              value={province}
              onChange={setProvince}
            />
            <Input label="Ward Number" placeholder="e.g. 3" value={wardNo} onChange={setWardNo} />
            <Input label="Country" value={country} onChange={setCountry} required />
          </div>
        </div>

        {/* Section 3: Tax & Registration */}
        <div>
          <div className="section-header text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">
            Tax & Registration
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Corporate PAN (9-Digit)"
              placeholder="e.g. 301290384"
              value={pan}
              onChange={setPan}
              maxLength={9}
              error={errors.pan}
            />
            <Input
              label="VAT Registration Number"
              placeholder="e.g. 123456789"
              value={vatNo}
              onChange={setVatNo}
            />
          </div>

          <div className="mt-4 bg-slate-50 p-4 border rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="block text-[11px] font-medium text-gray-600 mb-0.5">
                  Is partner subject to TDS withholding?
                </span>
                <span className="text-[11px] text-gray-400">
                  Enabling this automatically calculates matching TDS on vouchers.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSubjectToTds(!subjectToTds)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                  ${subjectToTds ? "bg-[#1557b0]" : "bg-gray-200"}
                `}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                    ${subjectToTds ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </button>
            </div>

            {subjectToTds && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-3 bg-white border rounded-md animate-fadeIn">
                <Select
                  label="Govt TDS Category"
                  options={[
                    { value: TdsType.NONE, label: "Select classification..." },
                    { value: TdsType.CONTRACTOR, label: "Contractor and Sub-Contract (1.5%)" },
                    { value: TdsType.CONSULTANCY, label: "Consultancy and Service Fee (15%)" },
                    { value: TdsType.RENT, label: "Rent and Lease Withholding (10%)" },
                    { value: TdsType.SALARY, label: "Salary Income (15%)" },
                    { value: TdsType.DIVIDEND, label: "Dividends Withholding (5%)" },
                    { value: TdsType.COMMISSION, label: "Commissions Remunerations (10%)" },
                    { value: TdsType.OTHER, label: "Other Special Withholding Rates (5%)" },
                  ]}
                  value={tdsType}
                  onChange={handleTdsTypeChange}
                  required
                />
                <Input
                  label="Custom TDS Rate"
                  type="number"
                  value={tdsRate}
                  onChange={(v) => {
                    const val = parseFloat(v);
                    setTdsRate(isNaN(val) ? 0 : val);
                  }}
                  suffix="%"
                  align="center"
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Credit Terms */}
        <div>
          <div className="section-header text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">
            Credit Terms
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Approved Credit Limit"
              type="number"
              value={creditLimit}
              onChange={(v) => {
                const val = parseFloat(v);
                setCreditLimit(isNaN(val) ? 0 : val);
              }}
              prefix="Rs."
              align="right"
              placeholder="0 = No limit"
            />
            <Input
              label="Approved Credit Days"
              type="number"
              value={creditDays}
              onChange={(v) => {
                const val = parseInt(v);
                setCreditDays(isNaN(val) ? 0 : val);
              }}
              suffix="Days"
              align="center"
              placeholder="0 = COD"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <Input
              label="Opening Balance"
              type="number"
              value={openingBalance}
              onChange={(v) => {
                const val = parseFloat(v);
                setOpeningBalance(isNaN(val) ? 0 : val);
              }}
              prefix="Rs."
              align="right"
            />

            <div className="flex flex-col gap-1">
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                Balance Type (Dr/Cr)
              </label>
              <div className="flex gap-4 items-center bg-white border border-gray-300 rounded-md px-3 h-8 text-[12px]">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-normal text-gray-700 select-none">
                  <input
                    type="radio"
                    name="openingBalanceType"
                    checked={openingBalanceType === "Dr"}
                    onChange={() => setOpeningBalanceType("Dr")}
                    className="accent-[#1557b0]"
                  />
                  <span>Dr (Receivable)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-normal text-gray-700 select-none">
                  <input
                    type="radio"
                    name="openingBalanceType"
                    checked={openingBalanceType === "Cr"}
                    onChange={() => setOpeningBalanceType("Cr")}
                    className="accent-[#1557b0]"
                  />
                  <span>Cr (Payable)</span>
                </label>
              </div>
            </div>

            <Input
              label="As of Date"
              type="date"
              value={openingBalanceDate}
              onChange={setOpeningBalanceDate}
            />
          </div>

          {/* Optional Bank details at the bottom of Credit Terms */}
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-slate-50">
            <label className="block text-[11px] font-medium text-gray-600 mb-2">
              Default Banking Details
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Bank Name"
                placeholder="e.g. Nabil Bank Ltd."
                value={bankName}
                onChange={setBankName}
              />
              <Input
                label="Account Number"
                placeholder="e.g. 01201049283711"
                value={bankAccountNo}
                onChange={setBankAccountNo}
              />
              <Input
                label="Branch"
                placeholder="e.g. Teendhara"
                value={bankBranch}
                onChange={setBankBranch}
              />
            </div>
          </div>
        </div>
      </form>

      {/* Form Footer */}
      <div className="border-t border-gray-200 p-4 flex justify-end gap-2 shrink-0 select-none bg-gray-50">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleSubmit}>
          Save
        </Button>
      </div>
    </div>
  );
};

export default PartyForm;
