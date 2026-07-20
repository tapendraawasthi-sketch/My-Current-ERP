import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import TdsCertificate from "../components/TdsCertificate";
import { FileCheck } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";

const TdsCertificatePage: React.FC = () => {
  const { parties, tdsEntries, companySettings, currentFiscalYear } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [partyId, setPartyId] = useState("");
  const [fiscalYearBS, setFiscalYearBS] = useState(
    currentFiscalYear?.fiscalYearBS || currentFiscalYear?.name || "2081/2082",
  );
  const [authorizedPersonName, setAuthorizedPersonName] = useState(
    companySettings?.authorizedSignatory || "",
  );
  const [authorizedPersonDesignation, setAuthorizedPersonDesignation] = useState(
    companySettings?.signatoryDesignation || "Accountant",
  );
  const [certificateDateBS, setCertificateDateBS] = useState("");

  const scopedParties = useMemo(
    () => parties.filter((p) => matchBranch((p as { branchId?: string }).branchId)),
    [parties, matchBranch, branchFilter],
  );

  const party = useMemo(() => scopedParties.find((p) => p.id === partyId), [scopedParties, partyId]);

  const payments = useMemo(() => {
    return tdsEntries
      .filter(
        (e) =>
          e.partyId === partyId &&
          matchBranch((e as { branchId?: string }).branchId) &&
          (e.fiscalYearBS === fiscalYearBS || !fiscalYearBS) &&
          Number(e.tdsAmount || 0) > 0,
      )
      .map((e) => ({
        id: e.id,
        date: e.date || "",
        dateNepali: e.dateBS || e.dateNepali || e.date || "",
        voucherNo: e.voucherNo || e.invoiceNo || e.id,
        tdsSection: e.tdsSectionId || e.section || "",
        grossAmount: Number(e.grossAmount || 0),
        tdsRate: Number(e.tdsRate || 0),
        tdsAmount: Number(e.tdsAmount || 0),
      }));
  }, [tdsEntries, partyId, fiscalYearBS, matchBranch, branchFilter]);

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-[var(--ds-action-primary)]" />
            TDS Certificate
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Generate certificate of tax deduction at source for deductees
          </p>
        </div>
        {branchOptions.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            aria-label="Branch"
          >
            <option value="all">All branches</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.code || b.id}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 no-print">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 block">Deductee</label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
            >
              <option value="">— Select Party —</option>
              {scopedParties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 block">
              Fiscal Year (BS)
            </label>
            <input
              type="text"
              value={fiscalYearBS}
              onChange={(e) => setFiscalYearBS(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 block">
              Certificate Date (BS)
            </label>
            <input
              type="text"
              value={certificateDateBS}
              onChange={(e) => setCertificateDateBS(e.target.value)}
              placeholder="2081-09-15"
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 block">
              Authorized Person
            </label>
            <input
              type="text"
              value={authorizedPersonName}
              onChange={(e) => setAuthorizedPersonName(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 block">Designation</label>
            <input
              type="text"
              value={authorizedPersonDesignation}
              onChange={(e) => setAuthorizedPersonDesignation(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
            />
          </div>
        </div>
      </div>

      {!partyId ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-[12px] text-gray-500">
          Select a deductee party to preview the TDS certificate.
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-[12px] text-gray-500">
          No TDS entries found for {party?.name} in fiscal year {fiscalYearBS}.
        </div>
      ) : (
        <TdsCertificate
          company={{
            name: companySettings?.name || "Company",
            nameNepali: companySettings?.nameNepali,
            panNumber: companySettings?.panNumber,
            address: companySettings?.address,
          }}
          deductee={{
            name: party?.name || "",
            pan: party?.pan,
            address: party?.address,
          }}
          payments={payments}
          fiscalYearBS={fiscalYearBS}
          authorizedPersonName={authorizedPersonName}
          authorizedPersonDesignation={authorizedPersonDesignation}
          certificateDateBS={certificateDateBS}
        />
      )}
    </div>
  );
};

export default TdsCertificatePage;
