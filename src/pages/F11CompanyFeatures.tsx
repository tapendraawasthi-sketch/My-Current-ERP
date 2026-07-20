// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import toast from "@/lib/appToast";
import { useStore } from "../store/useStore";
import { useTallyKeyboard } from "../hooks/useTallyKeyboard";
import {
  BUSINESS_NATURES,
  applyNatureToCompanySettings,
  getNatureProfile,
} from "@/lib/businessNature";

interface CompanyFeatures {
  show_more_features: boolean;
  show_all_features: boolean;
  maintain_accounts: boolean;
  enable_bill_wise_entry: boolean;
  enable_cost_centres: boolean;
  enable_interest_calculation: boolean;
  maintain_inventory: boolean;
  integrate_accounts_with_inventory: boolean;
  enable_multiple_price_levels: boolean;
  enable_batches: boolean;
  maintain_expiry_date_for_batches: boolean;
  enable_job_order_processing: boolean;
  enable_cost_tracking: boolean;
  use_discount_column_in_invoices: boolean;
  use_separate_actual_billed_qty: boolean;
  enable_gst: boolean;
  gst_registration_type: string;
  gstin: string;
  gst_applicable_from: string;
  enable_tds: boolean;
  tan_number: string;
  tds_applicable_from: string;
  enable_tcs: boolean;
  tcs_applicable_from: string;
  enable_vat: boolean;
  vat_registration_number: string;
  vat_applicable_from: string;
  enable_excise: boolean;
  excise_registration_number: string;
  enable_service_tax: boolean;
  service_tax_registration_number: string;
  enable_browser_access_for_reports: boolean;
  enable_remote_access_sync: boolean;
  maintain_payroll: boolean;
  enable_payroll_statutory: boolean;
  pf_registration_number: string;
  esi_registration_number: string;
  enable_multiple_addresses: boolean;
  mark_modified_vouchers: boolean;
  mailing_details_in_local_language: boolean;
}

const defaultState: CompanyFeatures = {
  show_more_features: false,
  show_all_features: false,
  maintain_accounts: true,
  enable_bill_wise_entry: false,
  enable_cost_centres: false,
  enable_interest_calculation: false,
  maintain_inventory: true,
  integrate_accounts_with_inventory: false,
  enable_multiple_price_levels: false,
  enable_batches: false,
  maintain_expiry_date_for_batches: false,
  enable_job_order_processing: false,
  enable_cost_tracking: false,
  use_discount_column_in_invoices: false,
  use_separate_actual_billed_qty: false,
  enable_gst: false,
  gst_registration_type: "",
  gstin: "",
  gst_applicable_from: "",
  enable_tds: false,
  tan_number: "",
  tds_applicable_from: "",
  enable_tcs: false,
  tcs_applicable_from: "",
  enable_vat: false,
  vat_registration_number: "",
  vat_applicable_from: "",
  enable_excise: false,
  excise_registration_number: "",
  enable_service_tax: false,
  service_tax_registration_number: "",
  enable_browser_access_for_reports: false,
  enable_remote_access_sync: false,
  maintain_payroll: false,
  enable_payroll_statutory: false,
  pf_registration_number: "",
  esi_registration_number: "",
  enable_multiple_addresses: false,
  mark_modified_vouchers: false,
  mailing_details_in_local_language: false,
};

