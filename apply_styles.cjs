const fs = require('fs');
const path = require('path');

function modifyFile(filepath, replacements) {
    if (!fs.existsSync(filepath)) {
        console.log(`File not found: ${filepath}`);
        return;
    }
    let content = fs.readFileSync(filepath, 'utf-8');
    let newContent = content;

    for (const [target, replacement] of replacements) {
        if (typeof target === 'function') {
            newContent = target(newContent);
        } else if (target instanceof RegExp) {
            newContent = newContent.replace(target, replacement);
        } else {
            newContent = newContent.split(target).join(replacement);
        }
    }

    if (content !== newContent) {
        fs.writeFileSync(filepath, newContent, 'utf-8');
        console.log(`Modified ${filepath}`);
    } else {
        console.log(`No changes in ${filepath}`);
    }
}

const root = "src/pages";

// 1. BalanceSheet.tsx
modifyFile(path.join(root, "BalanceSheet.tsx"), [
    [/const sectionColors = \{[\s\S]*?\};\n/, ''],
    [/style=\{\{\s*borderLeft:\s*`3px solid \$\{sectionColors\.[a-zA-Z]+\}`\s*\}\}/g, 'className="report-section-heading"'],
    [/style=\{\{\s*borderLeft:\s*`3px solid \$\{sectionColors\.[a-zA-Z]+\}`,\s*\}\}/g, 'className="report-section-heading"'],
    ['<table className="report-table w-full">', '<table className="tformat-table">'],
    ['<div className="flex items-center justify-between px-3 py-2.5 bg-[#1557b0] text-white">\n          <span className="text-[12px] font-bold">TOTAL</span>', 
     '<div className="fin-row-total">\n          <span className="text-[12px] font-bold">TOTAL</span>'],
    ['<div className="flex items-center justify-between px-3 py-2.5 bg-[#1557b0] text-white">\n        <span className="text-[12px] font-bold">TOTAL ASSETS</span>',
     '<div className="fin-row-total">\n        <span className="text-[12px] font-bold">TOTAL ASSETS</span>'],
    [/<button\s+className="[^"]*text-\[#1557b0\] hover:underline[^"]*"\s+onClick=\{([^}]+)\}>/g, '<button className="drill-link" onClick={$1}>'],
    [/<button\s+onClick=\{([^}]+)\}\s+className="text-\[#1557b0\] hover:underline text-left flex items-center gap-1"\s*>/g, '<button className="report-back-link" onClick={$1}>'],
    [/className="text-\[#1557b0\] hover:underline flex items-center gap-1"/g, 'className="report-back-link"']
]);

// 2. ProfitLoss.tsx
modifyFile(path.join(root, "ProfitLoss.tsx"), [
    [/style=\{\{\s*color:\s*"#059669"\s*\}\}/g, 'className="report-section-heading"'],
    [/style=\{\{\s*color:\s*"#dc2626"\s*\}\}/g, 'className="report-section-heading"'],
    [/<tr className="fin-row-total".*?>.*?Net \{netProfit >= 0 \? "Profit" : "Loss"\}.*?<\/tr>/gs,
     `<tr className="fin-row-total">\n  <td>Net {netProfit >= 0 ? "Profit" : "Loss"}</td>\n  <td style={{ textAlign: "right", fontFamily: "Courier New" }}>\n    {netProfit >= 0 ? fmtMoney(netProfit) : \`(\${fmtMoney(Math.abs(netProfit))})\`}\n  </td>\n</tr>`]
]);

