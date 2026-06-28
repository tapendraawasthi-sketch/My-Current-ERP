// @ts-nocheck
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { useTallyKeyboard } from '../hooks/useTallyKeyboard';

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
  enable_tds: boolean;
  tds_applicable_from: string;
  ird_office_name: string;
  enable_vat: boolean;
  vat_registration_number: string;
  vat_applicable_from: string;
  enable_excise: boolean;
  excise_registration_number: string;
  enable_browser_access_for_reports: boolean;
  enable_remote_access_sync: boolean;
  maintain_payroll: boolean;
  enable_payroll_statutory: boolean;
  ssf_registration_number: string;
  ssf_employer_code: string;
  ssf_employee_rate: number;
  ssf_employer_rate: number;
  enable_cit: boolean;
  cit_member_code: string;
  enable_gratuity: boolean;
  mark_modified_vouchers: boolean;
  enable_multiple_addresses: boolean;
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
  enable_tds: false,
  tds_applicable_from: '',
  ird_office_name: '',
  enable_vat: false,
  vat_registration_number: '',
  vat_applicable_from: '',
  enable_excise: false,
  excise_registration_number: '',
  enable_browser_access_for_reports: false,
  enable_remote_access_sync: false,
  maintain_payroll: false,
  enable_payroll_statutory: false,
  ssf_registration_number: '',
  ssf_employer_code: '',
  ssf_employee_rate: 11,
  ssf_employer_rate: 20,
  enable_cit: false,
  cit_member_code: '',
  enable_gratuity: false,
  mark_modified_vouchers: false,
  enable_multiple_addresses: false,
  mailing_details_in_local_language: false,
};

