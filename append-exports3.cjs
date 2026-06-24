const fs = require('fs');

fs.appendFileSync('src/lib/accounting.ts', '\nexport const getAccountBalance = () => 0;\nexport const computeOutstandingReceivables = () => [];\n');
fs.appendFileSync('src/lib/exportUtils.ts', '\nexport const exportVatAnnexToExcel = () => {};\nexport const workbookFromArray = () => ({});\nexport const downloadWorkbook = () => {};\n');
fs.appendFileSync('src/lib/nepaliDate.ts', '\nexport const getBSMonthRange = () => [];\nexport const getQuarterRange = () => [];\nexport const formatADToBS = () => "";\nexport const formatBSToAD = () => "";\nexport const formatBSDate = () => "";\n');
