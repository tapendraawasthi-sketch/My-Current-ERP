import React, { useState } from "react";
import toast from "@/lib/appToast";
import { useStore } from "@/store/useStore";
import { useTopMenuContext } from "@/hooks/useTopMenuContext";
import {
  ModalShell,
  OutlineButton,
  PrimaryButton,
  SelectField,
  ToggleRow,
  TopMenuDropdown,
} from "./shared";

type PrintModalKey = "current" | "configure" | "reports" | "vouchers" | "settings" | "logs";

export default function PrintMenu() {
  const [activeModal, setActiveModal] = useState<PrintModalKey | null>(null);

  return (
    <>
      <TopMenuDropdown
        items={[
          { key: "current", label: "Print Current Screen", shortcut: "P" },
          { key: "configure", label: "Configure Print Format", shortcut: "C" },
          { key: "reports", label: "Print Reports", shortcut: "R" },
          { key: "vouchers", label: "Print Vouchers", shortcut: "V" },
          { key: "settings", label: "Printer Settings", shortcut: "S" },
          { key: "logs", label: "Print Logs", shortcut: "L" },
        ]}
        onSelect={(key) => setActiveModal(key as PrintModalKey)}
      />

      {activeModal === "current" && <PrintCurrentModal onClose={() => setActiveModal(null)} />}
      {activeModal === "configure" && <ConfigurePrintModal onClose={() => setActiveModal(null)} />}
      {activeModal === "settings" && <PrinterSettingsModal onClose={() => setActiveModal(null)} />}

      {(activeModal === "reports" || activeModal === "vouchers" || activeModal === "logs") && (
        <ModalShell
          title={
            activeModal === "reports"
              ? "Print Reports"
              : activeModal === "vouchers"
                ? "Print Vouchers"
                : "Print Logs"
          }
          onClose={() => setActiveModal(null)}
        >
          <div className="py-8 text-center text-[12px] text-gray-500">No print records found.</div>
        </ModalShell>
      )}
    </>
  );
}

function PrintCurrentModal({ onClose }: { onClose: () => void }) {
  const { context } = useTopMenuContext();
  const companySettings = useStore((state) => state.companySettings);

  const companyName = companySettings?.companyNameEn || companySettings?.name || "Sutra ERP";
  const pan = companySettings?.panNumber || companySettings?.vatNumber || "—";
  const address = companySettings?.address || "Nepal";
  const phone = companySettings?.phone || "—";

  return (
    <ModalShell
      title={`Print Preview — ${context.label}`}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          <OutlineButton onClick={() => toast.success("✓ PDF export queued")}>
            Export to PDF
          </OutlineButton>
          <PrimaryButton onClick={() => window.print()}>Print</PrimaryButton>
        </>
      }
    >
      <div className="no-print mb-3 flex gap-2">
        <button type="button" className="h-7 rounded border border-gray-300 px-2 text-[11px]">
          Zoom -
        </button>
        <button type="button" className="h-7 rounded border border-gray-300 px-2 text-[11px]">
          Zoom +
        </button>
      </div>

      <div className="rounded-md border border-gray-300 bg-white p-6 text-[12px] print:border-0">
        <div className="mb-4 border-b border-gray-300 pb-3 text-center">
          <div className="text-[15px] font-semibold text-gray-800">{companyName}</div>
          <div className="text-[11px] text-gray-600">{address}</div>
          <div className="text-[11px] text-gray-600">
            PAN: {pan} | Phone: {phone}
          </div>
        </div>

        <div className="mb-4 text-center text-[13px] font-semibold uppercase text-gray-800">
          {context.label}
        </div>

        <div className="h-64 rounded border border-dashed border-gray-300 p-4 text-center text-gray-500">
          Print content preview for {context.label}
        </div>
      </div>
    </ModalShell>
  );
}

