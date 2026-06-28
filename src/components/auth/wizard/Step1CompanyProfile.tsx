// @ts-nocheck
import React from "react";

const NEPAL_PROVINCES = [
  "Koshi Province (Province 1)",
  "Madhesh Province",
  "Bagmati Province",
  "Gandaki Province",
  "Lumbini Province",
  "Karnali Province",
  "Sudurpashchim Province",
];

const NEPAL_DISTRICTS: Record<string, string[]> = {
  "Koshi Province (Province 1)": ["Taplejung","Panchthar","Ilam","Jhapa","Morang","Sunsari","Dhankuta","Terhathum","Sankhuwasabha","Bhojpur","Solukhumbu","Okhaldhunga","Khotang","Udayapur"],
  "Madhesh Province": ["Saptari","Siraha","Dhanusha","Mahottari","Sarlahi","Rautahat","Bara","Parsa"],
  "Bagmati Province": ["Sindhuli","Ramechhap","Dolakha","Sindhupalchok","Kavrepalanchok","Lalitpur","Bhaktapur","Kathmandu","Nuwakot","Rasuwa","Dhading","Makwanpur","Chitwan"],
  "Gandaki Province": ["Gorkha","Manang","Mustang","Myagdi","Kaski","Lamjung","Tanahu","Nawalpur","Syangja","Parbat","Baglung"],
  "Lumbini Province": ["Rupandehi","Kapilvastu","Arghakhanchi","Palpa","Nawalparasi (West)","Gulmi","Dang","Pyuthan","Rolpa","Rukum (East)","Banke","Bardiya"],
  "Karnali Province": ["Dolpa","Mugu","Humla","Jumla","Kalikot","Dailekh","Jajarkot","Rukum (West)","Salyan","Surkhet"],
  "Sudurpashchim Province": ["Bajura","Bajhang","Darchula","Baitadi","Dadeldhura","Doti","Achham","Kailali","Kanchanpur"],
};

interface Props {
  data: any;
  onChange: (data: any) => void;
}

export default function Step1CompanyProfile({ data, onChange }: Props) {
  const handleProvinceChange = (value: string) => {
    onChange({ ...data, province: value, district: '' });
  };
  const availableDistricts = data.province ? (NEPAL_DISTRICTS[data.province] || []) : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#000000]">Company Profile</h2>
        <p className="text-sm text-[#000000] mt-1">Tell us about your business</p>
      </div>

      <div className="space-y-4">
        {/* Section 1 - Company Identity */}
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">
              Company Name (English)*
            </label>
            <input
              type="text"
              value={data.companyNameEn || ''}
              onChange={(e) => onChange({ ...data, companyNameEn: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              required
              placeholder="Enter company name in English"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">
              Company Name (Nepali)
            </label>
            <input
              type="text"
              value={data.companyNameNe || ''}
              onChange={(e) => onChange({ ...data, companyNameNe: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              placeholder="कम्पनी नाम नेपालीमा प्रविष्ट गर्नुहोस्"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">
              Business Type*
            </label>
            <select
              value={data.businessType || ''}
              onChange={(e) => onChange({ ...data, businessType: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              required
            >
              <option value="">— Select Business Type —</option>
              <option value="Sole Proprietorship">Sole Proprietorship</option>
              <option value="Partnership">Partnership</option>
              <option value="Pvt. Ltd.">Pvt. Ltd.</option>
              <option value="Public Ltd.">Public Ltd.</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">
              Business Description
            </label>
            <textarea
              value={data.businessDescription || ''}
              onChange={(e) => onChange({ ...data, businessDescription: e.target.value })}
              className="h-20 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full resize-none"
              placeholder="e.g. Trading company dealing in electronics and accessories"
              maxLength={200}
            />
            <p className="text-[10px] text-[#000000] mt-0.5">
              {(data.businessDescription || '').length}/200 characters
            </p>
          </div>
        </div>

        {/* Section 2 - Address */}
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">
              Address*
            </label>
            <input
              type="text"
              value={data.address || ''}
              onChange={(e) => onChange({ ...data, address: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              required
              placeholder="Street / Tole"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-[#000000] mb-1">
                Province*
              </label>
              <select
                value={data.province || ''}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                required
              >
                <option value="">— Select Province —</option>
                {NEPAL_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#000000] mb-1">
                District
              </label>
              <select
                value={data.district || ''}
                onChange={(e) => onChange({ ...data, district: e.target.value })}
                className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={availableDistricts.length === 0}
              >
                <option value="">
                  {availableDistricts.length === 0 ? '— Select Province first —' : '— Select District —'}
                </option>
                {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-[#000000] mb-1">
                City*
              </label>
              <input
                type="text"
                value={data.city || ''}
                onChange={(e) => onChange({ ...data, city: e.target.value })}
                className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                required
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#000000] mb-1">
                Ward / Tole No.
              </label>
              <input
                type="text"
                value={data.wardNumber || ''}
                onChange={(e) => onChange({ ...data, wardNumber: e.target.value })}
                className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                placeholder="e.g. Ward 12"
              />
            </div>
          </div>
        </div>

        {/* Section 3 - Contact */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-[#000000] mb-1">
                Phone*
              </label>
              <input
                type="text"
                value={data.phone || ''}
                onChange={(e) => onChange({ ...data, phone: e.target.value })}
                className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                required
                placeholder="01-4XXXXXX or 98XXXXXXXX"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#000000] mb-1">
                Mobile
              </label>
              <input
                type="text"
                value={data.mobile || ''}
                onChange={(e) => onChange({ ...data, mobile: e.target.value })}
                className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                placeholder="98XXXXXXXX"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">
              Email*
            </label>
            <input
              type="email"
              value={data.email || ''}
              onChange={(e) => onChange({ ...data, email: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              required
              placeholder="info@company.com"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">
              Website
            </label>
            <input
              type="url"
              value={data.website || ''}
              onChange={(e) => onChange({ ...data, website: e.target.value })}
              className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              placeholder="https://www.yourcompany.com.np"
            />
          </div>
        </div>

        <div className="bg-[#EBF5E2] border border-[#9DC07A] rounded p-2 text-[11px] text-[#000000]">
          <strong>Nepal Address Tip:</strong> For IRD/VAT invoices, your registered province and district must match your IRD registration. Make sure to select the correct province first, then your district.
        </div>
      </div>
    </div>
  );
}
