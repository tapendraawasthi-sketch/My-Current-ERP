import React from "react";

interface Props {
  data: any;
  onChange: (data: any) => void;
}

export default function Step2TaxRegistration({ data, onChange }: Props) {
  const validatePAN = (pan: string) => {
    return /^\d{9}$/.test(pan);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Tax Registration</h2>
        <p className="text-sm text-gray-600 mt-1">Enter your tax registration details</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            PAN Number * (9 digits)
          </label>
          <input
            type="text"
            value={data.panNumber}
            onChange={(e) => onChange({ ...data, panNumber: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
            maxLength={9}
            placeholder="123456789"
          />
          {data.panNumber && !validatePAN(data.panNumber) && (
            <p className="text-xs text-red-600 mt-1">PAN must be exactly 9 digits</p>
          )}
        </div>

        <div>
          <label className="flex items-center space-x-2 mb-3">
            <input
              type="checkbox"
              checked={data.hasVAT}
              onChange={(e) => onChange({ ...data, hasVAT: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">VAT Registered</span>
          </label>

          {data.hasVAT && (
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                VAT Registration Number
              </label>
              <input
                type="text"
                value={data.vatNumber}
                onChange={(e) => onChange({ ...data, vatNumber: e.target.value })}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                placeholder="VAT Number"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            IRD Office (Province) *
          </label>
          <select
            value={data.irdProvince}
            onChange={(e) => onChange({ ...data, irdProvince: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
          >
            <option value="">Select Province</option>
            <option value="Province 1">Province 1 (Koshi)</option>
            <option value="Madhesh">Madhesh Province</option>
            <option value="Bagmati">Bagmati Province</option>
            <option value="Gandaki">Gandaki Province</option>
            <option value="Lumbini">Lumbini Province</option>
            <option value="Karnali">Karnali Province</option>
            <option value="Sudurpashchim">Sudurpashchim Province</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Fiscal Year *</label>
          <select
            value={data.fiscalYear}
            onChange={(e) => onChange({ ...data, fiscalYear: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
          >
            <option value="">Select Fiscal Year</option>
            <option value="2080/81">2080/81</option>
            <option value="2081/82">2081/82</option>
            <option value="2082/83">2082/83</option>
            <option value="2083/84">2083/84</option>
            <option value="2084/85">2084/85</option>
          </select>
        </div>
      </div>
    </div>
  );
}
