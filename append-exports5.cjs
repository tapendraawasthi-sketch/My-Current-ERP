throw new Error("LEGACY SCRIPT DO NOT RUN");
const fs = require('fs');

fs.appendFileSync('src/lib/printUtils.ts', '\nexport const generatePartyStatementPDF = () => {};\n');
fs.appendFileSync('src/lib/types.ts', '\nexport type ReportPeriodPreset = any;\nexport type FiscalYearStatus = any;\n');
fs.appendFileSync('src/lib/accounting.ts', '\nexport const computeRatios = () => ({});\n');
fs.appendFileSync('src/lib/stockUtils.ts', '\nexport const getStockValuationSummary = () => ({});\n');
