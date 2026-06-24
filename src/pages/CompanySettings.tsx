// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Save, Plug } from "lucide-react";
import { PillTitle, FormPanel } from "../components/BusyShell";
import toast from 'react-hot-toast';

export default function CompanySettings() {
  const [activeTab, setActiveTab] = useState<"general"|"tax"|"print"|"fiscal"|"email">("general");
  const [formData, setFormData] = useState({
    company_name: '', company_name_nepali: '', address: '', city: '', district: '',
    province: '', country: 'Nepal', phone: '', mobile: '', email: '', website: '',
    pan_number: '', vat_number: '', registration_number: '', fiscal_year_type: 'BS',
    currency_symbol: '₨', currency_code: 'NPR', date_format: 'BS', language: 'en',
    decimal_places: 2, enable_vat: true, vat_rate: 13.00, enable_tds: false, tds_rate: 0,
    invoice_prefix: 'INV', receipt_prefix: 'RCP', voucher_prefix: 'VCH',
    smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', smtp_from: '',
    theme_color: '#1a2744', enable_nepali_date: true, show_both_dates: true,
    financial_year_start_month: 4, logo_url: ''
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/company/settings');
      const json = await res.json();
      if (json.success && json.data) {
        setFormData(prev => ({ ...prev, ...json.data }));
      }
    } catch (err) {
      toast.error('Failed to load company settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/company/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Settings saved successfully!");
        setFormData(json.data);
        setIsDirty(false);
      } else {
        toast.error(json.error || 'Validation error');
      }
    } catch (err) {
      toast.error('Network error. Failed to save.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const form = new FormData();
      form.append('logo', file);
      try {
        const res = await fetch('/api/company/settings/logo', {
          method: 'POST',
          body: form
        });
        const json = await res.json();
        if (json.success) {
          handleChange('logo_url', json.data.logoUrl);
          toast.success("Logo uploaded successfully");
        } else {
          toast.error(json.error || 'Logo upload failed');
        }
      } catch(err) {
        toast.error('Network error during upload');
      }
    }
  };

  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    try {
      const res = await fetch('/api/company/settings/test-email');
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
      } else {
        toast.error(json.error || 'SMTP Test Failed');
      }
    } catch (err) {
      toast.error('Network error during SMTP test');
    } finally {
      setTestEmailLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-[#000000]">Loading settings...</div>;
  }

  return (
    <div style={{ background: "#f5f6fa", padding: 12, minHeight: "100vh" }}>
      <PillTitle title="Modify Company" />
      <FormPanel>
        <div className="flex flex-col gap-4 animate-fadeIn pb-4 text-xs select-none">
          <div className="page-header">
  <div>
    <div className="page-title">Company Settings</div>
    <div className="page-subtitle">Business profile and preferences</div>
  </div>
  <div className="page-actions">
    <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty}
                className={`h-8 px-3 text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer transition-colors ${isDirty ? 'bg-[#3D6B25] hover:bg-[#2D5A1A] text-white' : 'bg-[#EBF5E2] text-[#000000] cursor-not-allowed'}`}
              >
                <Save className="w-4 h-4" /> Save Settings
              </button>
  </div>
</div>

          <div className="flex items-center gap-0 border-b border-[#9DC07A] mb-4">
            {[
              {key:"general", label:"Basic Info"},
              {key:"fiscal", label:"Financial"},
              {key:"print", label:"Date & Display"},
              {key:"email", label:"Email / SMTP"}
            ].map(({key,label}) => (
              <button key={key} type="button" onClick={() => setActiveTab(key as any)}
                className={`h-9 px-4 text-[12px] font-semibold transition-colors border-b-2 -mb-px cursor-pointer ${activeTab === key ? "border-[#1557b0] text-[#1557b0]" : "border-transparent text-[#000000] hover:text-[#000000]"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {activeTab === "general" && (
              <div className="space-y-4">
                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">Company Profile</h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">Company Name (English) *</label>
                      <input
                        type="text" value={formData.company_name} onChange={(e) => handleChange('company_name', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">Company Name (Nepali)</label>
                      <input
                        type="text" value={formData.company_name_nepali} onChange={(e) => handleChange('company_name_nepali', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">Company Logo</label>
                      <input
                        type="file" accept="image/*" onChange={handleLogoUpload}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                      />
                      {formData.logo_url && (
                        <img src={formData.logo_url} alt="Logo" className="mt-2 h-12 object-contain" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                    <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">Address & Contact</h3>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">Address</label>
                      <input type="text" value={formData.address} onChange={(e) => handleChange('address', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">City</label>
                      <input type="text" value={formData.city} onChange={(e) => handleChange('city', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">District</label>
                      <input type="text" value={formData.district} onChange={(e) => handleChange('district', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">Province</label>
                      <input type="text" value={formData.province} onChange={(e) => handleChange('province', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">Phone</label>
                      <input type="text" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">Email</label>
                      <input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">PAN No.</label>
                      <input type="text" maxLength={9} value={formData.pan_number} onChange={(e) => handleChange('pan_number', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#000000] mb-1">VAT No.</label>
                      <input type="text" value={formData.vat_number} onChange={(e) => handleChange('vat_number', e.target.value)}
                        className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "fiscal" && (
              <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                  <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">Financial Settings</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Currency Symbol</label>
                    <input type="text" value={formData.currency_symbol} onChange={(e) => handleChange('currency_symbol', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Decimal Places</label>
                    <input type="number" value={formData.decimal_places} onChange={(e) => handleChange('decimal_places', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Fiscal Year Start Month (BS)</label>
                    <select value={formData.financial_year_start_month} onChange={(e) => handleChange('financial_year_start_month', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white">
                      {['Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'].map((m,i)=> (
                        <option key={i} value={i+1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">VAT Rate (%)</label>
                    <input type="number" value={formData.vat_rate} onChange={(e) => handleChange('vat_rate', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Enable VAT</label>
                    <input type="checkbox" checked={formData.enable_vat} onChange={(e) => handleChange('enable_vat', e.target.checked)}
                      className="rounded border-[#9DC07A]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Enable TDS</label>
                    <input type="checkbox" checked={formData.enable_tds} onChange={(e) => handleChange('enable_tds', e.target.checked)}
                      className="rounded border-[#9DC07A]" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "print" && (
              <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2]">
                  <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">Date & Display</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Date Format</label>
                    <select value={formData.date_format} onChange={(e) => handleChange('date_format', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white">
                      <option value="BS">Nepali (B.S.)</option>
                      <option value="AD">English (A.D.)</option>
                      <option value="BOTH">Both (BS & AD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Language</label>
                    <select value={formData.language} onChange={(e) => handleChange('language', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white">
                      <option value="en">English</option>
                      <option value="np">Nepali</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">Theme Color</label>
                    <input type="color" value={formData.theme_color} onChange={(e) => handleChange('theme_color', e.target.value)}
                      className="h-8 w-16 p-1 border border-[#9DC07A] rounded-md bg-white cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "email" && (
              <div className="bg-white border border-[#9DC07A] rounded-lg overflow-hidden mb-4">
                <div className="px-4 py-2.5 border-b border-[#9DC07A] bg-[#EBF5E2] flex justify-between items-center">
                  <h3 className="text-[11px] font-semibold text-[#000000] uppercase tracking-wider">SMTP Configuration</h3>
                  <button 
                    type="button" 
                    onClick={handleTestEmail}
                    disabled={testEmailLoading}
                    className="h-7 px-3 bg-white border border-[#9DC07A] text-[#000000] text-[11px] font-medium rounded-md hover:bg-[#EBF5E2] cursor-pointer"
                  >
                    {testEmailLoading ? 'Sending...' : 'Send Test Email'}
                  </button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">SMTP Host</label>
                    <input type="text" value={formData.smtp_host} onChange={(e) => handleChange('smtp_host', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white" placeholder="e.g. smtp.gmail.com" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">SMTP Port</label>
                    <input type="number" value={formData.smtp_port} onChange={(e) => handleChange('smtp_port', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white" placeholder="587" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">SMTP User</label>
                    <input type="text" value={formData.smtp_user} onChange={(e) => handleChange('smtp_user', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">SMTP Password</label>
                    <input type="password" value={formData.smtp_pass} onChange={(e) => handleChange('smtp_pass', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#000000] mb-1">From Email Address</label>
                    <input type="email" value={formData.smtp_from} onChange={(e) => handleChange('smtp_from', e.target.value)}
                      className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white" placeholder="no-reply@mycompany.com" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </FormPanel>
    </div>
  );
}
