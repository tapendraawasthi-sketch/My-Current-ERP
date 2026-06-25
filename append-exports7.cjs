const fs = require('fs');


fs.appendFileSync('src/lib/types.ts', '\nexport const CostCenterLevel = {} as any;\n');
fs.appendFileSync('src/lib/payrollUtils.ts', '\nexport const computeNepalPayroll = () => [];\n');
