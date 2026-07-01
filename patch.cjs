const fs = require('fs');

let code = fs.readFileSync('src/lib/nepaliDate.ts', 'utf8');

const fmt = `function toLocalADString(d: Date): string {
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}\`;
}

function parseLocalADString(s: string): Date {
  const [y, m, d] = s.split(/[-/]/).map(Number);
  return new Date(y, m - 1, d);
}
`;

// Insert the helpers at the top after imports
code = code.replace(/import NepaliDate from "nepali-date-converter";/, "import NepaliDate from \"nepali-date-converter\";\n\n" + fmt);

// Fix getFiscalYearDateRange
code = code.replace(/const fmt = \(d: Date\) => d\.toISOString\(\)\.slice\(0, 10\);/g, 'const fmt = (d: Date) => toLocalADString(d);');

// Fix BSToADString
code = code.replace(/return ad\.toISOString\(\)\.split\("T"\)\[0\];/g, 'return toLocalADString(ad);');

// Fix getBSToday
code = code.replace(/return ADToBSString\(new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\]\);/g, 'return ADToBSString(toLocalADString(new Date()));');

// Fix getBSMonthCalendarGrid
code = code.replace(/adDate\.toISOString\(\)\.split\("T"\)\[0\]/g, 'toLocalADString(adDate)');

// Fix formatBSDate string parsing
code = code.replace(
  /typeof adDateParam === "string"\s*\n\s*\?\s*new Date\(adDateParam\.includes\("T"\) \? adDateParam : adDateParam \+ "T00:00:00"\)/g,
  'typeof adDateParam === "string"\n      ? (adDateParam.includes("T") ? new Date(adDateParam) : parseLocalADString(adDateParam))'
);

fs.writeFileSync('src/lib/nepaliDate.ts', code);
console.log('Fixed nepaliDate.ts');
