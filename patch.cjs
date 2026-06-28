const fs = require('fs');
const file = 'src/components/ChartOfAccounts.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. interface TreeNode
content = content.replace(
  /balance: number;\n  rowObject\?: Account;/g,
  'balance: number;\n  billByBill?: boolean;\n  rowObject?: Account;'
);

// 2. State
content = content.replace(
  /const \[openingBalanceDate, setOpeningBalanceDate\] = useState<string>\([^;]+;\n/m,
  "$&  const [billByBill, setBillByBill] = useState<boolean>(false);\n"
);

// 3. handleOpenCreateModal
content = content.replace(
  /setOpeningType\("Dr"\);\n    setOpeningBalanceDate\([^)]+\);\n/m,
  "$&    setBillByBill(false);\n"
);

// 4. handleOpenEditModal
content = content.replace(
  /setOpeningType\(acc\.openingBalanceDr && acc\.openingBalanceDr > 0 \? "Dr" : "Cr"\);\n    setOpeningBalanceDate\([^)]+\);\n/m,
  "$&    setBillByBill(!!(acc as any).billByBill);\n"
);

// 5. handleAddSubmit
content = content.replace(
  /openingBalanceDate: openingBalanceDate \|\| new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\],\n/g,
  "$&        billByBill: ![\"group\", \"subgroup\"].includes(level) && (type === AccountType.ASSET || type === AccountType.LIABILITY) ? billByBill : false,\n"
);

// 6. getSubNodes
content = content.replace(
  /balance: a\.balance \|\| 0,\n            rowObject: a,/g,
  "balance: a.balance || 0,\n            billByBill: !!(a as any).billByBill,\n            rowObject: a,"
);

// 7. root nodes
content = content.replace(
  /balance: rootBalance,\n        children,/g,
  "balance: rootBalance,\n        billByBill: false,\n        children,"
);

// 8. Excel headers
content = content.replace(
  /const headers = \["Code", "Account Name", "Nepali Name", "Type", "Level", "Balance", "Status", "System Account"\];/g,
  "const headers = [\"Code\", \"Account Name\", \"Nepali Name\", \"Type\", \"Level\", \"Balance\", \"Status\", \"System Account\", \"Bill By Bill\"];"
);

// 9. Excel rows
content = content.replace(
  /node\.isSystemAccount \? "Yes" : "No",\n      \]\);/g,
  "node.isSystemAccount ? \"Yes\" : \"No\",\n        node.billByBill ? \"Yes\" : \"No\",\n      ]);"
);

// 10. Import CSV Data
content = content.replace(
  /openingBalanceDate: currentFiscalYear\?\.startDate \|\| new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\],\n          \}\);/g,
  "$&          billByBill: false,\n          });"
);

// 11. renderLedgerForm (first we remove the old toggle if it exists, but the file doesn't have it)
const toggleUI = `
      {/* ── TASK 1.6: Bill-by-Bill toggle for ASSET / LIABILITY ledgers ── */}
      {!["group", "subgroup"].includes(level) && (type === AccountType.ASSET || type === AccountType.LIABILITY) && (
        <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="billByBill"
              checked={billByBill}
              onChange={(e) => setBillByBill(e.target.checked)}
              className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
            />
            <div>
              <span className="text-[12px] font-semibold text-gray-800">
                Maintain Bill-by-Bill Details
              </span>
              <p className="text-[10px] text-gray-800 mt-0.5">
                Track individual invoice references for this ledger (recommended for
                Sundry Debtors and Sundry Creditors accounts)
              </p>
            </div>
          </label>
        </div>
      )}
    </form>`;

content = content.replace(/<\/form>\s*\);\s*\/\/\s*─── RENDER/, toggleUI + '\n  );\n\n  // ─── RENDER');

fs.writeFileSync(file, content);
console.log('Applied billByBill patches to ChartOfAccounts.tsx');
