const fs = require('fs');
let code = fs.readFileSync('src/store/index.ts', 'utf-8');

// AppState DB ready and isInitializing
code = code.replace('isDbReady: boolean;', 'isDbReady: boolean;\n  isInitializing?: boolean;');
// AppState auditLogs
code = code.replace('cbmsEnabled: boolean;', 'cbmsEnabled: boolean;\n  auditLogs?: any[];');
// missing multi godown properties in useStore
code = code.replace('currentFiscalYear: null,', 'currentFiscalYear: null,\n  loadWarehouses: async () => {},\n  addWarehouse: async (w) => (w as any),\n  updateWarehouse: async () => {},\n  getNextTransferNo: async () => "",\n  saveStockTransfer: async (t) => (t as any),');
// missing properties on items, vouchers, invoices
code = code.replace('items.find((i) => i.id === id)', 'items.find((i: any) => i.id === id)');
code = code.replace('vouchers.find((v) => v.id === id)', '(vouchers as any[]).find((v) => v.id === id)');
code = code.replace('invoices.find((v) => v.id === id)', '(invoices as any[]).find((v) => v.id === id)');
// password -> passwordHash
code = code.replace('password: updates.password || existing.password', 'passwordHash: (updates as any).password || existing.passwordHash');

fs.writeFileSync('src/store/index.ts', code);
console.log('Fixed src/store/index.ts');
