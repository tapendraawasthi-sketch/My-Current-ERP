import React from "react";

interface Props {
  data: any;
  onChange: (data: any) => void;
}

export default function Step1CompanyProfile({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#000000]">Company Profile</h2>
        <p className="text-sm text-[#000000] mt-1">Tell us about your business</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">
            Company Name (English) *
          </label>
          <input
            type="text"
            value={data.companyNameEn}
            onChange={(e) => onChange({ ...data, companyNameEn: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
            placeholder="ABC Trading Pvt. Ltd."
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">
            Company Name (Nepali)
          </label>
          <input
            type="text"
            value={data.companyNameNe}
            onChange={(e) => onChange({ ...data, companyNameNe: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            placeholder="एबिसी ट्रेडिंग प्रा. लि."
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">
            Business Type *
          </label>
          <select
            value={data.businessType}
            onChange={(e) => onChange({ ...data, businessType: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
          >
            <option value="">Select Business Type</option>
            <option value="Sole Proprietorship">Sole Proprietorship</option>
            <option value="Partnership">Partnership</option>
            <option value="Pvt. Ltd.">Private Limited</option>
            <option value="Public Ltd.">Public Limited</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">Address *</label>
          <input
            type="text"
            value={data.address}
            onChange={(e) => onChange({ ...data, address: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
            placeholder="Thamel, Kathmandu"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">City *</label>
            <input
              type="text"
              value={data.city}
              onChange={(e) => onChange({ ...data, city: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              required
              placeholder="Kathmandu"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">Phone *</label>
            <input
              type="text"
              value={data.phone}
              onChange={(e) => onChange({ ...data, phone: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              required
              placeholder="01-4123456"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">Email *</label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
            placeholder="info@company.com"
          />
        </div>
      </div>
    </div>
  );
}
