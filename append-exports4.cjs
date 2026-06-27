throw new Error("LEGACY SCRIPT DO NOT RUN");
const fs = require('fs');

fs.appendFileSync('src/lib/accounting.ts', '\nexport const getAccountBalance = () => 0;\nexport const computeOutstandingReceivables = () => [];\nexport const computeAgingReport = () => [];\nexport const computePartyStatement = () => ({});\nexport const computeOutstandingAnalysis = () => ({});\n');
fs.appendFileSync('src/lib/constants.ts', '\nexport const NEPALI_MONTHS_EN = [];\n');
