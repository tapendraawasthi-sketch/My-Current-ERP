// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Printer, Eye, Upload, ChevronDown, ChevronRight, Settings, FileText, Image, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface PrintConfig {
  paperSize: 'A4' | 'A5' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  copies: number;
  printLogo: boolean;
  logoPosition: 'top-left' | 'top-center' | 'top-right';
  logoHeight: number;
  companyNameFont: string;
  companNameFontSize: number;
  printAddress: boolean;
  printGSTIN: boolean;
  showItemSerialNos: boolean;
  showHSN: boolean;
  showTaxBreakup: boolean;
  showAmountInWords: boolean;
  showBankDetails: boolean;
  showQRCode: boolean;
  showEInvoiceQR: boolean;
  showTermsConditions: boolean;
  termsText: string;
  showSignatureLine: boolean;
  printPageNumber: boolean;
  printTimestamp: boolean;
  footerText: string;
  enableWatermark: boolean;
  watermarkText: string;
  usingPrePrintedLetterhead: boolean;
}

const DEFAULT_CONFIG: PrintConfig = {
  paperSize: 'A4', orientation: 'portrait', copies: 1, printLogo: true,
  logoPosition: 'top-left', logoHeight: 60, companyNameFont: 'Arial Bold', companNameFontSize: 16,
  printAddress: true, printGSTIN: true, showItemSerialNos: true, showHSN: true, showTaxBreakup: true,
  showAmountInWords: true, showBankDetails: true, showQRCode: true, showEInvoiceQR: false,
  showTermsConditions: true, termsText: 'Goods once sold will not be taken back.\nSubject to local jurisdiction.',
  showSignatureLine: true, printPageNumber: true, printTimestamp: true,
  footerText: 'Thank you for your business!', enableWatermark: false, watermarkText: 'ORIGINAL',
  usingPrePrintedLetterhead: false,
};

const VOUCHER_TYPES = [
  { id: 'sales-invoice', label: 'Sales Invoice', formats: ['Tax Invoice (Standard)', 'Bill of Supply', 'Export Invoice', 'Retail Challan', 'Proforma Invoice', 'Duplicate Copy'] },
  { id: 'purchase-bill', label: 'Purchase Bill', formats: ['Purchase Bill', 'GRN Receipt'] },
  { id: 'sales-order', label: 'Sales Order', formats: ['Sales Order', 'Proforma / Quotation'] },
  { id: 'purchase-order', label: 'Purchase Order', formats: ['Purchase Order'] },
  { id: 'delivery-challan', label: 'Delivery Challan', formats: ['Delivery Challan', 'Packing Slip'] },
  { id: 'payment', label: 'Payment Voucher', formats: ['Payment Voucher', 'Cheque Stub'] },
  { id: 'receipt', label: 'Receipt Voucher', formats: ['Receipt Voucher', 'Money Receipt'] },
  { id: 'journal', label: 'Journal Voucher', formats: ['Journal Voucher'] },
  { id: 'credit-note', label: 'Credit Note', formats: ['Credit Note', 'Return Receipt'] },
  { id: 'debit-note', label: 'Debit Note', formats: ['Debit Note'] },
];