function ConfigurePrintModal({ onClose }: { onClose: () => void }) {
  const tabs = ["Invoice", "Voucher", "Report", "Ledger"];
  const [activeTab, setActiveTab] = useState("Invoice");

  const [includeLogo, setIncludeLogo] = useState(true);
  const [includeAddress, setIncludeAddress] = useState(true);
  const [includePan, setIncludePan] = useState(true);
  const [signature, setSignature] = useState(true);
  const [terms, setTerms] = useState(true);
  const [narration, setNarration] = useState(true);
  const [voucherNo, setVoucherNo] = useState(true);
  const [pageSize, setPageSize] = useState("A4");
  const [orientation, setOrientation] = useState("Portrait");

  const save = () => {
    localStorage.setItem(
      "printConfig",
      JSON.stringify({
        activeTab,
        includeLogo,
        includeAddress,
        includePan,
        signature,
        terms,
        narration,
        voucherNo,
        pageSize,
        orientation,
      }),
    );

    toast.success("✓ Print configuration saved");
    onClose();
  };

  return (
    <ModalShell
      title="Configure Print Format"
      onClose={onClose}
      width="max-w-4xl"
      footer={<PrimaryButton onClick={save}>Save Format</PrimaryButton>}
    >
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`h-8 px-3 text-[12px] font-medium ${
              activeTab === tab ? "border-b-2 border-[#1557b0] text-[#1557b0]" : "text-gray-600"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Page Size"
          value={pageSize}
          onChange={setPageSize}
          options={["A4", "Letter", "A5"]}
        />
        <SelectField
          label="Orientation"
          value={orientation}
          onChange={setOrientation}
          options={["Portrait", "Landscape"]}
        />
      </div>

      <div className="mt-4">
        <ToggleRow label="Include Company Logo" checked={includeLogo} onChange={setIncludeLogo} />
        <ToggleRow
          label="Include Company Address"
          checked={includeAddress}
          onChange={setIncludeAddress}
        />
        <ToggleRow label="Include PAN" checked={includePan} onChange={setIncludePan} />
        <ToggleRow label="Include Signature Line" checked={signature} onChange={setSignature} />
        <ToggleRow label="Include Terms & Conditions" checked={terms} onChange={setTerms} />
        <ToggleRow label="Include Narration" checked={narration} onChange={setNarration} />
        <ToggleRow label="Include Voucher Number" checked={voucherNo} onChange={setVoucherNo} />
      </div>

      {activeTab === "Invoice" && (
        <div className="mt-4 rounded-md border border-gray-200 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase text-gray-500">
            Invoice Format
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            {["Standard Tax Invoice", "Simplified Invoice", "Retail Bill", "Thermal 80mm"].map(
              (format) => (
                <label key={format} className="rounded border border-gray-200 p-2 text-[11px]">
                  <input type="radio" name="invoiceFormat" className="mr-2 accent-[#1557b0]" />
                  {format}
                </label>
              ),
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function PrinterSettingsModal({ onClose }: { onClose: () => void }) {
  const [paperSize, setPaperSize] = useState("A4");
  const [margin, setMargin] = useState("Normal");

  const save = () => {
    localStorage.setItem("printerSettings", JSON.stringify({ paperSize, margin }));
    toast.success("✓ Printer settings saved");
    onClose();
  };

  return (
    <ModalShell
      title="Printer Settings"
      onClose={onClose}
      footer={<PrimaryButton onClick={save}>Save Settings</PrimaryButton>}
    >
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-[12px] text-blue-700">
        Browser apps cannot directly list system printers. Please set your default printer from the
        system print dialog.
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <SelectField
          label="Paper Size"
          value={paperSize}
          onChange={setPaperSize}
          options={["A4", "Letter", "A5"]}
        />
        <SelectField
          label="Margins"
          value={margin}
          onChange={setMargin}
          options={["None", "Narrow", "Normal", "Wide"]}
        />
      </div>
    </ModalShell>
  );
}
