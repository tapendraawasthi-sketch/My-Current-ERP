throw new Error("LEGACY SCRIPT DO NOT RUN");
const fs = require('fs');

fs.appendFileSync('src/lib/stockUtils.ts', '\nexport const getLowStockItems = () => [];\nexport const getCurrentStock = () => [];\n');
fs.appendFileSync('src/lib/accounting.ts', '\nexport const generateVoucherNo = () => "";\nexport const getAccountBalance = () => 0;\nexport const computeTrialBalance = () => ({});\nexport const calculateNextDueDate = () => "";\n');
fs.appendFileSync('src/lib/exportUtils.ts', '\nexport const exportLedgerToExcel = () => {};\nexport const exportTrialBalanceToExcel = () => {};\n');
fs.appendFileSync('src/lib/utils.ts', '\nexport const dateToAD = () => "";\nexport const parseFlexibleDate = () => new Date();\n');
fs.appendFileSync('src/lib/types.ts', '\nexport type RecurringVoucher = any;\nexport type RecurringFrequency = any;\nexport type User = any;\nexport type UserRole = any;\n');
fs.appendFileSync('src/store/useStore.ts', '\nexport const useAccountingStore = () => ({});\n');