const PrintConfiguration = () => {
  const [selectedVoucherType, setSelectedVoucherType] = useState<string>('sales-invoice');
  const [selectedFormat, setSelectedFormat] = useState<string>('Tax Invoice (Standard)');
  const [config, setConfig] = useState<PrintConfig>(() => {
    const saved = localStorage.getItem(`printConfig_sales-invoice_Tax Invoice (Standard)`);
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  const [expandedSection, setExpandedSection] = useState<string>('paper');
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const currentVoucher = VOUCHER_TYPES.find(v => v.id === selectedVoucherType)!;

  const toggle = (key: keyof PrintConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const set = (key: keyof PrintConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const key = `printConfig_${selectedVoucherType}_${selectedFormat}`;
    localStorage.setItem(key, JSON.stringify(config));
    setHasChanges(false);
    toast.success(`Print settings saved for ${selectedFormat}.`);
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setHasChanges(true);
    toast.success('Settings reset to defaults (Not saved yet).');
  };

  const renderSection = (id: string, title: string, content: React.ReactNode) => (
    <div className={`animate-in fade-in duration-200 ${expandedSection === id ? 'block' : 'hidden'}`}>
      <div className="mb-4">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1.5">
          {title}
        </div>
        <div className="flex flex-col gap-1">
          {content}
        </div>
      </div>
    </div>
  );

  const renderToggle = (label: string, key: keyof PrintConfig) => (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 px-2 -mx-2 rounded transition-colors">
      <span className="text-[12px] font-medium text-gray-800">{label}</span>
      <div className="flex rounded shadow-sm shrink-0">
        <button
          onClick={() => { if(!config[key]) toggle(key); }}
          className={`px-3 py-1 text-[11px] font-bold border transition-colors rounded-l ${
            config[key]
              ? 'bg-[#059669] text-white border-[#059669] z-10'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => { if(config[key]) toggle(key); }}
          className={`px-3 py-1 text-[11px] font-bold border-y border-r transition-colors rounded-r -ml-px ${
            !config[key]
              ? 'bg-[#dc2626] text-white border-[#dc2626] z-10'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          No
        </button>
      </div>
    </div>
  );

  const renderPaperLayout = () => (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Paper Size</div>
        <div className="flex gap-2">
          {(['A4', 'A5', 'Letter', 'Legal'] as const).map(size => (
            <button
              key={size}
              onClick={() => set('paperSize', size)}
              className={`px-3 py-1.5 text-[11px] font-bold border rounded shadow-sm transition-colors ${
                config.paperSize === size ? 'bg-[#1557b0] text-white border-[#1557b0]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Orientation</div>
        <div className="flex gap-2">
          {(['portrait', 'landscape'] as const).map(orient => (
            <button
              key={orient}
              onClick={() => set('orientation', orient)}
              className={`px-3 py-1.5 text-[11px] font-bold border rounded shadow-sm transition-colors capitalize ${
                config.orientation === orient ? 'bg-[#1557b0] text-white border-[#1557b0]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {orient}
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Number of Copies</div>
        <input
          type="number"
          value={config.copies}
          onChange={(e) => set('copies', parseInt(e.target.value))}
          className="w-20 h-8 px-2 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
        />
      </div>
      
      <div>
        <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Print via</div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-[11px] font-bold border rounded shadow-sm transition-colors bg-[#1557b0] text-white border-[#1557b0]">
            System Printer
          </button>
          <button className="px-3 py-1.5 text-[11px] font-bold border rounded shadow-sm transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            PDF (save to file)
          </button>
        </div>
      </div>
    </div>
  );

  const renderBranding = () => (
    <div className="space-y-1">
      {renderToggle('Print Company Logo', 'printLogo')}
      
      {config.printLogo && (
        <div className="bg-gray-50 p-3 rounded border border-gray-200 mt-2 mb-3 space-y-4">
          <div>
            <button
              onClick={() => toast('Logo file browser would open here. Upload a PNG/JPG file.')}
              className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-100 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Image size={12} /> Browse Logo...
            </button>
          </div>
          
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Logo Position</div>
            <div className="flex gap-2">
              {(['top-left', 'top-center', 'top-right'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => set('logoPosition', pos)}
                  className={`px-2 py-1 text-[10px] font-bold border rounded transition-colors capitalize ${
                    config.logoPosition === pos ? 'bg-[#1557b0] text-white border-[#1557b0]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pos.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Logo Height (px)</div>
            <input
              type="number"
              value={config.logoHeight}
              onChange={(e) => set('logoHeight', parseInt(e.target.value))}
              className="w-20 h-7 px-2 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
            />
          </div>
        </div>
      )}
      
      <div className="flex gap-4 pt-3 mt-1 border-t border-gray-100">
        <div className="flex-1">
          <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Company Name Font</div>
          <select
            value={config.companyNameFont}
            onChange={(e) => set('companyNameFont', e.target.value)}
            className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
          >
            {['Arial Bold', 'Times New Roman', 'Helvetica', 'Calibri Bold', 'Georgia'].map(font => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Size</div>
          <input
            type="number"
            value={config.companNameFontSize}
            onChange={(e) => set('companNameFontSize', parseInt(e.target.value))}
            className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
          />
        </div>
      </div>
      
      <div className="pt-2">
        {renderToggle('Print Company Address', 'printAddress')}
        {renderToggle('Print GSTIN on Header', 'printGSTIN')}
      </div>
    </div>
  );

  const renderContent = () => (
    <div className="space-y-0.5">
      {renderToggle('Show Item Serial Numbers', 'showItemSerialNos')}
      {renderToggle('Show HSN/SAC Codes', 'showHSN')}
      {renderToggle('Show GST Breakup Table (CGST/SGST/IGST rows)', 'showTaxBreakup')}
      {renderToggle('Show Amount in Words', 'showAmountInWords')}
      {renderToggle('Show Bank Details (for customer payment)', 'showBankDetails')}
      {renderToggle('Show UPI Payment QR Code', 'showQRCode')}
      {renderToggle('Show e-Invoice Signed QR Code (if IRN obtained)', 'showEInvoiceQR')}
      {renderToggle('Show Terms & Conditions', 'showTermsConditions')}
      
      {config.showTermsConditions && (
        <div className="mt-3">
          <textarea
            value={config.termsText}
            onChange={(e) => set('termsText', e.target.value)}
            rows={3}
            className="w-full p-2 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
          />
        </div>
      )}
    </div>
  );

  const renderFooter = () => (
    <div className="space-y-1">
      {renderToggle('Show Authorized Signatory Line at Bottom', 'showSignatureLine')}
      {renderToggle('Show Page Number ("Page 1 of 2")', 'printPageNumber')}
      {renderToggle('Print Timestamp ("Printed on: date time")', 'printTimestamp')}
      
      <div className="pt-3 mt-1 border-t border-gray-100">
        <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Footer Text</div>
        <input
          type="text"
          value={config.footerText}
          onChange={(e) => set('footerText', e.target.value)}
          className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0]"
        />
      </div>
    </div>
  );

  const renderWatermark = () => (
    <div className="space-y-1">
      {renderToggle('Enable Watermark', 'enableWatermark')}
      
      {config.enableWatermark && (
        <div className="bg-gray-50 p-3 rounded border border-gray-200 mt-2 mb-3">
          <div className="mb-3">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Watermark Text</div>
            <input
              type="text"
              value={config.watermarkText}
              onChange={(e) => set('watermarkText', e.target.value)}
              className="w-full h-7 px-2 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] uppercase"
            />
          </div>
          
          <div className="flex gap-2 mb-4">
            {['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'].map(text => (
              <button
                key={text}
                onClick={() => set('watermarkText', text)}
                className={`px-2 py-1 text-[10px] font-bold border rounded transition-colors ${
                  config.watermarkText === text ? 'bg-[#1557b0] text-white border-[#1557b0]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          
          <div className="py-6 px-4 border border-dashed border-gray-300 bg-white rounded flex items-center justify-center overflow-hidden h-24 relative">
            <div className="text-3xl font-black text-gray-200 uppercase -rotate-12 whitespace-nowrap tracking-widest">
              {config.watermarkText}
            </div>
          </div>
        </div>
      )}
      
      <div className="pt-2 border-t border-gray-100">
        {renderToggle('Using Pre-Printed Letterhead', 'usingPrePrintedLetterhead')}
        <div className="text-[10px] text-gray-500 ml-1 italic">(Suppresses company name/address from printing)</div>
      </div>
    </div>
  );

  const renderFormats = () => {
    const formatUseCases: Record<string, string> = {
      'Tax Invoice (Standard)': 'Regular GST invoice for B2B customers',
      'Bill of Supply': 'For exempt goods/composition dealer',
      'Export Invoice': 'For export sales (different GST treatment)',
      'Retail Challan': 'Simple one-page for B2C small sales',
      'Proforma Invoice': 'For quotes before actual sale',
      'Duplicate Copy': 'DUPLICATE watermark for second printout',
      'Purchase Bill': 'Regular purchase bill for expense tracking',
      'GRN Receipt': 'Goods Received Note for inventory tracking',
      'Sales Order': 'Customer order confirmation before invoice',
      'Proforma / Quotation': 'Price quotation before order confirmation',
      'Purchase Order': 'Supplier order placement document',
      'Delivery Challan': 'Goods dispatch slip without value',
      'Packing Slip': 'Detailed packing information for shipment',
      'Payment Voucher': 'Record of payment made to suppliers',
      'Cheque Stub': 'Cheque details print for record keeping',
      'Receipt Voucher': 'Record of payment received from customers',
      'Money Receipt': 'Simple receipt for cash payments',
      'Journal Voucher': 'Adjustment and non-cash transaction entry',
      'Credit Note': 'Issued when returning goods or reducing value',
      'Return Receipt': 'Acknowledgment of returned goods',
      'Debit Note': 'Issued when receiving returned goods or increasing value'
    };

    return (
      <div>
        <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-3">
          Formats for {currentVoucher.label}
        </div>
        
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Format Name</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Use Case</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentVoucher.formats.map(format => (
                <tr key={format} className={`hover:bg-gray-50 ${selectedFormat === format ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-3 py-2 text-[11px] font-medium text-gray-800">{format}</td>
                  <td className="px-3 py-2 text-[10px] text-gray-500">{formatUseCases[format]}</td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <button className="h-5 px-2 bg-white border border-gray-300 text-gray-700 text-[9px] font-bold uppercase rounded hover:bg-gray-50 transition-colors shadow-sm">
                      Edit
                    </button>
                    {selectedFormat !== format && (
                      <button 
                        onClick={() => {
                          setSelectedFormat(format);
                          toast.success(`Switched to formatting ${format}`);
                        }}
                        className="h-5 px-2 bg-white border border-gray-300 text-[#1557b0] text-[9px] font-bold uppercase rounded hover:bg-blue-50 transition-colors shadow-sm"
                      >
                        Select
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1000px] mx-auto p-5 font-sans">
      {/* Page Header */}
      <div className="bg-[#1e2433] px-4 py-3 rounded-t-lg flex items-center gap-2 border-b border-gray-700 shadow-sm">
        <Printer size={20} className="text-white" />
        <span className="text-[14px] font-semibold text-white tracking-wide">
          Print Configuration & Voucher Templates
        </span>
      </div>
      
      {/* Voucher Type Selector */}
      <div className="bg-gray-50 border-x border-b border-gray-200 p-3 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide whitespace-nowrap">Configure for:</div>
          <div className="flex flex-wrap gap-2">
            {VOUCHER_TYPES.map(voucher => (
              <button
                key={voucher.id}
                onClick={() => {
                  setSelectedVoucherType(voucher.id);
                  setSelectedFormat(voucher.formats[0]);
                  const key = `printConfig_${voucher.id}_${voucher.formats[0]}`;
                  const saved = localStorage.getItem(key);
                  setConfig(saved ? JSON.parse(saved) : DEFAULT_CONFIG);
                }}
                className={`px-3 py-1.5 text-[11px] font-medium rounded border transition-colors shadow-sm ${
                  selectedVoucherType === voucher.id 
                    ? 'bg-[#1557b0] text-white border-[#1557b0]' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {voucher.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Format Selector */}
        {currentVoucher.formats.length > 1 && (
          <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
            <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide whitespace-nowrap">Print Format:</div>
            <select
              value={selectedFormat}
              onChange={(e) => {
                setSelectedFormat(e.target.value);
                const key = `printConfig_${selectedVoucherType}_${e.target.value}`;
                const saved = localStorage.getItem(key);
                setConfig(saved ? JSON.parse(saved) : DEFAULT_CONFIG);
              }}
              className="h-8 px-3 text-[12px] font-medium text-gray-800 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] shadow-sm w-[250px]"
            >
              {currentVoucher.formats.map(format => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      {/* Three Column Layout */}
      <div className="grid grid-cols-[220px_1fr_320px] bg-[#f5f6fa] border border-gray-200 border-t-0 rounded-b-lg shadow-sm min-h-[500px]">
        {/* Column 1 - Section Nav */}
        <div className="bg-white border-r border-gray-200 p-2 shrink-0">
          {[
            { id: 'paper', icon: <FileText size={14}/>, label: 'Paper & Layout' },
            { id: 'branding', icon: <Image size={14}/>, label: 'Company Branding' },
            { id: 'content', icon: <Settings size={14}/>, label: 'Content Settings' },
            { id: 'footer', icon: <Printer size={14}/>, label: 'Footer & Signature' },
            { id: 'watermark', icon: <Eye size={14}/>, label: 'Watermark' },
            { id: 'formats', icon: <FileText size={14}/>, label: 'Print Formats List' }
          ].map(section => (
            <button
              key={section.id}
              onClick={() => setExpandedSection(section.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-[12px] font-semibold transition-colors rounded mb-1 ${
                expandedSection === section.id 
                  ? 'bg-blue-50 text-[#1557b0]' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>
        
        {/* Column 2 - Settings */}
        <div className="p-5 h-[550px] overflow-y-auto">
          {renderSection('paper', 'Paper & Layout', renderPaperLayout())}
          {renderSection('branding', 'Company Branding', renderBranding())}
          {renderSection('content', 'Content Settings', renderContent())}
          {renderSection('footer', 'Footer & Signature', renderFooter())}
          {renderSection('watermark', 'Watermark', renderWatermark())}
          {renderSection('formats', 'Print Formats List', renderFormats())}
        </div>
        
        {/* Column 3 - Preview Panel */}
        <div className="bg-gray-100/50 p-4 border-l border-gray-200 flex flex-col h-[550px]">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">
            Live Preview
          </div>
          
          <div className="flex-1 bg-white border border-gray-300 shadow-md rounded-sm p-4 relative overflow-hidden flex flex-col mx-auto w-full max-w-[280px]">
            {/* Header Section */}
            <div className="mb-2 relative z-10">
              {config.printLogo && !config.usingPrePrintedLetterhead && (
                <div className={`
                  mb-1 border border-gray-200 bg-gray-50 flex items-center justify-center text-[7px] text-gray-400 font-bold
                  ${config.logoPosition === 'top-center' ? 'mx-auto w-10 h-6' : 
                    config.logoPosition === 'top-right' ? 'ml-auto w-12 h-6' : 
                    'w-12 h-6'}
                `}>
                  LOGO
                </div>
              )}
              
              {!config.usingPrePrintedLetterhead && (
                <>
                  <div style={{
                    fontWeight: 700,
                    fontSize: `${config.companNameFontSize / 2.2}px`,
                    fontFamily: config.companyNameFont,
                    textAlign: config.logoPosition === 'top-center' ? 'center' : 'left',
                    color: '#111827'
                  }}>
                    SUTRA ENTERPRISES
                  </div>
                  
                  {config.printAddress && (
                    <div className={`text-[7px] text-gray-600 mt-0.5 ${config.logoPosition === 'top-center' ? 'text-center' : 'text-left'}`}>
                      123 Business Street, Industrial Area<br/>Mumbai, Maharashtra — 400001
                    </div>
                  )}
                  
                  {config.printGSTIN && (
                    <div className={`text-[7px] text-gray-600 font-medium mt-0.5 ${config.logoPosition === 'top-center' ? 'text-center' : 'text-left'}`}>
                      GSTIN: 27AABCC1234D1Z5
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="border-t-2 border-gray-800 my-2 relative z-10"></div>
            
            {/* Format Title */}
            <div className="text-center text-[9px] font-bold text-gray-800 mb-2 uppercase tracking-wide relative z-10">
              {selectedFormat.replace(/\(.*?\)/g, '').trim()}
            </div>
            
            {/* Invoice Meta */}
            <div className="flex justify-between text-[7px] text-gray-700 mb-2 relative z-10">
              <div>
                <span className="font-semibold">Invoice No:</span> INV/24-25/001<br/>
                <span className="font-semibold">Date:</span> 24-Oct-2024
              </div>
              <div className="text-right">
                <span className="font-semibold">Billed To:</span> Acme Corp<br/>
                GSTIN: 27XYZAB9876C1Z2
              </div>
            </div>
            
            {/* Item Table */}
            <table className="w-full text-left border-collapse text-[6px] mb-2 relative z-10">
              <thead>
                <tr className="bg-gray-100 border-y border-gray-300">
                  <th className="py-1 px-1 font-semibold text-gray-700">#</th>
                  <th className="py-1 px-1 font-semibold text-gray-700">Item Name</th>
                  {config.showHSN && <th className="py-1 px-1 font-semibold text-gray-700">HSN</th>}
                  <th className="py-1 px-1 font-semibold text-gray-700 text-right">Qty</th>
                  <th className="py-1 px-1 font-semibold text-gray-700 text-right">Rate</th>
                  {config.showTaxBreakup && <th className="py-1 px-1 font-semibold text-gray-700 text-right">CGST</th>}
                  {config.showTaxBreakup && <th className="py-1 px-1 font-semibold text-gray-700 text-right">SGST</th>}
                  <th className="py-1 px-1 font-semibold text-gray-700 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-1 px-1 text-gray-600">1</td>
                  <td className="py-1 px-1 text-gray-800 font-medium">Premium Widget {config.showItemSerialNos && <span className="text-[5px] text-gray-400 block">SN: WID-9912</span>}</td>
                  {config.showHSN && <td className="py-1 px-1 text-gray-600">8542</td>}
                  <td className="py-1 px-1 text-gray-600 text-right">2 NOS</td>
                  <td className="py-1 px-1 text-gray-600 text-right">500.00</td>
                  {config.showTaxBreakup && <td className="py-1 px-1 text-gray-600 text-right">9%</td>}
                  {config.showTaxBreakup && <td className="py-1 px-1 text-gray-600 text-right">9%</td>}
                  <td className="py-1 px-1 text-gray-800 font-medium text-right">1000.00</td>
                </tr>
                <tr>
                  <td className="py-1 px-1 text-gray-600">2</td>
                  <td className="py-1 px-1 text-gray-800 font-medium">Basic Gadget {config.showItemSerialNos && <span className="text-[5px] text-gray-400 block">SN: GAD-1011</span>}</td>
                  {config.showHSN && <td className="py-1 px-1 text-gray-600">8471</td>}
                  <td className="py-1 px-1 text-gray-600 text-right">1 NOS</td>
                  <td className="py-1 px-1 text-gray-600 text-right">750.00</td>
                  {config.showTaxBreakup && <td className="py-1 px-1 text-gray-600 text-right">9%</td>}
                  {config.showTaxBreakup && <td className="py-1 px-1 text-gray-600 text-right">9%</td>}
                  <td className="py-1 px-1 text-gray-800 font-medium text-right">750.00</td>
                </tr>
                <tr className="border-t border-gray-300">
                  <td colSpan={config.showHSN && config.showTaxBreakup ? 7 : config.showHSN || config.showTaxBreakup ? 6 : 5} className="py-1 px-1 font-bold text-gray-800 text-right">
                    Total ₹
                  </td>
                  <td className="py-1 px-1 font-bold text-gray-900 text-right">1750.00</td>
                </tr>
              </tbody>
            </table>
            
            {/* Amount in Words */}
            {config.showAmountInWords && (
              <div className="text-[6.5px] text-gray-700 italic mb-2 relative z-10">
                Amount Chargeable (in words):<br/>
                <span className="font-semibold not-italic">INR One Thousand Seven Hundred Fifty Only</span>
              </div>
            )}
            
            <div className="flex gap-2 mb-2 relative z-10">
              {/* Bank Details */}
              {config.showBankDetails && (
                <div className="flex-1 border border-gray-200 p-1 text-[6px] text-gray-700">
                  <div className="font-bold underline mb-0.5">Bank Details</div>
                  Bank: HDFC Bank<br/>
                  A/C No: 50200012345678<br/>
                  IFSC Code: HDFC0000001
                </div>
              )}
              
              {/* QR Code */}
              {(config.showQRCode || config.showEInvoiceQR) && (
                <div className="shrink-0 border border-gray-200 p-1 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 grid grid-cols-5 gap-px bg-white">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} className={i % 2 === 0 || i % 7 === 0 ? 'bg-black' : 'bg-transparent'} />
                    ))}
                  </div>
                  <div className="text-[4px] mt-0.5 text-center leading-tight font-medium">
                    {config.showEInvoiceQR ? 'IRN QR Code' : 'UPI Payment'}
                  </div>
                </div>
              )}
            </div>
            
            {config.showTermsConditions && (
              <div className="text-[5.5px] text-gray-600 mt-1 relative z-10">
                <div className="font-bold underline mb-0.5">Terms & Conditions:</div>
                <div className="whitespace-pre-line leading-tight">{config.termsText}</div>
              </div>
            )}
            
            {/* Signature Line */}
            {config.showSignatureLine && (
              <div className="mt-auto pt-4 text-right relative z-10">
                <div className="text-[6px] text-gray-800 font-bold">For SUTRA ENTERPRISES</div>
                <div className="text-[5px] text-gray-500 mt-6 border-t border-dashed border-gray-400 inline-block pt-0.5">Authorised Signatory</div>
              </div>
            )}
            
            {/* Watermark */}
            {config.enableWatermark && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <div className="text-[32px] font-black text-gray-200/60 uppercase -rotate-45 tracking-widest">
                  {config.watermarkText}
                </div>
              </div>
            )}
            
            {/* Page Number & Footer */}
            <div className="absolute bottom-1 left-0 right-0 px-2 flex justify-between text-[5px] text-gray-400">
              <div>{config.printTimestamp && 'Printed: 24-Oct-2024 14:30:15'}</div>
              <div className="text-center flex-1">{config.footerText}</div>
              <div>{config.printPageNumber && 'Page 1 of 1'}</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Save Bar */}
      <div className="bg-white border-x border-b border-gray-200 px-5 py-3 rounded-b-lg flex justify-between items-center shadow-sm">
        <div className="text-[11px] font-medium text-gray-600 flex items-center gap-2">
          <Settings size={14} />
          Configuring template: <span className="font-bold text-gray-800">{selectedFormat}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <RefreshCw size={14} className="text-gray-500" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className="h-8 px-5 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Save size={14} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintConfiguration;