const F11CompanyFeatures = () => {
  const [features, setFeatures] = useState<CompanyFeatures>(defaultState);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("accounting");
  const [businessNature, setBusinessNature] = useState("");
  const [natureDirty, setNatureDirty] = useState(false);
  const { setCurrentPage, companySettings, updateCompanySettings } = useStore();

  const natureHint = useMemo(() => {
    if (!businessNature) return "";
    return getNatureProfile(businessNature).hint;
  }, [businessNature]);

  useEffect(() => {
    setBusinessNature(companySettings?.businessNature || "");
  }, [companySettings?.businessNature]);

  const applyNaturePreset = (natureId: string) => {
    setBusinessNature(natureId);
    setNatureDirty(true);
    const profile = getNatureProfile(natureId);
    setFeatures((prev) => ({
      ...prev,
      maintain_inventory: profile.features.enableInventory,
      enable_batches: profile.features.enableBatchTracking,
      enable_job_order_processing: profile.features.enableJobWork || profile.features.enableProduction,
      enable_cost_centres: profile.features.enableCostCenter,
      enable_cost_tracking: profile.features.enableCostCenter,
      maintain_payroll: profile.features.enablePayroll,
      enable_bill_wise_entry: profile.features.enableBillWiseTracking,
    }));
    setIsDirty(true);
  };

  const saveBusinessNature = async () => {
    if (!businessNature) {
      toast.error("Select a business nature first.");
      return;
    }
    try {
      const patched = applyNatureToCompanySettings(
        { ...(companySettings || {}), name: companySettings?.name || companySettings?.companyNameEn || "Company" },
        businessNature,
      );
      await updateCompanySettings(patched);
      setNatureDirty(false);
      toast.success("Business nature applied. Sidebar menus updated.");
    } catch {
      toast.error("Could not save business nature.");
    }
  };

  const fetchFeatures = async () => {
    try {
      const response = await fetch("/api/company-features");
      if (!response.ok) throw new Error("Failed to fetch features");
      const data = await response.json();
      if (data.success) {
        setFeatures((prev) => ({ ...prev, ...data.data }));
      }
    } catch (error) {
      toast.error("Error loading company features");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const handleToggle = (field: keyof CompanyFeatures, value: boolean) => {
    setFeatures((prev) => {
      const newState = { ...prev, [field]: value };

      // Handle auto-dependencies
      if (field === "show_all_features" && value) {
        newState.show_more_features = true;
      }
      if (field === "show_more_features" && !value) {
        newState.show_all_features = false;
      }
      if (field === "maintain_accounts" && !value) {
        newState.enable_bill_wise_entry = false;
        newState.enable_cost_centres = false;
        newState.enable_interest_calculation = false;
      }
      if (field === "maintain_inventory" && !value) {
        newState.enable_batches = false;
        newState.maintain_expiry_date_for_batches = false;
        newState.enable_job_order_processing = false;
        newState.enable_cost_tracking = false;
        newState.enable_multiple_price_levels = false;
      }
      if (field === "enable_batches" && !value) {
        newState.maintain_expiry_date_for_batches = false;
      }
      if (field === "maintain_payroll" && !value) {
        newState.enable_payroll_statutory = false;
      }

      return newState;
    });
    setIsDirty(true);
  };

  const handleTextChange = (field: keyof CompanyFeatures, value: string) => {
    setFeatures((prev) => ({
      ...prev,
      [field]: value,
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/company-features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(features),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Company features saved successfully. (Ctrl+A)");
        setIsDirty(false);
      } else {
        toast.error(json.error || "Failed to save company features.");
      }
    } catch (err) {
      toast.error("Network error. Could not save.");
    } finally {
      setIsSaving(false);
    }
  };

  useTallyKeyboard({
    onCtrlA: handleSave,
    onEscape: () => {
      if (isDirty) {
        if (window.confirm("Unsaved changes. Discard and exit?")) {
          setCurrentPage("gateway");
        }
      } else {
        setCurrentPage("gateway");
      }
    },
  });

  const FeatureRow = ({
    label,
    description,
    field,
    value,
    onToggle,
    disabled = false,
    disabledReason = "",
    visible = true,
  }) => {
    if (!visible) return null;

    return (
      <div
        style={{
          borderBottom: "1px solid #ccc",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: disabled ? "normal" : "bold" }}>{label}</div>
          <div style={{ fontSize: 11, color: "#555" }}>{description}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {disabled && (
            <span title={disabledReason} style={{ fontSize: 12 }}>
              🔒
            </span>
          )}
          <span
            onClick={!disabled ? () => onToggle(field, true) : undefined}
            style={{
              padding: "2px 8px",
              background: value ? "var(--ds-action-primary)" : "var(--ds-surface-muted)",
              color: value ? "#fff" : "#374151",
              border: value ? "none" : "1px solid #888",
              cursor: disabled ? "not-allowed" : "pointer",
              pointerEvents: disabled ? "none" : "auto",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Yes
          </span>
          <span
            onClick={!disabled ? () => onToggle(field, false) : undefined}
            style={{
              padding: "2px 8px",
              background: !value ? "var(--ds-action-primary)" : "var(--ds-surface-muted)",
              color: !value ? "#fff" : "#374151",
              border: !value ? "none" : "1px solid #888",
              cursor: disabled ? "not-allowed" : "pointer",
              pointerEvents: disabled ? "none" : "auto",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            No
          </span>
        </div>
      </div>
    );
  };

  if (isLoading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--ds-surface-muted)",
          fontFamily: "monospace",
        }}
      >
        <span>Loading Company Features...</span>
      </div>
    );

  // Taxation Section
  const TaxationSection = () => (
    <>
      <div
        style={{ background: "var(--ds-action-primary)", color: "#fff", padding: "4px 12px", fontWeight: "bold" }}
      >
        Taxation Features — Nepal first
      </div>
      <FeatureRow
        label="Enable Value Added Tax (VAT)"
        description="Nepal VAT — invoices, input/output tax, returns and exception reports"
        field="enable_vat"
        value={features.enable_vat}
        onToggle={handleToggle}
        disabled={!features.maintain_accounts}
        disabledReason="Requires Maintain Accounts"
        visible={true}
      />
      {features.enable_vat && (
        <>
          <div
            style={{
              padding: "4px 12px 4px 28px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label>VAT Registration No.:</label>
            <input
              type="text"
              value={features.vat_registration_number}
              onChange={(e) => handleTextChange("vat_registration_number", e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: "2px 6px",
                fontFamily: "monospace",
                fontSize: 13,
                width: 200,
              }}
            />
          </div>
          <div
            style={{
              padding: "4px 12px 4px 28px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label>VAT Applicable From:</label>
            <input
              type="date"
              value={features.vat_applicable_from}
              onChange={(e) => handleTextChange("vat_applicable_from", e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: "2px 6px",
                fontFamily: "monospace",
                fontSize: 13,
                width: 200,
              }}
            />
          </div>
        </>
      )}
      <div
        style={{
          background: "var(--ds-surface-muted)",
          color: "var(--ds-text-muted)",
          padding: "4px 12px",
          fontWeight: "bold",
          fontSize: 12,
        }}
      >
        India tax (optional — not used for Nepal companies)
      </div>
      <FeatureRow
        label="Enable Goods and Services Tax (GST)"
        description="India GST only — GSTR, HSN/SAC, e-way bill. Prefer VAT for Nepal."
        field="enable_gst"
        value={features.enable_gst}
        onToggle={handleToggle}
        disabled={!features.maintain_accounts}
        disabledReason="Requires Maintain Accounts"
        visible={true}
      />
      {features.enable_gst && (
        <>
          <div
            style={{
              padding: "4px 12px 4px 28px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label>Registration Type:</label>
            <select
              value={features.gst_registration_type}
              onChange={(e) => handleTextChange("gst_registration_type", e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: "2px 6px",
                fontFamily: "monospace",
                fontSize: 13,
                width: 200,
              }}
            >
              <option value="">--Select--</option>
              <option value="Regular">Regular</option>
              <option value="Composition">Composition</option>
              <option value="SEZ">SEZ</option>
              <option value="Unregistered">Unregistered</option>
              <option value="Consumer">Consumer</option>
            </select>
          </div>
          <div
            style={{
              padding: "4px 12px 4px 28px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label>GSTIN/UIN:</label>
            <input
              type="text"
              maxLength={15}
              value={features.gstin}
              onChange={(e) => handleTextChange("gstin", e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: "2px 6px",
                fontFamily: "monospace",
                fontSize: 13,
                width: 200,
              }}
            />
            <span style={{ fontSize: 11, color: "#555" }}>e.g. 27ABCDE1234F1Z5</span>
          </div>
          <div
            style={{
              padding: "4px 12px 4px 28px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label>Applicable From:</label>
            <input
              type="date"
              value={features.gst_applicable_from}
              onChange={(e) => handleTextChange("gst_applicable_from", e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: "2px 6px",
                fontFamily: "monospace",
                fontSize: 13,
                width: 200,
              }}
            />
          </div>
        </>
      )}
      <FeatureRow
        label="Enable Tax Deducted at Source (TDS)"
        description="Deduct TDS on contractor payments, professional fees, rent, commission — TDS challans and returns"
        field="enable_tds"
        value={features.enable_tds}
        onToggle={handleToggle}
        disabled={!features.maintain_accounts}
        disabledReason="Requires Maintain Accounts"
        visible={true}
      />
      {features.enable_tds && (
        <>
          <div
            style={{
              padding: "4px 12px 4px 28px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label>TAN Number:</label>
            <input
              type="text"
              maxLength={10}
              value={features.tan_number}
              onChange={(e) => handleTextChange("tan_number", e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: "2px 6px",
                fontFamily: "monospace",
                fontSize: 13,
                width: 200,
              }}
            />
            <span style={{ fontSize: 11, color: "#555" }}>e.g. AAAA00000A</span>
          </div>
          <div
            style={{
              padding: "4px 12px 4px 28px",
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label>Applicable From:</label>
            <input
              type="date"
              value={features.tds_applicable_from}
              onChange={(e) => handleTextChange("tds_applicable_from", e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: "2px 6px",
                fontFamily: "monospace",
                fontSize: 13,
                width: 200,
              }}
            />
          </div>
        </>
      )}
      <FeatureRow
        label="Enable Tax Collected at Source (TCS)"
        description="Collect TCS on sale of specified goods — TCS payable and returns"
        field="enable_tcs"
        value={features.enable_tcs}
        onToggle={handleToggle}
        disabled={!features.maintain_accounts}
        disabledReason="Requires Maintain Accounts"
        visible={features.show_more_features}
      />
      {features.enable_tcs && (
        <div
          style={{
            padding: "4px 12px 4px 28px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label>Applicable From:</label>
          <input
            type="date"
            value={features.tcs_applicable_from}
            onChange={(e) => handleTextChange("tcs_applicable_from", e.target.value)}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              padding: "2px 6px",
              fontFamily: "monospace",
              fontSize: 13,
              width: 200,
            }}
          />
        </div>
      )}
      <FeatureRow
        label="Enable Excise"
        description="Excise invoices, excise duty, tariff classification, excise registers and statutory reports"
        field="enable_excise"
        value={features.enable_excise}
        onToggle={handleToggle}
        disabled={!features.maintain_inventory}
        disabledReason="Requires Maintain Inventory"
        visible={features.show_all_features}
      />
      {features.enable_excise && (
        <div
          style={{
            padding: "4px 12px 4px 28px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label>Excise Reg. No.:</label>
          <input
            type="text"
            value={features.excise_registration_number}
            onChange={(e) => handleTextChange("excise_registration_number", e.target.value)}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              padding: "2px 6px",
              fontFamily: "monospace",
              fontSize: 13,
              width: 200,
            }}
          />
        </div>
      )}
      <FeatureRow
        label="Enable Service Tax"
        description="Service tax invoices, input/output service tax, service tax returns — legacy compliance"
        field="enable_service_tax"
        value={features.enable_service_tax}
        onToggle={handleToggle}
        disabled={!features.maintain_accounts}
        disabledReason="Requires Maintain Accounts"
        visible={features.show_all_features}
      />
      {features.enable_service_tax && (
        <div
          style={{
            padding: "4px 12px 4px 28px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label>Service Tax Reg. No.:</label>
          <input
            type="text"
            value={features.service_tax_registration_number}
            onChange={(e) => handleTextChange("service_tax_registration_number", e.target.value)}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              padding: "2px 6px",
              fontFamily: "monospace",
              fontSize: 13,
              width: 200,
            }}
          />
        </div>
      )}
    </>
  );

  // Online Access Section
  const OnlineAccessSection = () => (
    <>
      <div
        style={{ background: "var(--ds-action-primary)", color: "#fff", padding: "4px 12px", fontWeight: "bold" }}
      >
        Online Access Features
      </div>
      {!features.show_more_features ? (
        <div style={{ padding: "8px 12px", color: "#555", fontStyle: "italic" }}>
          Enable 'Show more features' to access Online Access settings.
        </div>
      ) : (
        <>
          <FeatureRow
            label="Enable Browser Access for Reports"
            description="View Balance Sheet, P&L, Stock Summary and other reports in a browser from any device"
            field="enable_browser_access_for_reports"
            value={features.enable_browser_access_for_reports}
            onToggle={handleToggle}
            visible={features.show_more_features}
          />
          <FeatureRow
            label="Enable Remote Access & Synchronisation (Tally.NET)"
            description="Sync company data across branches, remote user login, centralised access"
            field="enable_remote_access_sync"
            value={features.enable_remote_access_sync}
            onToggle={handleToggle}
            visible={features.show_more_features}
          />
        </>
      )}
    </>
  );

  // Payroll Section
  const PayrollSection = () => (
    <>
      <div
        style={{ background: "var(--ds-action-primary)", color: "#fff", padding: "4px 12px", fontWeight: "bold" }}
      >
        Payroll Features
      </div>
      {!features.show_more_features ? (
        <div style={{ padding: "8px 12px", color: "#555", fontStyle: "italic" }}>
          Enable 'Show more features' to access Payroll settings.
        </div>
      ) : (
        <>
          <FeatureRow
            label="Maintain Payroll"
            description="Enable payroll: employees, pay heads, salary details, attendance, payroll vouchers, payslips"
            field="maintain_payroll"
            value={features.maintain_payroll}
            onToggle={handleToggle}
            visible={features.show_more_features}
            disabled={false}
          />
          {features.maintain_payroll && (
            <>
              <FeatureRow
                label="Enable Payroll Statutory"
                description="PF, ESI, Professional Tax, TDS on salary — statutory challans and returns"
                field="enable_payroll_statutory"
                value={features.enable_payroll_statutory}
                onToggle={handleToggle}
                disabled={!features.maintain_payroll}
                disabledReason="Requires Maintain Payroll"
                visible={features.show_more_features}
              />
              {features.enable_payroll_statutory && (
                <>
                  <div
                    style={{
                      padding: "4px 12px 4px 28px",
                      borderBottom: "1px solid #e0e0e0",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <label>PF Registration No.:</label>
                    <input
                      type="text"
                      value={features.pf_registration_number}
                      onChange={(e) => handleTextChange("pf_registration_number", e.target.value)}
                      style={{
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        padding: "2px 6px",
                        fontFamily: "monospace",
                        fontSize: 13,
                        width: 200,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      padding: "4px 12px 4px 28px",
                      borderBottom: "1px solid #e0e0e0",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <label>ESI Registration No.:</label>
                    <input
                      type="text"
                      value={features.esi_registration_number}
                      onChange={(e) => handleTextChange("esi_registration_number", e.target.value)}
                      style={{
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        padding: "2px 6px",
                        fontFamily: "monospace",
                        fontSize: 13,
                        width: 200,
                      }}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );

  // Others Section
  const OthersSection = () => (
    <>
      <div
        style={{ background: "var(--ds-action-primary)", color: "#fff", padding: "4px 12px", fontWeight: "bold" }}
      >
        Other Features
      </div>
      {!features.show_more_features ? (
        <div style={{ padding: "8px 12px", color: "#555", fontStyle: "italic" }}>
          Enable 'Show more features' to access these settings.
        </div>
      ) : (
        <>
          <FeatureRow
            label="Enable Multiple Addresses"
            description="Maintain multiple address types — Head Office, Branch, Billing, Shipping, Warehouse — for company and parties"
            field="enable_multiple_addresses"
            value={features.enable_multiple_addresses}
            onToggle={handleToggle}
            visible={features.show_more_features}
          />
          <FeatureRow
            label="Mark Modified/Changed Vouchers"
            description="Audit trail — mark and track vouchers altered after creation for internal control and compliance"
            field="mark_modified_vouchers"
            value={features.mark_modified_vouchers}
            onToggle={handleToggle}
            visible={features.show_more_features}
          />
          <FeatureRow
            label="Mailing Details in Local Language"
            description="Enter and print company/party address in local language — bilingual invoices"
            field="mailing_details_in_local_language"
            value={features.mailing_details_in_local_language}
            onToggle={handleToggle}
            visible={features.show_more_features}
          />
        </>
      )}
    </>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--ds-surface-muted)",
        fontFamily: "monospace",
        fontSize: 13,
        color: "#374151",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--ds-action-primary)",
          color: "#fff",
          padding: "6px 12px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: "bold" }}>Company Features Alteration</div>
        <div>{companySettings?.company_name || companySettings?.name || "Company"}</div>
      </div>

      {/* Business nature — drives module visibility */}
      <div
        style={{
          background: "#eef2ff",
          borderBottom: "1px solid #c7d2fe",
          padding: "10px 12px",
        }}
        data-testid="f11-business-nature"
      >
        <div style={{ fontWeight: "bold", marginBottom: 4, fontSize: 12 }}>
          Business nature (industry pack)
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={businessNature}
            onChange={(e) => applyNaturePreset(e.target.value)}
            style={{
              height: 32,
              minWidth: 280,
              fontSize: 12,
              border: "1px solid #374151",
              borderRadius: 6,
              padding: "0 8px",
              background: "#fff",
            }}
          >
            <option value="">— Select business nature —</option>
            {BUSINESS_NATURES.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={saveBusinessNature}
            disabled={!natureDirty && businessNature === (companySettings?.businessNature || "")}
            style={{
              height: 32,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              background: "#1557b0",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              opacity:
                !natureDirty && businessNature === (companySettings?.businessNature || "")
                  ? 0.5
                  : 1,
            }}
          >
            Apply nature to menus
          </button>
        </div>
        {natureHint ? (
          <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{natureHint}</div>
        ) : null}
      </div>

      {/* Show More/All Toggles */}
      <div
        style={{
          background: "var(--ds-surface-hover)",
          padding: "4px 12px",
          borderBottom: "1px solid #374151",
          display: "flex",
          gap: "24px",
        }}
      >
        <div>
          <span>Show more features </span>
          <span
            onClick={() => handleToggle("show_more_features", true)}
            style={{
              padding: "2px 8px",
              background: features.show_more_features ? "var(--ds-action-primary)" : "var(--ds-surface-muted)",
              color: features.show_more_features ? "#fff" : "#374151",
              border: features.show_more_features ? "none" : "1px solid #888",
              cursor: "pointer",
            }}
          >
            Yes
          </span>
          <span
            onClick={() => handleToggle("show_more_features", false)}
            style={{
              padding: "2px 8px",
              background: !features.show_more_features ? "var(--ds-action-primary)" : "var(--ds-surface-muted)",
              color: !features.show_more_features ? "#fff" : "#374151",
              border: !features.show_more_features ? "none" : "1px solid #888",
              cursor: "pointer",
            }}
          >
            No
          </span>
        </div>
        <div>
          <span>Show all features </span>
          <span
            onClick={() => handleToggle("show_all_features", true)}
            style={{
              padding: "2px 8px",
              background: features.show_all_features ? "var(--ds-action-primary)" : "var(--ds-surface-muted)",
              color: features.show_all_features ? "#fff" : "#374151",
              border: features.show_all_features ? "none" : "1px solid #888",
              cursor: "pointer",
            }}
          >
            Yes
          </span>
          <span
            onClick={() => handleToggle("show_all_features", false)}
            style={{
              padding: "2px 8px",
              background: !features.show_all_features ? "var(--ds-action-primary)" : "var(--ds-surface-muted)",
              color: !features.show_all_features ? "#fff" : "#374151",
              border: !features.show_all_features ? "none" : "1px solid #888",
              cursor: "pointer",
            }}
          >
            No
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "var(--ds-surface-hover)", borderBottom: "1px solid #374151", display: "flex" }}>
        {["accounting", "inventory", "taxation", "online", "payroll", "others"].map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveSection(tab)}
            style={{
              padding: "4px 16px",
              cursor: "pointer",
              borderRight: "1px solid #888",
              background: activeSection === tab ? "var(--ds-action-primary)" : "transparent",
              color: activeSection === tab ? "#fff" : "#374151",
            }}
            onMouseEnter={(e) => {
              if (activeSection !== tab) e.currentTarget.style.background = "var(--ds-surface-hover)";
            }}
            onMouseLeave={(e) => {
              if (activeSection !== tab) e.currentTarget.style.background = "transparent";
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace("_", " ")}
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ overflowY: "auto", flex: 1, padding: 0 }}>
        {activeSection === "accounting" && (
          <>
            <div
              style={{
                background: "var(--ds-action-primary)",
                color: "#fff",
                padding: "4px 12px",
                fontWeight: "bold",
              }}
            >
              Accounting Features
            </div>
            <FeatureRow
              label="Maintain Accounts"
              description="Enable ledger creation, vouchers, and financial reports"
              field="maintain_accounts"
              value={features.maintain_accounts}
              onToggle={handleToggle}
              visible={true}
            />
            <FeatureRow
              label="Enable Bill-wise Entry"
              description="Track outstanding balances at invoice level — Bills Receivable/Payable"
              field="enable_bill_wise_entry"
              value={features.enable_bill_wise_entry}
              onToggle={handleToggle}
              disabled={!features.maintain_accounts}
              disabledReason="Requires Maintain Accounts"
              visible={true}
            />
            <FeatureRow
              label="Enable Cost Centres"
              description="Allocate income/expenses to departments, projects, branches"
              field="enable_cost_centres"
              value={features.enable_cost_centres}
              onToggle={handleToggle}
              disabled={!features.maintain_accounts}
              disabledReason="Requires Maintain Accounts"
              visible={features.show_more_features}
            />
            <FeatureRow
              label="Enable Interest Calculation"
              description="Auto-calculate interest on overdue bills, loans, and outstanding balances"
              field="enable_interest_calculation"
              value={features.enable_interest_calculation}
              onToggle={handleToggle}
              disabled={!features.maintain_accounts}
              disabledReason="Requires Maintain Accounts"
              visible={features.show_more_features}
            />
          </>
        )}

        {activeSection === "inventory" && (
          <>
            <div
              style={{
                background: "var(--ds-action-primary)",
                color: "#fff",
                padding: "4px 12px",
                fontWeight: "bold",
              }}
            >
              Inventory Features
            </div>
            <FeatureRow
              label="Maintain Inventory"
              description="Enable stock items, godowns, inventory vouchers, and stock reports"
              field="maintain_inventory"
              value={features.maintain_inventory}
              onToggle={handleToggle}
              visible={true}
            />
            <FeatureRow
              label="Integrate Accounts with Inventory"
              description="Include stock value in Balance Sheet and Profit & Loss automatically"
              field="integrate_accounts_with_inventory"
              value={features.integrate_accounts_with_inventory}
              onToggle={handleToggle}
              disabled={!features.maintain_inventory}
              disabledReason="Requires Maintain Inventory"
              visible={true}
            />
            <FeatureRow
              label="Enable Multiple Price Levels"
              description="Maintain different selling prices — Retail, Wholesale, Dealer, Distributor"
              field="enable_multiple_price_levels"
              value={features.enable_multiple_price_levels}
              onToggle={handleToggle}
              disabled={!features.maintain_inventory}
              disabledReason="Requires Maintain Inventory"
              visible={features.show_more_features}
            />
            <FeatureRow
              label="Enable Batches"
              description="Track stock batch-wise or lot-wise — pharmaceuticals, food, chemicals"
              field="enable_batches"
              value={features.enable_batches}
              onToggle={handleToggle}
              disabled={!features.maintain_inventory}
              disabledReason="Requires Maintain Inventory"
              visible={features.show_more_features}
            />
            <FeatureRow
              label="Maintain Expiry Date for Batches"
              description="Track manufacturing and expiry dates — FIFO/FEFO batch selection"
              field="maintain_expiry_date_for_batches"
              value={features.maintain_expiry_date_for_batches}
              onToggle={handleToggle}
              disabled={!features.enable_batches}
              disabledReason="Requires Enable Batches"
              visible={features.show_more_features && features.enable_batches}
            />
            <FeatureRow
              label="Enable Job Order Processing"
              description="Job work/subcontracting — Material In/Out, scrap and by-product tracking"
              field="enable_job_order_processing"
              value={features.enable_job_order_processing}
              onToggle={handleToggle}
              disabled={!features.maintain_inventory}
              disabledReason="Requires Maintain Inventory"
              visible={features.show_all_features}
            />
            <FeatureRow
              label="Enable Cost Tracking"
              description="Track item/job/order running costs across procurement, manufacturing, sales"
              field="enable_cost_tracking"
              value={features.enable_cost_tracking}
              onToggle={handleToggle}
              disabled={!features.maintain_inventory}
              disabledReason="Requires Maintain Inventory"
              visible={features.show_all_features}
            />
            <FeatureRow
              label="Use Discount Column in Invoices"
              description="Show item-wise trade discount column in sales and purchase invoices"
              field="use_discount_column_in_invoices"
              value={features.use_discount_column_in_invoices}
              onToggle={handleToggle}
              disabled={!features.maintain_inventory}
              disabledReason="Requires Maintain Inventory"
              visible={features.show_more_features}
            />
            <FeatureRow
              label="Use Separate Actual and Billed Quantity"
              description="Separate Actual Qty (stock) and Billed Qty (invoice) — for free goods schemes"
              field="use_separate_actual_billed_qty"
              value={features.use_separate_actual_billed_qty}
              onToggle={handleToggle}
              disabled={!features.maintain_inventory}
              disabledReason="Requires Maintain Inventory"
              visible={features.show_more_features}
            />
          </>
        )}

        {activeSection === "taxation" && TaxationSection()}
        {activeSection === "online" && OnlineAccessSection()}
        {activeSection === "payroll" && PayrollSection()}
        {activeSection === "others" && OthersSection()}
      </div>

      {/* Bottom Action Bar */}
      <div
        style={{
          borderTop: "2px solid var(--ds-action-primary)",
          background: "var(--ds-surface-hover)",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          style={{
            background: isDirty ? "var(--ds-action-primary)" : "#aaa",
            color: "#fff",
            border: "none",
            padding: "4px 16px",
            fontFamily: "monospace",
            fontSize: 13,
            cursor: isDirty ? "pointer" : "not-allowed",
          }}
        >
          {isSaving ? "Saving..." : "✔ Ctrl+A  Accept / Save"}
        </button>
        <button
          onClick={() => {
            if (isDirty && !window.confirm("Discard unsaved changes?")) return;
            setCurrentPage("gateway");
          }}
          style={{
            background: "#888",
            color: "#fff",
            border: "none",
            padding: "4px 16px",
            fontFamily: "monospace",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Esc Exit
        </button>
        <span style={{ marginLeft: "auto", color: "#555", fontSize: 11 }}>
          {isDirty ? "⚠ Unsaved changes" : "✓ All changes saved"}
        </span>
      </div>
    </div>
  );
};

export default F11CompanyFeatures;
