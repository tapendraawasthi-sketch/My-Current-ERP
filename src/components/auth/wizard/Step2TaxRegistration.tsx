// @ts-nocheck
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
        <h2 className="text-2xl font-bold text-[#000000]">Tax Registration</h2>
        <p className="text-sm text-[#000000] mt-1">
          Enter your tax registration details for Nepal IRD compliance
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">
            PAN / VAT Registration Number *{" "}
            <span className="text-[#000000] font-normal">
              ({(data.panNumber || "").length}/9 digits)
            </span>
          </label>
          <input
            type="text"
            maxLength={9}
            value={data.panNumber || ""}
            onChange={(e) => onChange({ ...data, panNumber: e.target.value.replace(/\D/g, "") })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
            placeholder="e.g. 123456789"
          />
          {!data.panNumber || !/^\d{9}$/.test(data.panNumber) ? (
            <p className="text-red-600 text-[10px] mt-0.5">
              PAN must be exactly 9 digits (numbers only)
            </p>
          ) : (
            <p className="text-green-600 text-[10px] mt-0.5">✓ Valid PAN format</p>
          )}
          <p className="text-[10px] text-[#000000] mt-1 bg-[#EBF5E2] border border-[#9DC07A] rounded px-2 py-1">
            In Nepal, your PAN and VAT Registration Number are the same 9-digit number for
            VAT-registered businesses.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded p-2 text-[11px] text-[#000000]">
          <strong>Nepal VAT Threshold:</strong> Annual turnover above NPR 50 lakh (NPR 5,000,000)
          requires mandatory VAT registration under Nepal Income Tax Act. Businesses below this
          threshold may register voluntarily.
        </div>

        <div>
          <label className="flex items-center space-x-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.hasVAT || false}
              onChange={(e) =>
                onChange({
                  ...data,
                  hasVAT: e.target.checked,
                  vatNumber: e.target.checked ? data.panNumber : "",
                })
              }
              className="rounded border-[#9DC07A] h-4 w-4"
            />
            <span className="text-[12px] font-medium text-[#000000]">VAT Registered</span>
          </label>

          {data.hasVAT && (
            <div className="space-y-3 pl-6">
              <div>
                <label className="block text-[11px] font-medium text-[#000000] mb-1">
                  VAT Registration Number
                </label>
                <input
                  type="text"
                  value={data.vatNumber || ""}
                  onChange={(e) => onChange({ ...data, vatNumber: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  placeholder="VAT registration number (same as PAN)"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#000000] mb-1">
                  VAT Registration Date
                </label>
                <input
                  type="date"
                  value={data.vatRegistrationDate || ""}
                  onChange={(e) => onChange({ ...data, vatRegistrationDate: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
                <p className="text-[10px] text-[#000000] mt-0.5">
                  Date when IRD registered your business for VAT
                </p>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">
            IRD Office Province *
          </label>
          <select
            value={data.irdProvince || ""}
            onChange={(e) => onChange({ ...data, irdProvince: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
          >
            <option value="">— Select Province —</option>
            <option value="Koshi">Koshi Province</option>
            <option value="Madhesh">Madhesh Province</option>
            <option value="Bagmati">Bagmati Province</option>
            <option value="Gandaki">Gandaki Province</option>
            <option value="Lumbini">Lumbini Province</option>
            <option value="Karnali">Karnali Province</option>
            <option value="Sudurpashchim">Sudurpashchim Province</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">
            IRD Tax Office Branch Name
          </label>
          <input
            type="text"
            value={data.irdOfficeName || ""}
            onChange={(e) => onChange({ ...data, irdOfficeName: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            placeholder="e.g. Large Taxpayer Office, IRO Kathmandu, IRO Pokhara"
          />
          <p className="text-[10px] text-[#000000] mt-0.5">
            Optional: Specify your local IRD branch for TDS challan references
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#000000] mb-1">Fiscal Year *</label>
          <select
            value={data.fiscalYear || ""}
            onChange={(e) => onChange({ ...data, fiscalYear: e.target.value })}
            className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            required
          >
            <option value="">— Select Fiscal Year —</option>
            <option value="2080/81">2080/81</option>
            <option value="2081/82">2081/82</option>
            <option value="2082/83">2082/83</option>
            <option value="2083/84">2083/84</option>
            <option value="2084/85">2084/85</option>
            <option value="2085/86">2085/86</option>
          </select>
        </div>

        <div>
          <label className="flex items-center space-x-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.hasExcise || false}
              onChange={(e) =>
                onChange({ ...data, hasExcise: e.target.checked, exciseRegNumber: "" })
              }
              className="rounded border-[#9DC07A] h-4 w-4"
            />
            <span className="text-[12px] font-medium text-[#000000]">Excise Liable Business</span>
          </label>
          <p className="text-[10px] text-[#000000] mb-2">
            Check if your business deals in alcohol, tobacco, petroleum, or vehicles (subject to
            Nepal Excise Duty)
          </p>
          {data.hasExcise && (
            <div>
              <label className="block text-[11px] font-medium text-[#000000] mb-1">
                Excise Registration Number
              </label>
              <input
                type="text"
                value={data.exciseRegNumber || ""}
                onChange={(e) => onChange({ ...data, exciseRegNumber: e.target.value })}
                className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                placeholder="Excise registration number from IRD"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#EBF5E2] border border-[#9DC07A] rounded p-3 text-[11px] text-[#000000]">
        <strong>Nepal Tax Summary:</strong>
        <ul className="mt-1 space-y-0.5 list-disc list-inside">
          <li>PAN: 9-digit Permanent Account Number from IRD</li>
          <li>VAT: 13% Value Added Tax — mandatory above NPR 50 lakh turnover</li>
          <li>TDS: Income tax withheld on specified payments (configure in Company Features)</li>
          <li>Excise: Applicable on alcohol, tobacco, petroleum, vehicles</li>
        </ul>
      </div>
    </div>
  );
}
