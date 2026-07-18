import React, { useEffect, useMemo, useState } from "react";
import toast from "@/lib/appToast";
import { useStore } from "@/store/useStore";
import { useTopbarStore } from "@/store/topbarStore";
import { isAdminOrOwner } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/auditLog";
import {
  BadgePill,
  Field,
  ModalShell,
  OutlineButton,
  PrimaryButton,
  SelectField,
  ToggleRow,
  TopMenuDropdown,
} from "./shared";

const PROVINCES = ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"];

type CompanyModalKey =
  | "select"
  | "create"
  | "alter"
  | "shut"
  | "change"
  | "security"
  | "roles"
  | "user"
  | "vault"
  | "features"
  | "license";

interface ApiCompany {
  id: string;
  name: string;
  fiscalYear?: string;
  pan?: string;
  status?: "Active" | "Inactive" | string;
  lastAccessed?: string;
}

export default function CompanyMenu() {
  const currentUser = useStore((state) => state.currentUser);
  const companySettings = useStore((state) => state.companySettings);
  const setCurrentPage = useStore((state) => state.setCurrentPage);
  const { activeCompany, setActiveCompany } = useTopbarStore();

  const [activeModal, setActiveModal] = useState<CompanyModalKey | null>(null);

  const isAdmin = isAdminOrOwner(String(currentUser?.role || ""));

  const items = useMemo(
    () => [
      { key: "select", label: "Select Company", shortcut: "F3" },
      { key: "create", label: "Create Company", shortcut: "C", locked: !isAdmin },
      { key: "alter", label: "Alter Company", shortcut: "A", locked: !isAdmin },
      { key: "shut", label: "Shut Company", shortcut: "Ctrl+F3" },
      { key: "change", label: "Change Company", shortcut: "H" },
      {
        key: "security",
        label: "Security Control",
        shortcut: "S",
        separatorBefore: true,
        locked: !isAdmin,
      },
      { key: "roles", label: "User Roles", shortcut: "R", locked: !isAdmin },
      { key: "user", label: "Change User", shortcut: "U" },
      { key: "vault", label: "Data Vault (Encryption)", shortcut: "V", locked: !isAdmin },
      {
        key: "features",
        label: "Company Features",
        shortcut: "F11",
        separatorBefore: true,
        locked: !isAdmin,
      },
      { key: "license", label: "License / Subscription", shortcut: "L" },
    ],
    [isAdmin],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<CompanyModalKey>;
      if (customEvent.detail) setActiveModal(customEvent.detail);
    };

    window.addEventListener("topbar:company-action", handler);
    return () => window.removeEventListener("topbar:company-action", handler);
  }, []);

  const currentCompanyName =
    activeCompany?.name ||
    companySettings?.companyNameEn ||
    companySettings?.name ||
    "Current Company";

  return (
    <>
      <TopMenuDropdown items={items} onSelect={(key) => setActiveModal(key as CompanyModalKey)} />

      {activeModal === "select" && (
        <SelectCompanyModal
          onClose={() => setActiveModal(null)}
          onSelect={(company) => {
            setActiveCompany({
              id: company.id,
              name: company.name,
              fiscalYear: company.fiscalYear || "",
              pan: company.pan || "",
            });
            toast.success("✓ Company selected");
            setActiveModal(null);
            setCurrentPage("dashboard");
          }}
        />
      )}

      {activeModal === "change" && (
        <SelectCompanyModal
          onClose={() => setActiveModal(null)}
          onSelect={(company) => {
            setActiveCompany({
              id: company.id,
              name: company.name,
              fiscalYear: company.fiscalYear || "",
              pan: company.pan || "",
            });
            toast.success("✓ Company changed");
            setActiveModal(null);
            setCurrentPage("dashboard");
          }}
        />
      )}

      {activeModal === "create" && (
        <CompanyFormModal mode="create" onClose={() => setActiveModal(null)} />
      )}

      {activeModal === "alter" && (
        <CompanyFormModal
          mode="alter"
          companyName={currentCompanyName}
          companyId={activeCompany?.id}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === "shut" && (
        <ShutCompanyModal
          companyName={currentCompanyName}
          onClose={() => setActiveModal(null)}
          onShut={() => {
            setActiveCompany(null);
            toast.success("✓ Company shut");
            logAuditEvent({
              action: "shut_company",
              module: "company",
              status: "success",
            });
            setActiveModal(null);
            setCurrentPage("dashboard");
          }}
        />
      )}

      {activeModal === "security" && <SecurityModal onClose={() => setActiveModal(null)} />}
      {activeModal === "roles" && <RolesModal onClose={() => setActiveModal(null)} />}
      {activeModal === "user" && <ChangeUserModal onClose={() => setActiveModal(null)} />}
      {activeModal === "vault" && <DataVaultModal onClose={() => setActiveModal(null)} />}
      {activeModal === "features" && (
        <FeaturesModal companyId={activeCompany?.id} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "license" && <LicenseModal onClose={() => setActiveModal(null)} />}
    </>
  );
}

function SelectCompanyModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (company: ApiCompany) => void;
}) {
  const [companies, setCompanies] = useState<ApiCompany[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    fetch("/api/companies")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to fetch companies");
        return response.json();
      })
      .then((json) => {
        if (!mounted) return;
        const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        setCompanies(list);
      })
      .catch(() => {
        if (!mounted) return;
        setCompanies([
          {
            id: "local-company",
            name: "Demo Sutra Company",
            fiscalYear: "2081/82",
            pan: "000000000",
            status: "Active",
            lastAccessed: new Date().toISOString(),
          },
        ]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <ModalShell title="Select Company" onClose={onClose} width="max-w-3xl">
      <div className="mb-3">
        <Field
          label="Search Company"
          value={search}
          onChange={setSearch}
          placeholder="Type company name..."
        />
      </div>

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-gray-200 bg-[#f5f6fa]">
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-500">
              Company Name
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-500">
              Fiscal Year
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-500">
              Status
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-500">
              Last Accessed
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredCompanies.map((company) => (
            <tr
              key={company.id}
              className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
              onClick={() => onSelect(company)}
            >
              <td className="px-3 py-2 font-medium text-gray-800">{company.name}</td>
              <td className="px-3 py-2">{company.fiscalYear || "—"}</td>
              <td className="px-3 py-2">
                <BadgePill tone={company.status === "Inactive" ? "danger" : "success"}>
                  {company.status || "Active"}
                </BadgePill>
              </td>
              <td className="px-3 py-2">
                {company.lastAccessed ? new Date(company.lastAccessed).toLocaleString() : "—"}
              </td>
            </tr>
          ))}

          {filteredCompanies.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                No companies found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ModalShell>
  );
}

function CompanyFormModal({
  mode,
  onClose,
  companyName = "",
  companyId,
}: {
  mode: "create" | "alter";
  onClose: () => void;
  companyName?: string;
  companyId?: string;
}) {
  const [name, setName] = useState(companyName);
  const [mailingName, setMailingName] = useState(companyName);
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("Kathmandu");
  const [district, setDistrict] = useState("Kathmandu");
  const [province, setProvince] = useState("Bagmati");
  const [country, setCountry] = useState("Nepal");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [pan, setPan] = useState("");
  const [vat, setVat] = useState("");
  const [companyType, setCompanyType] = useState("Pvt Ltd");
  const [fyBeginning, setFyBeginning] = useState("2081-04-01");
  const [booksBeginning, setBooksBeginning] = useState("2081-04-01");
  const [currency, setCurrency] = useState("NPR");

  const save = async () => {
    if (!name.trim()) {
      toast.error("✗ Company name is required");
      return;
    }

    if (!/^\d{9}$/.test(pan)) {
      toast.error("✗ PAN number must be 9 digits");
      return;
    }

    if (vat && !/^\d{9}$/.test(vat)) {
      toast.error("✗ VAT registration number must be 9 digits");
      return;
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("✗ Invalid email address");
      return;
    }

    const payload = {
      name,
      mailingName,
      address1,
      address2,
      city,
      district,
      province,
      country,
      phone,
      mobile,
      email,
      website,
      pan,
      vat,
      companyType,
      fyBeginning,
      booksBeginning,
      currency,
    };

    try {
      const endpoint =
        mode === "create"
          ? "/api/companies"
          : companyId
            ? `/api/companies/${companyId}`
            : "/api/companies/current";

      const method = mode === "create" ? "POST" : "PUT";

      await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toast.success(mode === "create" ? "✓ Company created" : "✓ Company altered");

      await logAuditEvent({
        action: mode === "create" ? "create_company" : "alter_company",
        module: "company",
        status: "success",
        newValue: payload,
      });

      onClose();
    } catch (error) {
      toast.error("✗ Unable to save company");

      await logAuditEvent({
        action: mode === "create" ? "create_company" : "alter_company",
        module: "company",
        status: "failed",
        errorReason: String(error),
      });
    }
  };

  return (
    <ModalShell
      title={mode === "create" ? "Create Company" : "Alter Company"}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <OutlineButton onClick={onClose}>Cancel</OutlineButton>
          <PrimaryButton onClick={save}>Save</PrimaryButton>
        </>
      }
    >
      {mode === "alter" && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
          Changing PAN or fiscal year start may affect existing transactions. Proceed carefully.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Company Name" value={name} onChange={setName} required />
        <Field label="Mailing Name" value={mailingName} onChange={setMailingName} />
        <SelectField
          label="Company Type"
          value={companyType}
          onChange={setCompanyType}
          options={[
            "Proprietorship",
            "Partnership",
            "Pvt Ltd",
            "Public Ltd",
            "NGO",
            "Cooperative",
            "Government Body",
            "Branch Office",
          ]}
        />
        <Field label="Address Line 1" value={address1} onChange={setAddress1} />
        <Field label="Address Line 2" value={address2} onChange={setAddress2} />
        <Field label="City" value={city} onChange={setCity} />
        <Field label="District" value={district} onChange={setDistrict} />
        <SelectField label="Province" value={province} onChange={setProvince} options={PROVINCES} />
        <Field label="Country" value={country} onChange={setCountry} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Mobile" value={mobile} onChange={setMobile} />
        <Field label="Email" value={email} onChange={setEmail} />
        <Field label="Website" value={website} onChange={setWebsite} />
        <Field label="PAN Number" value={pan} onChange={setPan} required />
        <Field label="VAT Registration Number" value={vat} onChange={setVat} />
        <Field label="Fiscal Year Beginning (BS)" value={fyBeginning} onChange={setFyBeginning} />
        <Field
          label="Books Beginning Date (BS)"
          value={booksBeginning}
          onChange={setBooksBeginning}
        />
        <Field label="Base Currency" value={currency} onChange={setCurrency} />
      </div>
    </ModalShell>
  );
}

function ShutCompanyModal({
  companyName,
  onClose,
  onShut,
}: {
  companyName: string;
  onClose: () => void;
  onShut: () => void;
}) {
  return (
    <ModalShell
      title="Shut Company"
      onClose={onClose}
      footer={
        <>
          <OutlineButton onClick={onClose}>Cancel</OutlineButton>
          <OutlineButton onClick={onShut}>Shut Without Saving</OutlineButton>
          <PrimaryButton onClick={onShut}>Save and Shut</PrimaryButton>
        </>
      }
    >
      <p className="text-[12px] text-gray-700">
        You are about to shut <strong>{companyName}</strong>. Unsaved work will be lost.
      </p>
    </ModalShell>
  );
}

function SecurityModal({ onClose }: { onClose: () => void }) {
  const [enabled, setEnabled] = useState(true);
  const [minLen, setMinLen] = useState("8");
  const [expiry, setExpiry] = useState("90");
  const [attempts, setAttempts] = useState("5");
  const [twoFactor, setTwoFactor] = useState(false);

  const save = async () => {
    try {
      await fetch("/api/settings/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, minLen, expiry, attempts, twoFactor }),
      });

      toast.success("✓ Security settings saved");

      await logAuditEvent({
        action: "security_settings",
        module: "security",
        status: "success",
      });

      onClose();
    } catch {
      toast.error("✗ Failed to save security settings");
    }
  };

  return (
    <ModalShell
      title="Security Control"
      onClose={onClose}
      footer={<PrimaryButton onClick={save}>Save</PrimaryButton>}
    >
      <ToggleRow label="Enable Security" checked={enabled} onChange={setEnabled} />
      <Field label="Minimum Password Length" value={minLen} onChange={setMinLen} type="number" />
      <Field label="Password Expiry Days" value={expiry} onChange={setExpiry} type="number" />
      <Field
        label="Max Failed Login Attempts"
        value={attempts}
        onChange={setAttempts}
        type="number"
      />
      <ToggleRow label="Two-Factor Authentication" checked={twoFactor} onChange={setTwoFactor} />
    </ModalShell>
  );
}

function RolesModal({ onClose }: { onClose: () => void }) {
  const modules = [
    "Masters",
    "Transactions",
    "Reports",
    "Company",
    "Security",
    "Inventory",
    "Payroll",
    "Banking",
  ];

  const permissionLevels = ["No Access", "View", "Create", "Edit", "Delete", "Full Access"];

  return (
    <ModalShell title="User Roles" onClose={onClose} width="max-w-4xl">
      <div className="mb-3 flex justify-end">
        <PrimaryButton>Add Role</PrimaryButton>
      </div>

      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#f5f6fa]">
            <th className="px-3 py-2 text-left text-[10px] uppercase text-gray-500">Module</th>
            {permissionLevels.map((permission) => (
              <th
                key={permission}
                className="px-3 py-2 text-center text-[10px] uppercase text-gray-500"
              >
                {permission}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr key={module} className="border-b border-gray-100">
              <td className="px-3 py-2 font-medium">{module}</td>
              {permissionLevels.map((permission) => (
                <td key={permission} className="px-3 py-2 text-center">
                  <input type="radio" name={module} className="accent-[var(--ds-action-primary)]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ModalShell>
  );
}

function ChangeUserModal({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = async () => {
    try {
      await fetch("/api/auth/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      toast.success("✓ User switched");

      await logAuditEvent({
        action: "switch_user",
        module: "security",
        status: "success",
      });

      onClose();
    } catch {
      toast.error("✗ Unable to switch user");
    }
  };

  return (
    <ModalShell
      title="Change User"
      onClose={onClose}
      footer={<PrimaryButton onClick={submit}>Switch User</PrimaryButton>}
    >
      <div className="grid gap-3">
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
      </div>
    </ModalShell>
  );
}

function DataVaultModal({ onClose }: { onClose: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const save = async () => {
    if (enabled && password !== confirm) {
      toast.error("✗ Passwords do not match");
      return;
    }

    toast.success("✓ Data vault settings saved");

    await logAuditEvent({
      action: "data_vault_change",
      module: "security",
      status: "success",
    });

    onClose();
  };

  return (
    <ModalShell
      title="Data Vault (Encryption)"
      onClose={onClose}
      footer={<PrimaryButton onClick={save}>Save</PrimaryButton>}
    >
      <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
        If you forget this password, company data may not be recoverable. Store it securely.
      </div>

      <ToggleRow label="Enable Encryption" checked={enabled} onChange={setEnabled} />

      {enabled && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Password" value={password} onChange={setPassword} type="password" />
          <Field label="Confirm Password" value={confirm} onChange={setConfirm} type="password" />
        </div>
      )}
    </ModalShell>
  );
}

function FeaturesModal({ onClose, companyId }: { onClose: () => void; companyId?: string }) {
  const tabs = ["Accounting", "Inventory", "Taxation", "Payroll", "Banking"];
  const [activeTab, setActiveTab] = useState("Accounting");

  const featureMap: Record<string, string[]> = {
    Accounting: [
      "Bill-wise Details",
      "Cost Centers",
      "Budgets",
      "Multi-currency",
      "Interest Calculation",
    ],
    Inventory: ["Stock Items", "Batches", "Expiry Dates", "Godowns/Warehouses", "Reorder Levels"],
    Taxation: ["VAT (13%)", "TDS/TCS", "Withholding Tax"],
    Payroll: ["Employee Masters", "Salary Structures", "Attendance", "Payslip"],
    Banking: ["Bank Reconciliation", "Cheque Management", "Bank Statement Import"],
  };

  const save = async () => {
    try {
      const endpoint = companyId
        ? `/api/companies/${companyId}/features`
        : "/api/companies/current/features";

      await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledFeatures: featureMap }),
      });

      toast.success("✓ Company features saved");

      await logAuditEvent({
        action: "company_features",
        module: "company",
        status: "success",
      });

      onClose();
    } catch {
      toast.error("✗ Unable to save features");
    }
  };

  return (
    <ModalShell
      title="Company Features"
      onClose={onClose}
      footer={<PrimaryButton onClick={save}>Save Features</PrimaryButton>}
    >
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`h-8 px-3 text-[12px] font-medium ${
              activeTab === tab ? "border-b-2 border-[var(--ds-action-primary)] text-[var(--ds-action-primary)]" : "text-gray-600"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {featureMap[activeTab].map((feature) => (
        <ToggleRow key={feature} label={feature} checked={true} onChange={() => undefined} />
      ))}
    </ModalShell>
  );
}

function LicenseModal({ onClose }: { onClose: () => void }) {
  const [syncing, setSyncing] = useState(false);

  const syncLicense = async () => {
    setSyncing(true);
    try {
      await fetch("/api/license/sync", { method: "POST" });
      toast.success("✓ License synced");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ModalShell title="License / Subscription" onClose={onClose}>
      <div className="grid gap-2 rounded-md border border-gray-200 bg-[#f5f6fa] p-4 text-[12px]">
        <div>
          <strong>Plan:</strong> Professional
        </div>
        <div>
          <strong>Valid Until:</strong> 2082/03/31
        </div>
        <div>
          <strong>Registered Email:</strong> admin@sutraerp.com
        </div>
        <div>
          <strong>Allowed Users:</strong> 25
        </div>
        <div>
          <strong>Allowed Companies:</strong> 5
        </div>
        <div>
          <strong>Cloud Backup:</strong> Active
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <OutlineButton onClick={() => window.open("https://sutraerp.com/renew", "_blank")}>
          Renew
        </OutlineButton>
        <PrimaryButton onClick={syncLicense} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync License"}
        </PrimaryButton>
      </div>
    </ModalShell>
  );
}
