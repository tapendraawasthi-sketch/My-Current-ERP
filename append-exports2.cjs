const fs = require('fs');

fs.appendFileSync('src/lib/accounting.ts', '\nexport const computeProfitLoss = () => ({});\nexport const computeBalanceSheet = () => ({});\nexport const computeCashFlow = () => ({});\nexport const computeOutstandingReceivables = () => [];\nexport const computeOutstandingPayables = () => [];\nexport const getAccountBalance = () => 0;\n');
fs.appendFileSync('src/lib/taxUtils.ts', '\nexport const computeVatAnnexA = () => [];\nexport const computeVatAnnexB = () => [];\nexport const computeVatAnnexC = () => [];\nexport const computeVAT3Return = () => ({});\n');
fs.appendFileSync('src/lib/exportUtils.ts', '\nexport const exportProfitLossToExcel = () => {};\nexport const exportBalanceSheetToExcel = () => {};\nexport const exportCashFlowToExcel = () => {};\n');
