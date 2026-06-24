// @ts-nocheck
import React, { useState } from "react";
import { Building2, Settings, FileText, Printer, Plug, Save } from "lucide-react";
import { useStore } from "../store";
import { ActionToolbar } from "../components/ui";
import { PillTitle, FormPanel } from "../components/BusyShell";

export default function CompanySettings() {
  const { companySettings, updateCompanySettings, currentFiscalYear } = useStore();
  const [activeTab, setActiveTab] = useState<"general"|"tax"|"print"|"fiscal">("general");
  const [formData, setFormData] = useState(companySettings);

  const handleSave = () => {
    updateCompanySettings(formData);
    alert("Settings saved successfully");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (


    <div style={{ background: "#e8e4f0", padding: 12 }}>


      <PillTitle title="Modify Company" />


      <FormPanel>


        <div className="flex flex-col gap-4 animate-fadeIn pb-4 text-xs select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Company Settings</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Business profile and preferences</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      </div>

      <div className="flex items-center gap-0 border-b mb-4" style={{ borderColor: "var(--border)" }}>
        {[{key:"general",label:"Company Profile"},{key:"tax",label:"Tax & Compliance"},{key:"print",label:"Print Settings"},{key:"fiscal",label:"Fiscal Year"}].map(({key,label}) => (
          <button key={key} type="button" onClick={() => setActiveTab(key as any)}
            className={`h-9 px-4 text-[12px] font-semibold transition-colors border-b-2 -mb-px cursor-pointer ${activeTab === key ? "border-[#1557b0] text-[#1557b0]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === "general" && (
          <div className="space-y-4">
            {/* Company Profile section */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Company Profile</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Company Name (English) *</label>
                  <input
                    type="text"
                    value={formData.companyNameEn}
                    onChange={(e) => setFormData({ ...formData, companyNameEn: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Company Name (Nepali) *</label>
                  <input
                    type="text"
                    value={formData.companyNameNe}
                    onChange={(e) => setFormData({ ...formData, companyNameNe: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Business Type</label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  >
                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Pvt. Ltd.">Pvt. Ltd.</option>
                    <option value="Public Ltd.">Public Ltd.</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Company Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                  {formData.logo && (
                    <img src={formData.logo} alt="Logo" className="mt-2 h-12 object-contain" />
                  )}
                </div>
              </div>
            </div>

            {/* Address section */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Address Details</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Registered Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Province</label>
                  <select
                    value={formData.province || ""}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  >
                    <option value="">Select Province</option>
                    <option value="Koshi">Koshi</option>
                    <option value="Madhesh">Madhesh</option>
                    <option value="Bagmati">Bagmati</option>
                    <option value="Gandaki">Gandaki</option>
                    <option value="Lumbini">Lumbini</option>
                    <option value="Karnali">Karnali</option>
                    <option value="Sudurpashchim">Sudurpashchim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>
              </div>
            </div>

            {/* Contact section */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Contact Information</h3>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Website</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tax" && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Tax Registration</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">IRD PAN No.</label>
                  <input
                    type="text"
                    value={formData.tax_registration_number}
                    onChange={(e) => setFormData({ ...formData, tax_registration_number: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    maxLength={9}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">PAN/VAT No.</label>
                  <input
                    type="text"
                    value={formData.vatNumber}
                    onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">VAT Filing Frequency</label>
                  <select
                    value={formData.vatFilingFrequency || "monthly"}
                    onChange={(e) => setFormData({ ...formData, vatFilingFrequency: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="trimestral">Trimestral (Quarterly)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Nepal IRD e-Billing Integration</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="border-l-4 border-blue-400 bg-blue-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Plug className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <div className="text-sm text-blue-700">
                        <p>Status: <span className="font-semibold">Not Configured</span></p>
                        <p className="mt-1">Configure your IRD API credentials to enable electronic billing compliance.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Data Export Format</label>
                  <select
                    value={formData.exportFormat}
                    onChange={(e) => setFormData({ ...formData, exportFormat: e.target.value })}
                    className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  >
                    <option value="Excel">Excel (.xlsx)</option>
                    <option value="CSV">CSV</option>
                    <option value="PDF">PDF</option>
                    <option value="JSON">JSON</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "print" && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Invoice Print Preferences</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Paper Size</label>
                <select
                  value={formData.paperSize}
                  onChange={(e) => setFormData({ ...formData, paperSize: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Invoice Template</label>
                <select
                  value={formData.invoiceTemplate}
                  onChange={(e) => setFormData({ ...formData, invoiceTemplate: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="Standard">Standard</option>
                  <option value="Modern">Modern</option>
                  <option value="Minimal">Minimal</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Authorized Signatory Name</label>
                <input
                  type="text"
                  value={formData.signatoryName}
                  onChange={(e) => setFormData({ ...formData, signatoryName: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Terms & Conditions</label>
                <textarea
                  value={formData.termsConditions}
                  onChange={(e) => setFormData({ ...formData, termsConditions: e.target.value })}
                  className="p-2 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  rows={3}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Invoice Footer Text</label>
                <textarea
                  value={formData.invoiceFooter}
                  onChange={(e) => setFormData({ ...formData, invoiceFooter: e.target.value })}
                  className="p-2 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  rows={2}
                />
              </div>
              <div className="col-span-2 space-y-2 mt-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.printLogo}
                    onChange={(e) => setFormData({ ...formData, printLogo: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-[12px] font-medium text-gray-700">Print Company Logo on Invoice</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.printBankDetails}
                    onChange={(e) => setFormData({ ...formData, printBankDetails: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-[12px] font-medium text-gray-700">Print Bank Details on Invoice</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === "fiscal" && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Current Fiscal Year</h3>
            </div>
            <div className="p-4">
              {currentFiscalYear ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Name</div>
                    <div className="font-bold text-[13px] text-gray-800 mt-0.5">{currentFiscalYear.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Status</div>
                    <div className="mt-0.5">
                      <span className="badge bg-green-50 text-green-700 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase">{currentFiscalYear.status}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Format</div>
                    <div className="text-[12px] text-gray-700 font-mono mt-0.5">YYYY/YYYY BS</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Start Date (AD)</div>
                    <div className="text-[12px] text-gray-700 font-mono mt-0.5">{currentFiscalYear.startDate}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">End Date (AD)</div>
                    <div className="text-[12px] text-gray-700 font-mono mt-0.5">{currentFiscalYear.endDate}</div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-xs">No active fiscal year configured.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

      </FormPanel>

    </div>
  );
}