// 3. TrialBalance.tsx
modifyFile(path.join(root, "TrialBalance.tsx"), [
    [/<tr className="bg-\[#f0f9ff\].*?">/g, '<tr className="fin-row-group">'],
    [/<tr className="hover:bg-gray-50 border-b border-gray-100.*?"/g, '<tr className="fin-row-ledger"'],
    [/<td style=\{\{\s*textAlign:\s*"right"\s*\}\}>\s*\{Math\.abs\(totalDr - totalCr\) < 0\.01.*?<\/td>/gs,
     `<td style={{ textAlign: "right" }}>\n    {Math.abs(totalDr - totalCr) < 0.01\n      ? <span className="tb-balanced-badge">✓ Balanced</span>\n      : <span className="tb-unbalanced-badge">✗ Mismatch</span>\n    }\n  </td>`]
]);

// 4. DayBook.tsx
modifyFile(path.join(root, "DayBook.tsx"), [
    [/<tr className="bg-gray-50.*?>\s*<td colSpan=\{4\}>\s*<span style=\{\{ fontWeight: 700, fontSize: 12 \}\}>.*?<\/tr>/gs,
     content => content.replace(/className="bg-gray-50/g, 'className="daybook-group-header')],
    [/<tr className="bg-\[#f8fafc\] border-t border-gray-200">/g, '<tr className="fin-row-subtotal">'],
    [/<tr className="bg-\[#eef2ff\] border-y-2 border-\[#c7d2fe\]">/g, '<tr className="fin-row-total">']
]);

// 5. GeneralLedger.tsx
modifyFile(path.join(root, "GeneralLedger.tsx"), [
    ['<tr className="bg-amber-50 border-y border-amber-200">', '<tr className="fin-row-opening">'],
    ['<tr className="bg-blue-50 border-y border-blue-200">', '<tr className="fin-row-closing">']
]);

// 6. OutstandingReceivables / OutstandingPayables
['OutstandingReceivables.tsx', 'OutstandingPayables.tsx'].forEach(p => {
    modifyFile(path.join(root, p), [
        [/style=\{\{ color: daysOverdue > 0 \? "#991b1b" : "#059669" \}\}/g, 'className={`td-right ${daysOverdue > 0 ? "age-" + (daysOverdue<=30?30:daysOverdue<=60?60:daysOverdue<=90?90:"over90") : ""}`}'],
        [/className="bg-red-50"/g, '']
    ]);
});

// 7. CashFlowStatement.tsx
modifyFile(path.join(root, "CashFlowStatement.tsx"), [
    ['<div className="px-3 py-1.5 bg-[#eef2ff] border-b border-blue-100 mt-4 text-[11px] font-bold text-[#1557b0] uppercase tracking-wider">', '<div className="report-section-heading">'],
    ['<div className="px-3 py-1.5 bg-[#eef2ff] border-b border-blue-100 text-[11px] font-bold text-[#1557b0] uppercase tracking-wider">', '<div className="report-section-heading">'],
    ['<div className="px-3 py-1.5 bg-[#f0fdf4] border-b border-green-200 mt-4 text-[11px] font-bold text-[#059669] uppercase tracking-wider">', '<div className="report-section-heading">'],
    ['<div className="px-3 py-1.5 bg-[#fff7ed] border-b border-orange-200 mt-4 text-[11px] font-bold text-[#d97706] uppercase tracking-wider">', '<div className="report-section-heading">']
]);

// 9. PartyStatement.tsx
modifyFile(path.join(root, "PartyStatement.tsx"), [
    ['<tr className="bg-amber-50 border-y border-amber-200 text-[11px]">', '<tr className="fin-row-opening">'],
    ['<tr className="bg-blue-50 border-y border-blue-200 text-[11px]">', '<tr className="fin-row-closing">']
]);

// 10. RatioAnalysis.tsx
modifyFile(path.join(root, "RatioAnalysis.tsx"), [
    [/<Badge className="bg-\[#[a-f0-9]+\] text-\[#[a-f0-9]+\] border-\[#[a-f0-9]+\]".*?>.*?<\/Badge>/gs, 
     '<span className="ratio-benchmark">(Normal: {ratio.benchmark})</span>']
]);

// 11. BudgetVsActual.tsx
modifyFile(path.join(root, "BudgetVsActual.tsx"), [
    [/<td className="px-3 py-2 text-right font-mono text-\[12px\] \$\{variance >= 0 \? "text-green-700" : "text-red-600"\}.*?>/g,
     '<td className={`td-right ${variance >= 0 ? "variance-positive" : "variance-negative"}`}>']
]);

// 12. ChartOfAccounts.tsx
modifyFile(path.join("src/components", "ChartOfAccounts.tsx"), [
    ['<FolderOpen size={14} className="text-[#1557b0] shrink-0" />', ''],
    ['<FolderOpen size={13} className="text-gray-500 shrink-0" />', ''],
    ['<BookOpen size={12} className="text-gray-400 shrink-0" />', ''],
    ['<tr className="hover:bg-gray-50 border-b border-gray-100 transition-colors">', '<tr className="fin-row-ledger">']
]);
