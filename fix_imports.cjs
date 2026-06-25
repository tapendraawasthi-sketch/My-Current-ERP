const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/JournalEntries.tsx',
  'src/pages/PaymentVoucher.tsx',
  'src/pages/ReceiptVoucher.tsx',
  'src/pages/VouchersLog.tsx',
  'src/pages/SalesRegister.tsx',
  'src/pages/PurchaseRegister.tsx',
  'src/pages/DeliveryChallan.tsx',
  'src/pages/GoodsReceiptNote.tsx',
  'src/pages/StockJournalPage.tsx',
  'src/pages/DebitCreditNote.tsx',
  'src/pages/PartyLedgerStatement.tsx',
  'src/pages/PurchaseOrder.tsx',
  'src/pages/SalesOrder.tsx'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // We want to replace:
    // import React from "react";
    // [maybe other imports]
    // //import React, { ... } from "react";
    // WITH
    // import React, { ... } from "react";
    // [maybe other imports]

    // Find the commented hook line
    const match = content.match(/\/\/import React, {([^}]+)} from "react";/);
    if (match) {
      const hooks = match[1].trim();
      // Remove the plain import
      content = content.replace('import React from "react";\n', '');
      content = content.replace('import React from "react";\r\n', '');
      
      // Replace the commented import with the correct one
      content = content.replace(match[0], `import React, { ${hooks} } from "react";`);
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed import in ${file} with hooks: ${hooks}`);
    } else {
      console.log(`No commented React import found in ${file}`);
    }
  } else {
    console.log(`File not found: ${file}`);
  }
});