const F11CompanyFeatures = () => {
  const [features, setFeatures] = useState<CompanyFeatures>(defaultState);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('accounting');
  const { setCurrentPage, companySettings } = useStore();

  const fetchFeatures = async () => {
    setIsLoading(true);
    try {
      // Simulate fetching company features
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error fetching features:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage('F11CompanyFeatures');
    fetchFeatures();
  }, [setCurrentPage]);

  const handleToggle = (field: keyof CompanyFeatures) => {
    setFeatures(prev => ({ ...prev, [field]: !prev[field] }));
    setIsDirty(true);
  };

  const handleTextChange = (field: keyof CompanyFeatures, value: string | number) => {
    setFeatures(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate saving
      setTimeout(() => {
        setIsSaving(false);
        setIsDirty(false);
        toast.success('Company features saved successfully!');
      }, 800);
    } catch (error) {
      console.error('Error saving features:', error);
      setIsSaving(false);
      toast.error('Failed to save company features');
    }
  };

  useTallyKeyboard({
    onF1: () => setActiveSection('accounting'),
    onF2: () => setActiveSection('inventory'),
    onF3: () => setActiveSection('taxation'),
    onF4: () => setActiveSection('online'),
    onF5: () => setActiveSection('payroll'),
    onF6: () => setActiveSection('others'),
    onSave: handleSave,
  });

  const FeatureRow = ({ label, description, isActive, onToggle, children }: {
    label: string;
    description: string;
    isActive: boolean;
    onToggle: () => void;
    children?: React.ReactNode;
  }) => (
    <div style={{
      borderBottom: '1px solid #ccc',
      padding: '12px 16px',
      background: 'transparent'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', color: '#000' }}>{label}</div>
          <div style={{ color: '#555', fontSize: 11 }}>{description}</div>
          {children && isActive && (
            <div style={{ marginTop: '8px' }}>
              {children}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
          <button
            onClick={onToggle}
            style={{
              background: isActive ? '#4A7A30' : '#C9DEB5',
              color: isActive ? '#fff' : '#000',
              border: isActive ? 'none' : '1px solid #888',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              minWidth: '60px',
            }}
          >
            Yes
          </button>
          <button
            onClick={onToggle}
            style={{
              background: !isActive ? '#4A7A30' : '#C9DEB5',
              color: !isActive ? '#fff' : '#000',
              border: !isActive ? 'none' : '1px solid #888',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              minWidth: '60px',
            }}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );

  const AccountingSection = () => (
    <div>
      <FeatureRow
        label="Maintain Accounts"
        description="Maintain accounts only (without inventory)"
        isActive={features.maintain_accounts}
        onToggle={() => handleToggle('maintain_accounts')}
      />

      {features.show_more_features && (
        <>
          <FeatureRow
            label="Bill-wise Details"
            description="Maintain bill-wise details for receivables/payables"
            isActive={features.enable_bill_wise_entry}
            onToggle={() => handleToggle('enable_bill_wise_entry')}
          />
          <FeatureRow
            label="Cost Centres"
            description="Maintain cost centres for expenses/profit centres for incomes"
            isActive={features.enable_cost_centres}
            onToggle={() => handleToggle('enable_cost_centres')}
          />
          <FeatureRow
            label="Interest Calculation"
            description="Calculate interest on overdue amounts"
            isActive={features.enable_interest_calculation}
            onToggle={() => handleToggle('enable_interest_calculation')}
          />
        </>
      )}
    </div>
  );

  const InventorySection = () => (
    <div>
      <FeatureRow
        label="Maintain Inventory"
        description="Maintain inventory along with accounts"
        isActive={features.maintain_inventory}
        onToggle={() => handleToggle('maintain_inventory')}
      />

      {features.show_more_features && (
        <>
          <FeatureRow
            label="Integrate Accounts with Inventory"
            description="Update accounts automatically when inventory vouchers are entered"
            isActive={features.integrate_accounts_with_inventory}
            onToggle={() => handleToggle('integrate_accounts_with_inventory')}
          />
          <FeatureRow
            label="Multiple Price Levels"
            description="Maintain different price levels for the same item"
            isActive={features.enable_multiple_price_levels}
            onToggle={() => handleToggle('enable_multiple_price_levels')}
          />
          <FeatureRow
            label="Batch Wise Details"
            description="Maintain batch wise details for inventory"
            isActive={features.enable_batches}
            onToggle={() => handleToggle('enable_batches')}
          />
          <FeatureRow
            label="Expiry Date Tracking"
            description="Maintain expiry date for batches"
            isActive={features.maintain_expiry_date_for_batches}
            onToggle={() => handleToggle('maintain_expiry_date_for_batches')}
          />
          <FeatureRow
            label="Job Order Processing"
            description="Maintain job work details for inventory"
            isActive={features.enable_job_order_processing}
            onToggle={() => handleToggle('enable_job_order_processing')}
          />
          <FeatureRow
            label="Cost Tracking"
            description="Track costs for manufactured goods"
            isActive={features.enable_cost_tracking}
            onToggle={() => handleToggle('enable_cost_tracking')}
          />
          <FeatureRow
            label="Discount Column in Invoices"
            description="Use discount column in invoices"
            isActive={features.use_discount_column_in_invoices}
            onToggle={() => handleToggle('use_discount_column_in_invoices')}
          />
          <FeatureRow
            label="Actual vs Billed Quantity"
            description="Maintain separate actual and billed quantities"
            isActive={features.use_separate_actual_billed_qty}
            onToggle={() => handleToggle('use_separate_actual_billed_qty')}
          />
        </>
      )}
    </div>
  );

  const TaxationSection = () => (
    <div>
      <FeatureRow
        label="Enable Value Added Tax (VAT)"
        description="Nepal's primary business tax at 13%. Mandatory for annual turnover above NPR 50 lakh (NPR 5,000,000). Regulated by IRD (Inland Revenue Department)."
        isActive={features.enable_vat}
        onToggle={() => handleToggle('enable_vat')}
      >
        {features.enable_vat && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#000' }}>VAT Registration No.</label>
                <input
                  type="text"
                  value={features.vat_registration_number}
                  onChange={(e) => handleTextChange('vat_registration_number', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: 12
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#000' }}>Applicable From</label>
                <input
                  type="date"
                  value={features.vat_applicable_from}
                  onChange={(e) => handleTextChange('vat_applicable_from', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: 12
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </FeatureRow>

      <FeatureRow
        label="Enable TDS (Income Tax Withholding)"
        description="Withhold income tax on contractor payments (1.5%), rent (10%), professional fees (15%), commission (5%), interest (15%) per Nepal Income Tax Act 2058."
        isActive={features.enable_tds}
        onToggle={() => handleToggle('enable_tds')}
      >
        {features.enable_tds && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#000' }}>IRD Office Name:</label>
                <input
                  type="text"
                  value={features.ird_office_name}
                  onChange={(e) => handleTextChange('ird_office_name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: 12
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#000' }}>Applicable From</label>
                <input
                  type="date"
                  value={features.tds_applicable_from}
                  onChange={(e) => handleTextChange('tds_applicable_from', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: 12
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </FeatureRow>

      {(features.show_all_features || features.enable_excise) && (
        <FeatureRow
          label="Enable Excise Duty"
          description="Nepal excise duty on alcohol, tobacco, petroleum, vehicles. Register with Inland Revenue Department for excise compliance."
          isActive={features.enable_excise}
          onToggle={() => handleToggle('enable_excise')}
        >
          {features.enable_excise && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#000' }}>Excise Reg. No.</label>
                  <input
                    type="text"
                    value={features.excise_registration_number}
                    onChange={(e) => handleTextChange('excise_registration_number', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: 12
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </FeatureRow>
      )}
    </div>
  );

  const OnlineAccessSection = () => (
    <div>
      <FeatureRow
        label="Enable Browser-based Reports Access"
        description="Allow access to reports through web browser"
        isActive={features.enable_browser_access_for_reports}
        onToggle={() => handleToggle('enable_browser_access_for_reports')}
      />
      <FeatureRow
        label="Enable Remote Access & Cloud Synchronisation"
        description="Allow remote access and synchronize data with cloud"
        isActive={features.enable_remote_access_sync}
        onToggle={() => handleToggle('enable_remote_access_sync')}
      />
    </div>
  );

  const PayrollSection = () => (
    <div>
      <FeatureRow
        label="Maintain Payroll"
        description="Maintain payroll along with accounts"
        isActive={features.maintain_payroll}
        onToggle={() => handleToggle('maintain_payroll')}
      />

      {features.maintain_payroll && (
        <FeatureRow
          label="Enable Statutory Compliance"
          description="Enable compliance with statutory requirements like SSF, CIT, etc."
          isActive={features.enable_payroll_statutory}
          onToggle={() => handleToggle('enable_payroll_statutory')}
        >
          {features.enable_payroll_statutory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#000' }}>SSF Registration No.</label>
                  <input
                    type="text"
                    value={features.ssf_registration_number}
                    onChange={(e) => handleTextChange('ssf_registration_number', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: 12
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#000' }}>SSF Employer Code</label>
                  <input
                    type="text"
                    value={features.ssf_employer_code}
                    onChange={(e) => handleTextChange('ssf_employer_code', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: 12
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#000' }}>SSF Employee Contribution Rate %</label>
                  <input
                    type="number"
                    value={features.ssf_employee_rate}
                    onChange={(e) => handleTextChange('ssf_employee_rate', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: 12
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#000' }}>SSF Employer Contribution Rate %</label>
                  <input
                    type="number"
                    value={features.ssf_employer_rate}
                    onChange={(e) => handleTextChange('ssf_employer_rate', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: 12
                    }}
                  />
                </div>
              </div>

              <div style={{ padding: '6px 12px 6px 28px', fontSize: 11, color: '#2E5B1E', borderBottom: '1px solid #e0e0e0', background: '#f0f8e8' }}>
                Per Nepal Social Security Act 2074: Employee contributes 11%, Employer contributes 20% of basic + grade pay to SSF (Social Security Fund). Register at ssf.gov.np
              </div>

              <FeatureRow
                label="Enable CIT Deduction"
                description="Citizen Investment Trust monthly deduction for employee retirement benefit. Optional but common in Nepal."
                isActive={features.enable_cit}
                onToggle={() => handleToggle('enable_cit')}
              >
                {features.enable_cit && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: '#000' }}>CIT Member Code</label>
                      <input
                        type="text"
                        value={features.cit_member_code}
                        onChange={(e) => handleTextChange('cit_member_code', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: 12
                        }}
                      />
                    </div>
                  </div>
                )}
              </FeatureRow>

              <FeatureRow
                label="Enable Gratuity Provision (Labor Act 2074)"
                description="Nepal Labor Act 2074 mandates gratuity after 3 years of service. 8.33% of basic salary provision."
                isActive={features.enable_gratuity}
                onToggle={() => handleToggle('enable_gratuity')}
              />
            </div>
          )}
        </FeatureRow>
      )}
    </div>
  );

  const OthersSection = () => (
    <div>
      <FeatureRow
        label="Mark Modified Vouchers"
        description="Mark vouchers which were modified after finalization"
        isActive={features.mark_modified_vouchers}
        onToggle={() => handleToggle('mark_modified_vouchers')}
      />
      <FeatureRow
        label="Multiple Addresses"
        description="Maintain multiple addresses for parties"
        isActive={features.enable_multiple_addresses}
        onToggle={() => handleToggle('enable_multiple_addresses')}
      />
      <FeatureRow
        label="Local Language Mailing Details"
        description="Print mailing details in local language"
        isActive={features.mailing_details_in_local_language}
        onToggle={() => handleToggle('mailing_details_in_local_language')}
      />
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'accounting':
        return <AccountingSection />;
      case 'inventory':
        return <InventorySection />;
      case 'taxation':
        return <TaxationSection />;
      case 'online':
        return <OnlineAccessSection />;
      case 'payroll':
        return <PayrollSection />;
      case 'others':
        return <OthersSection />;
      default:
        return <AccountingSection />;
    }
  };

  return (
    <div style={{ background: '#C9DEB5', minHeight: '100vh', padding: '12px' }}>
      <div style={{ background: '#4A7A30', padding: '12px', borderRadius: '6px 6px 0 0', color: '#fff' }}>
        <h1 style={{ margin: 0, fontSize: '18px' }}>Company Features</h1>
      </div>

      <div style={{ background: '#D4EABD', padding: '8px', display: 'flex', gap: '2px', marginBottom: '12px' }}>
        {[
          { key: 'accounting',  label: 'Accounting' },
          { key: 'inventory',   label: 'Inventory' },
          { key: 'taxation',    label: 'Taxation' },
          { key: 'online',      label: 'Online Access' },
          { key: 'payroll',     label: 'Payroll' },
          { key: 'others',      label: 'Others' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            style={{
              padding: '8px 12px',
              background: activeSection === tab.key ? '#4A7A30' : 'transparent',
              color: activeSection === tab.key ? '#fff' : '#000',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              fontWeight: 'bold',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '0 0 6px 6px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ background: '#4A7A30', padding: '8px 16px', color: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase' }}>
            {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Features
          </h2>
        </div>

        <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          {renderSection()}

          {activeSection === 'accounting' && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #ccc' }}>
              <button
                onClick={() => handleToggle('show_more_features')}
                style={{
                  background: features.show_more_features ? '#4A7A30' : '#C9DEB5',
                  color: features.show_more_features ? '#fff' : '#000',
                  border: features.show_more_features ? 'none' : '1px solid #888',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {features.show_more_features ? 'Hide More' : 'Show More Features'}
              </button>
            </div>
          )}

          {(activeSection === 'accounting' || activeSection === 'taxation' || activeSection === 'inventory') && features.show_more_features && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #ccc' }}>
              <button
                onClick={() => handleToggle('show_all_features')}
                style={{
                  background: features.show_all_features ? '#4A7A30' : '#C9DEB5',
                  color: features.show_all_features ? '#fff' : '#000',
                  border: features.show_all_features ? 'none' : '1px solid #888',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {features.show_all_features ? 'Hide All Features' : 'Show All Features'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#D4EABD', padding: '12px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #ccc' }}>
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          style={{
            background: !isDirty || isSaving ? '#aaa' : '#4A7A30',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: !isDirty || isSaving ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default F11CompanyFeatures;
