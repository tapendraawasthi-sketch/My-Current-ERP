// [fix.cjs applied]
const fs = require('fs');
const path = require('path');

const TARGET = 'src/store/index.ts';
const BACKUP = 'src/store/index.ts.bak';
const GUARD_COMMENT = '// [fix.cjs applied]';

let content = fs.readFileSync(TARGET, 'utf-8');

if (content.includes(GUARD_COMMENT)) {
  console.log('fix.cjs: Already applied, skipping.');
  process.exit(0);
}

fs.copyFileSync(TARGET, BACKUP);
console.log(`fix.cjs: Backup created at ${BACKUP}`);

content = content.replace(/currencies: \[\] as DBCurrency\[\],\n/g, '');
content = content.replace(
  /\bdb\.(employees|salaryStructures|payrollRuns|payrollEntries|costCentres|costCentreAllocations|approvalPolicies|recurringTemplates|approvalRequests|pdcRegister)/g,
  'getDB().$1'
);

content = `${GUARD_COMMENT}\n${content}`;
fs.writeFileSync(TARGET, content);
console.log('fix.cjs: Applied successfully.');
