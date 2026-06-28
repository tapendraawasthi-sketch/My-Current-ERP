const fs = require('fs');

// SmartBankReconciliation.tsx
let smart = fs.readFileSync('src/pages/SmartBankReconciliation.tsx', 'utf-8');
smart = smart.replace(/entries: BankStatementEntry\[\];/g, 'entries: BankStatementEntry[];\n  companyId?: string;');
smart = smart.replace(/period: e\.target\.value/g, 'period: e as unknown as string');
smart = smart.replace(/parseFloat\(e\.target\.value\)/g, 'parseFloat(e as unknown as string)');
smart = smart.replace(/"destructive"/g, '"danger"');
smart = smart.replace(/currentUser\.companyId/g, "companySettings?.id || 'main'");
fs.writeFileSync('src/pages/SmartBankReconciliation.tsx', smart);

// VatReports.tsx
let vat = fs.readFileSync('src/pages/VatReports.tsx', 'utf-8');
vat = vat.replace(/rowClassName=/g, 'getRowClassName=');
fs.writeFileSync('src/pages/VatReports.tsx', vat);
