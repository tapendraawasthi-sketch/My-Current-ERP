import React from "react";
import { X, Printer, Download } from "lucide-react";

interface CompanySettings {
  companyNameEn: string;
  companyNameNe?: string;
  address: string;
  city: string;
  phone: string;
  panNumber: string;
  logo?: string;
}

interface Props {
  company: CompanySettings;
  reportTitle: string;
  reportSubtitle?: string;
  periodInfo?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export default function ReportPrint({
  company,
  reportTitle,
  reportSubtitle,
  periodInfo,
  children,
  onClose,
}: Props) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:relative print:bg-white">
      <div className="bg-white w-full max-w-6xl max-h-[95vh] overflow-auto print:max-w-none print:max-h-none print:overflow-visible">
        {/* Non-print controls */}
        <div className="flex justify-between items-center p-4 border-b print:hidden">
          <h2 className="text-xl font-bold">Report Preview</h2>
          <div className="flex space-x-2">
            <button onClick={handlePrint} className="btn-primary flex items-center space-x-2">
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button onClick={handleDownloadPDF} className="btn-primary flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            {onClose && (
              <button onClick={onClose} className="text-[#000000] hover:text-[#000000]">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Printable content */}
        <div className="p-8 print:p-12">
          {/* Report Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-4">
              {company.logo && (
                <img src={company.logo} alt="Company Logo" className="h-16 w-auto mr-4" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-[#000000]">{company.companyNameEn}</h1>
                {company.companyNameNe && (
                  <h2 className="text-lg text-[#000000]">{company.companyNameNe}</h2>
                )}
              </div>
            </div>
            <p className="text-sm text-[#000000]">
              {company.address}, {company.city}
            </p>
            <p className="text-sm text-[#000000]">
              Phone: {company.phone} | PAN: {company.panNumber}
            </p>
          </div>

          <div className="border-t-2 border-[var(--ds-border-default)] mb-6"></div>

          {/* Report Title */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-[#000000] mb-1">{reportTitle}</h3>
            {reportSubtitle && <p className="text-sm text-[#000000]">{reportSubtitle}</p>}
            {periodInfo && <p className="text-sm text-[#000000] mt-1">{periodInfo}</p>}
          </div>

          {/* Report Content */}
          <div className="mb-6">{children}</div>

          {/* Report Footer */}
          <div className="border-t-2 border-[var(--ds-border-default)] pt-4 mt-8">
            <div className="flex justify-between items-center">
              <div className="text-xs text-[#000000]">
                <p>
                  Generated on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                </p>
                <p className="mt-1">Fiscal Year: 2083/84</p>
              </div>
              <div className="text-right">
                <div className="border-t border-[var(--ds-border-default)] pt-2 w-48 ml-auto">
                  <p className="text-sm font-semibold">Authorized Signature</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-[#000000] italic text-center mt-4">
              This is a computer generated report
            </p>
          </div>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:relative,
          .print\\:relative * {
            visibility: visible;
          }
          .print\\:relative {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4 landscape;
            margin: 0.5cm;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
    </div>
  );
}
