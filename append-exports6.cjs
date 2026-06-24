const fs = require('fs');

fs.appendFileSync('src/lib/exportUtils.ts', '\nexport const exportTdsReturnToExcel = () => {};\n');
fs.appendFileSync('src/lib/taxUtils.ts', '\nexport const computeWithholdingTDS = () => ({});\n');
