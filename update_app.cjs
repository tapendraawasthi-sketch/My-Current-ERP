const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const importsToAdd = `
const ReceiptVoucher = lazy(() => import('./pages/ReceiptVoucher'));
const PaymentVoucher = lazy(() => import('./pages/PaymentVoucher'));
const ContraVoucher = lazy(() => import('./pages/ContraVoucher'));
const JournalEntries = lazy(() => import('./pages/JournalEntries'));
const SalesVoucher = lazy(() => import('./pages/SalesVoucher'));
const PurchaseVoucher = lazy(() => import('./pages/PurchaseVoucher'));
const DebitNoteVoucher = lazy(() => import('./pages/DebitNoteVoucher'));
const CreditNoteVoucher = lazy(() => import('./pages/CreditNoteVoucher'));
const SalesOrderVoucher = lazy(() => import('./pages/SalesOrderVoucher'));
const PurchaseOrder = lazy(() => import('./pages/PurchaseOrder'));
const StockJournalPage = lazy(() => import('./pages/StockJournalPage'));
const PhysicalStockPage = lazy(() => import('./pages/PhysicalStockPage'));
const MaterialIssuedPage = lazy(() => import('./pages/MaterialIssuedPage'));
const MaterialReceivedPage = lazy(() => import('./pages/MaterialReceivedPage'));
const ProductionPage = lazy(() => import('./pages/ProductionPage'));
const UnassemblePage = lazy(() => import('./pages/UnassemblePage'));
const DeliveryChallan = lazy(() => import('./pages/DeliveryChallan'));
const GoodsReceiptNote = lazy(() => import('./pages/GoodsReceiptNote'));
const ReceiptsAndPayments = lazy(() => import('./pages/ReceiptsAndPayments'));
const PaymentAdvice = lazy(() => import('./pages/PaymentAdvice'));
`;

const casesToAdd = `
      case 'receipt': return <ReceiptVoucher />;
      case 'payment': return <PaymentVoucher />;
      case 'contra': return <ContraVoucher />;
      case 'journal': return <JournalEntries />;
      case 'sales': return <SalesVoucher />;
      case 'purchase': return <PurchaseVoucher />;
      case 'debit-note': return <DebitNoteVoucher />;
      case 'credit-note': return <CreditNoteVoucher />;
      case 'sales-order': return <SalesOrderVoucher />;
      case 'purchase-order': return <PurchaseOrder />;
      case 'stock-journal': return <StockJournalPage />;
      case 'physical-stock': return <PhysicalStockPage />;
      case 'material-issued': return <MaterialIssuedPage />;
      case 'material-received': return <MaterialReceivedPage />;
      case 'production': return <ProductionPage />;
      case 'unassemble': return <UnassemblePage />;
      case 'delivery-challan': return <DeliveryChallan />;
      case 'receipt-note': return <GoodsReceiptNote />;
      case 'receipts-and-payments': return <ReceiptsAndPayments />;
      case 'payment-advice': return <PaymentAdvice />;
`;

if (!code.includes('ReceiptVoucher')) {
  code = code.replace("const CbmsDashboard = lazy(() => import('./pages/CbmsDashboard'));", "const CbmsDashboard = lazy(() => import('./pages/CbmsDashboard'));\\n" + importsToAdd);
  code = code.replace("case 'cbms-dashboard': return <CbmsDashboard />;", "case 'cbms-dashboard': return <CbmsDashboard />;\\n" + casesToAdd);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App.tsx updated successfully.');
} else {
  console.log('App.tsx already contains ReceiptVoucher');
}
