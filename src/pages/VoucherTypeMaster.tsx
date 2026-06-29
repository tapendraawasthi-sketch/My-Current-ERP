// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Input, Select, ActionToolbar } from "../components/ui";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Settings,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";
import { VOUCHER_TYPE_LABELS, getVoucherGroupForType } from "../lib/voucherUtils";

const VoucherTypeMaster: React.FC = () => {
  const {
    voucherTypeMasters,
    addVoucherTypeMaster,
    updateVoucherTypeMaster,
    deleteVoucherTypeMaster,
    loadVoucherTypeMasters,
  } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGroupFilter, setActiveGroupFilter] = useState("all");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState({
    name: "",
    alias: "",
    abbreviation: "",
    parentVoucherType: "",
    voucherGroup: "",
    isPredefined: false,
    isActive: true,
    numberingMethod: "automatic",
    prefix: "",
    suffix: "",
    startingNumber: 1,
    restartPeriod: "never",
    preventDuplicateNumber: false,
    allowManualOverride: false,
    warnOnDuplicate: true,
    useEffectiveDate: false,
    allowZeroValue: false,
    optionalByDefault: false,
    allowCommonNarration: true,
    allowLedgerNarration: false,
    printAfterSaving: false,
    useForPOS: false,
    defaultPrintTitle: "",
    defaultBankLedgerId: "",
    defaultJurisdiction: "",
    declarationText: "",
    enableDefaultAllocations: false,
    whatsAppAfterSaving: false,
  });

  useEffect(() => {
    loadVoucherTypeMasters();
  }, []);

  const filteredVoucherTypes = useMemo(() => {
    return voucherTypeMasters
      .filter((vtm) => {
        const matchesSearch =
          vtm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vtm.abbreviation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vtm.parentVoucherType.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesGroup = activeGroupFilter === "all" || vtm.voucherGroup === activeGroupFilter;

        return matchesSearch && matchesGroup;
      })
      .sort((a, b) => {
        if (a.isPredefined && !b.isPredefined) return -1;
        if (!a.isPredefined && b.isPredefined) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [voucherTypeMasters, searchTerm, activeGroupFilter]);

  const activeCount = useMemo(() => {
    return filteredVoucherTypes.filter((vtm) => vtm.isActive).length;
  }, [filteredVoucherTypes]);

  const handleFormChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    // Auto-update voucherGroup when parentVoucherType changes
    if (field === "parentVoucherType") {
      const group = getVoucherGroupForType(value);
      setForm((prev) => ({ ...prev, voucherGroup: group }));
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      alias: "",
      abbreviation: "",
      parentVoucherType: "",
      voucherGroup: "",
      isPredefined: false,
      isActive: true,
      numberingMethod: "automatic",
      prefix: "",
      suffix: "",
      startingNumber: 1,
      restartPeriod: "never",
      preventDuplicateNumber: false,
      allowManualOverride: false,
      warnOnDuplicate: true,
      useEffectiveDate: false,
      allowZeroValue: false,
      optionalByDefault: false,
      allowCommonNarration: true,
      allowLedgerNarration: false,
      printAfterSaving: false,
      useForPOS: false,
      defaultPrintTitle: "",
      defaultBankLedgerId: "",
      defaultJurisdiction: "",
      declarationText: "",
      enableDefaultAllocations: false,
      whatsAppAfterSaving: false,
    });
    setSelected(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Voucher type name is required");
      return;
    }

    if (!form.parentVoucherType) {
      toast.error("Parent voucher type is required");
      return;
    }

    try {
      // Auto-set voucher group based on parent type
      const voucherGroup = getVoucherGroupForType(form.parentVoucherType);
      const formData = { ...form, voucherGroup };

      if (selected && selected.isPredefined) {
        // For predefined types, only allow specific fields to be updated
        const allowedFields = [
          "isActive",
          "printAfterSaving",
          "useForPOS",
          "defaultPrintTitle",
          "defaultBankLedgerId",
          "defaultJurisdiction",
          "declarationText",
          "allowCommonNarration",
          "allowLedgerNarration",
          "whatsAppAfterSaving",
        ];

        const filteredData: any = {};
        allowedFields.forEach((field) => {
          filteredData[field] = formData[field];
        });

        await updateVoucherTypeMaster(selected.id, filteredData);
      } else if (selected) {
        await updateVoucherTypeMaster(selected.id, formData);
      } else {
        await addVoucherTypeMaster(formData);
      }

      toast.success("Voucher type saved successfully");
      resetForm();
    } catch (error) {
      toast.error(error.message || "Failed to save voucher type");
    }
  };

  const loadFormForEdit = (record: any) => {
    setForm({
      ...record,
      parentVoucherType: record.parentVoucherType,
      voucherGroup: record.voucherGroup,
      isPredefined: record.isPredefined,
      numberingMethod: record.numberingMethod || "automatic",
      startingNumber: record.startingNumber || 1,
      restartPeriod: record.restartPeriod || "never",
    });
    setSelected(record);
    setShowForm(true);
    // Scroll to form
    setTimeout(() => {
      const formElement = document.getElementById("voucher-type-form");
      if (formElement) {
        formElement.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete voucher type "${name}"?`)) {
      return;
    }

    try {
      await deleteVoucherTypeMaster(id);
      toast.success("Voucher type deleted successfully");
    } catch (error) {
      toast.error(error.message || "Failed to delete voucher type");
    }
  };

  const toggleActive = async (record: any) => {
    try {
      const updatedRecord = { ...record, isActive: !record.isActive };
      await updateVoucherTypeMaster(record.id, { isActive: !record.isActive });
      toast.success(
        `Voucher type ${updatedRecord.isActive ? "activated" : "deactivated"} successfully`,
      );
    } catch (error) {
      toast.error(error.message || "Failed to update voucher type status");
    }
  };

  const voucherTypeOptions = Object.entries(VOUCHER_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const groupColors: Record<string, string> = {
    accounting: "bg-blue-100 text-blue-700",
    inventory: "bg-green-100 text-green-700",
    order: "bg-orange-100 text-orange-700",
    payroll: "bg-purple-100 text-purple-700",
    other: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-green-700 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Voucher Type Master
          </h1>
        </div>

        <ActionToolbar className="mb-4">
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Voucher Type
          </Button>

          <Input
            placeholder="Search voucher types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
        </ActionToolbar>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            className={`px-3 py-1 rounded-full text-sm ${
              activeGroupFilter === "all"
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => setActiveGroupFilter("all")}
          >
            All
          </button>
          {["accounting", "inventory", "order", "payroll", "other"].map((group) => (
            <button
              key={group}
              className={`px-3 py-1 rounded-full text-sm capitalize ${
                activeGroupFilter === group
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              onClick={() => setActiveGroupFilter(group)}
            >
              {group}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-600">
          {filteredVoucherTypes.length} Voucher Types ({activeCount} active)
        </p>
      </div>

      {/* Form Panel */}
      {showForm && (
        <Card className="mb-6" id="voucher-type-form">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">
              {selected ? "Edit Voucher Type" : "New Voucher Type"}
            </h2>

            {selected?.isPredefined && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md mb-4 text-sm text-yellow-700">
                (Predefined type — some fields restricted)
              </div>
            )}

            {/* Basic Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voucher Type Name*
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  disabled={selected?.isPredefined}
                  placeholder="Enter voucher type name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alias</label>
                <Input
                  value={form.alias}
                  onChange={(e) => handleFormChange("alias", e.target.value)}
                  disabled={selected?.isPredefined}
                  placeholder="Enter alias"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Abbreviation</label>
                <Input
                  value={form.abbreviation}
                  onChange={(e) => handleFormChange("abbreviation", e.target.value.slice(0, 5))}
                  disabled={selected?.isPredefined}
                  placeholder="Max 5 chars"
                  maxLength={5}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type of Voucher / Parent*
                </label>
                <Select
                  value={form.parentVoucherType}
                  onChange={(value) => handleFormChange("parentVoucherType", value)}
                  disabled={selected?.isPredefined}
                  options={voucherTypeOptions}
                  placeholder="Select parent type"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voucher Group
                </label>
                <Input
                  value={form.voucherGroup}
                  readOnly
                  placeholder="Auto-filled from parent"
                  className="bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Active</label>
                <Select
                  value={form.isActive ? "true" : "false"}
                  onChange={(value) => handleFormChange("isActive", value === "true")}
                  options={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                />
              </div>
            </div>

            {/* Numbering Section */}
            <div className="border-t pt-4 mb-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <h3 className="font-medium text-gray-900">Numbering</h3>
                {showAdvanced ? <ChevronUp /> : <ChevronDown />}
              </div>

              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Method of Numbering
                    </label>
                    <Select
                      value={form.numberingMethod}
                      onChange={(value) => handleFormChange("numberingMethod", value)}
                      options={[
                        { value: "automatic", label: "Automatic" },
                        { value: "manual", label: "Manual" },
                        { value: "multi-user-automatic", label: "Multi-User Automatic" },
                        { value: "none", label: "None" },
                      ]}
                    />
                  </div>

                  {(form.numberingMethod === "automatic" ||
                    form.numberingMethod === "multi-user-automatic") && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Starting Number
                        </label>
                        <Input
                          type="number"
                          value={form.startingNumber}
                          onChange={(e) =>
                            handleFormChange("startingNumber", parseInt(e.target.value) || 1)
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Prefix
                        </label>
                        <Input
                          value={form.prefix}
                          onChange={(e) => handleFormChange("prefix", e.target.value)}
                          placeholder="e.g., SI-"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Suffix
                        </label>
                        <Input
                          value={form.suffix}
                          onChange={(e) => handleFormChange("suffix", e.target.value)}
                          placeholder="e.g., -INV"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Restart Numbering
                    </label>
                    <Select
                      value={form.restartPeriod}
                      onChange={(value) => handleFormChange("restartPeriod", value)}
                      options={[
                        { value: "never", label: "Never" },
                        { value: "daily", label: "Daily" },
                        { value: "monthly", label: "Monthly" },
                        { value: "yearly", label: "Financial Year" },
                        { value: "financial-year", label: "Financial Year" },
                      ]}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.preventDuplicateNumber}
                      onChange={(e) => handleFormChange("preventDuplicateNumber", e.target.checked)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Prevent Duplicate Numbers
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.allowManualOverride}
                      onChange={(e) => handleFormChange("allowManualOverride", e.target.checked)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Allow Manual Override
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.warnOnDuplicate}
                      onChange={(e) => handleFormChange("warnOnDuplicate", e.target.checked)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <label className="text-sm font-medium text-gray-700">Warn on Duplicate</label>
                  </div>
                </div>
              )}
            </div>

            {/* Behavior Section */}
            <div className="border-t pt-4 mb-4">
              <div className="flex items-center justify-between cursor-pointer">
                <h3 className="font-medium text-gray-900">Behavior</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.useEffectiveDate}
                    onChange={(e) => handleFormChange("useEffectiveDate", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">Use Effective Dates</label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.allowZeroValue}
                    onChange={(e) => handleFormChange("allowZeroValue", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Allow Zero Value Transactions
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.optionalByDefault}
                    onChange={(e) => handleFormChange("optionalByDefault", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Make Optional by Default
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.allowCommonNarration}
                    onChange={(e) => handleFormChange("allowCommonNarration", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Allow Common Narration
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.allowLedgerNarration}
                    onChange={(e) => handleFormChange("allowLedgerNarration", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Allow Ledger Narration
                  </label>
                </div>
              </div>
            </div>

            {/* Printing Section */}
            <div className="border-t pt-4 mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Printing</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.printAfterSaving}
                    onChange={(e) => handleFormChange("printAfterSaving", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">Print After Saving</label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.useForPOS}
                    onChange={(e) => handleFormChange("useForPOS", e.target.checked)}
                    disabled={form.parentVoucherType !== "sales-invoice"}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">Use for POS Invoicing</label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Print Title
                  </label>
                  <Input
                    value={form.defaultPrintTitle}
                    onChange={(e) => handleFormChange("defaultPrintTitle", e.target.value)}
                    placeholder="e.g., Sales Invoice"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Jurisdiction
                  </label>
                  <Input
                    value={form.defaultJurisdiction}
                    onChange={(e) => handleFormChange("defaultJurisdiction", e.target.value)}
                    placeholder="e.g., Nepal"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Declaration Text
                  </label>
                  <textarea
                    value={form.declarationText}
                    onChange={(e) => handleFormChange("declarationText", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter declaration text..."
                  />
                </div>
              </div>
            </div>

            {/* Sharing Section */}
            <div className="border-t pt-4 mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Sharing</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.whatsAppAfterSaving}
                    onChange={(e) => handleFormChange("whatsAppAfterSaving", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Send via WhatsApp After Saving
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.enableDefaultAllocations}
                    onChange={(e) => handleFormChange("enableDefaultAllocations", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Enable Default Allocations
                  </label>
                </div>
              </div>
            </div>

            {/* Form Buttons */}
            <div className="flex space-x-2 pt-4 border-t">
              <Button variant="primary" onClick={handleSubmit} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save
              </Button>
              <Button variant="secondary" onClick={resetForm} className="flex items-center gap-2">
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* List Section */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parent Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Group
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Abbr
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVoucherTypes.map((vtm, index) => (
                <tr key={vtm.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{vtm.name}</div>
                    {vtm.alias && <div className="text-sm text-gray-500">{vtm.alias}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {VOUCHER_TYPE_LABELS[vtm.parentVoucherType] || vtm.parentVoucherType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="outline" className={groupColors[vtm.voucherGroup]}>
                      {vtm.voucherGroup}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vtm.abbreviation}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vtm.numberingMethod
                      .replace(/-/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={vtm.isActive ? "success" : "destructive"}>
                      {vtm.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => loadFormForEdit(vtm)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => toggleActive(vtm)}
                        className={
                          vtm.isActive
                            ? "text-red-600 hover:text-red-900"
                            : "text-green-600 hover:text-green-900"
                        }
                        title={vtm.isActive ? "Deactivate" : "Activate"}
                      >
                        {vtm.isActive ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>

                      {vtm.isPredefined ? (
                        <button
                          disabled
                          className="text-gray-400 cursor-not-allowed"
                          title="Predefined types cannot be deleted"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(vtm.id, vtm.name)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredVoucherTypes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No voucher types found. Create your first voucher type using the "New Voucher Type"
            button.
          </div>
        )}
      </Card>
    </div>
  );
};

export default VoucherTypeMaster;
