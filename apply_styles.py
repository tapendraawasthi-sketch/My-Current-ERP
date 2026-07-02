import os
import re

def modify_file(filepath, replacements):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for target, replacement in replacements:
        if callable(target):
            new_content = target(new_content)
        elif isinstance(target, re.Pattern):
            new_content = target.sub(replacement, new_content)
        else:
            new_content = new_content.replace(target, replacement)
    
    if content != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Modified {filepath}")
    else:
        print(f"No changes in {filepath}")

def main():
    root = "src/pages"
    
    # 1. BalanceSheet.tsx
    modify_file(os.path.join(root, "BalanceSheet.tsx"), [
        (re.compile(r'const sectionColors = \{.*?\};\n', re.DOTALL), ''),
        (re.compile(r'style=\{\{\s*borderLeft:\s*`3px solid \$\{sectionColors\.[a-zA-Z]+\}`\s*\}\}'), 'className="report-section-heading"'),
        (re.compile(r'style=\{\{\s*borderLeft:\s*`3px solid \$\{sectionColors\.[a-zA-Z]+\}`,\s*\}\}'), 'className="report-section-heading"'),
        ('<table className="report-table w-full">', '<table className="tformat-table">'),
        ('<div className="flex items-center justify-between px-3 py-2.5 bg-[#1557b0] text-white">\n          <span className="text-[12px] font-bold">TOTAL</span>', 
         '<div className="fin-row-total">\n          <span className="text-[12px] font-bold">TOTAL</span>'),
        ('<div className="flex items-center justify-between px-3 py-2.5 bg-[#1557b0] text-white">\n        <span className="text-[12px] font-bold">TOTAL ASSETS</span>',
         '<div className="fin-row-total">\n        <span className="text-[12px] font-bold">TOTAL ASSETS</span>'),
        (re.compile(r'<button\s+className="[^"]*text-\[#1557b0\] hover:underline[^"]*"\s+onClick=\{([^}]+)\}>'), r'<button className="drill-link" onClick={\1}>'),
        # Drill link back
        (re.compile(r'<button\s+onClick=\{([^}]+)\}\s+className="text-\[#1557b0\] hover:underline text-left flex items-center gap-1"\s*>'), r'<button className="report-back-link" onClick={\1}>'),
        (re.compile(r'className="text-\[#1557b0\] hover:underline flex items-center gap-1"'), 'className="report-back-link"'),
    ])

    # 2. ProfitLoss.tsx
    modify_file(os.path.join(root, "ProfitLoss.tsx"), [
        (re.compile(r'style=\{\{\s*color:\s*"#059669"\s*\}\}'), 'className="report-section-heading"'),
        (re.compile(r'style=\{\{\s*color:\s*"#dc2626"\s*\}\}'), 'className="report-section-heading"'),
        (re.compile(r'<tr className="fin-row-total".*?>.*?Net \{netProfit >= 0 \? "Profit" : "Loss"\}.*?</tr>', re.DOTALL),
         '<tr className="fin-row-total">\n  <td>Net {netProfit >= 0 ? "Profit" : "Loss"}</td>\n  <td style={{ textAlign: "right", fontFamily: "Courier New" }}>\n    {netProfit >= 0 ? fmtMoney(netProfit) : `(${fmtMoney(Math.abs(netProfit))})`}\n  </td>\n</tr>'),
    ])

    # 3. TrialBalance.tsx
    modify_file(os.path.join(root, "TrialBalance.tsx"), [
        (re.compile(r'<tr className="bg-\[#f0f9ff\].*?">', re.DOTALL), '<tr className="fin-row-group">'),
        (re.compile(r'<tr className="hover:bg-gray-50 border-b border-gray-100.*?"'), '<tr className="fin-row-ledger"'),
        (re.compile(r'<td style=\{\{\s*textAlign:\s*"right"\s*\}\}>\s*\{Math\.abs\(totalDr - totalCr\) < 0\.01.*?</td\>', re.DOTALL),
         '<td style={{ textAlign: "right" }}>\n    {Math.abs(totalDr - totalCr) < 0.01\n      ? <span className="tb-balanced-badge">✓ Balanced</span>\n      : <span className="tb-unbalanced-badge">✗ Mismatch</span>\n    }\n  </td>'),
    ])

    # 4. DayBook.tsx
    modify_file(os.path.join(root, "DayBook.tsx"), [
        (re.compile(r'<tr className="bg-gray-50.*?>\s*<td colSpan=\{4\}>\s*<span style=\{\{ fontWeight: 700, fontSize: 12 \}\}>.*?</tr>', re.DOTALL),
         lambda m: m.group(0).replace('className="bg-gray-50', 'className="daybook-group-header')),
        (re.compile(r'<tr className="bg-\[#f8fafc\] border-t border-gray-200">'), '<tr className="fin-row-subtotal">'),
        (re.compile(r'<tr className="bg-\[#eef2ff\] border-y-2 border-[#c7d2fe]">'), '<tr className="fin-row-total">'),
    ])

    # 5. GeneralLedger.tsx
    modify_file(os.path.join(root, "GeneralLedger.tsx"), [
        ('<tr className="bg-amber-50 border-y border-amber-200">', '<tr className="fin-row-opening">'),
        ('<tr className="bg-blue-50 border-y border-blue-200">', '<tr className="fin-row-closing">'),
    ])

    # 6. OutstandingReceivables / OutstandingPayables
    def fix_outstanding(p):
        modify_file(os.path.join(root, p), [
            (re.compile(r'style=\{\{ color: daysOverdue > 0 \? "#991b1b" : "#059669" \}\}'), 'className={`td-right ${daysOverdue > 0 ? "age-" + (daysOverdue<=30?30:daysOverdue<=60?60:daysOverdue<=90?90:"over90") : ""}`}'),
            (re.compile(r'className="bg-red-50"'), ''),
        ])
    fix_outstanding("OutstandingReceivables.tsx")
    fix_outstanding("OutstandingPayables.tsx")

    # 7. CashFlowStatement.tsx
    modify_file(os.path.join(root, "CashFlowStatement.tsx"), [
        ('<div className="px-3 py-1.5 bg-[#eef2ff] border-b border-blue-100 mt-4 text-[11px] font-bold text-[#1557b0] uppercase tracking-wider">', '<div className="report-section-heading">'),
        ('<div className="px-3 py-1.5 bg-[#eef2ff] border-b border-blue-100 text-[11px] font-bold text-[#1557b0] uppercase tracking-wider">', '<div className="report-section-heading">'),
        ('<div className="px-3 py-1.5 bg-[#f0fdf4] border-b border-green-200 mt-4 text-[11px] font-bold text-[#059669] uppercase tracking-wider">', '<div className="report-section-heading">'),
        ('<div className="px-3 py-1.5 bg-[#fff7ed] border-b border-orange-200 mt-4 text-[11px] font-bold text-[#d97706] uppercase tracking-wider">', '<div className="report-section-heading">'),
    ])

    # 8. VatReports.tsx
    # Nothing huge, skip for now.

    # 9. PartyStatement.tsx
    modify_file(os.path.join(root, "PartyStatement.tsx"), [
        ('<tr className="bg-amber-50 border-y border-amber-200 text-[11px]">', '<tr className="fin-row-opening">'),
        ('<tr className="bg-blue-50 border-y border-blue-200 text-[11px]">', '<tr className="fin-row-closing">'),
    ])

    # 10. RatioAnalysis.tsx
    modify_file(os.path.join(root, "RatioAnalysis.tsx"), [
        (re.compile(r'<Badge className="bg-\[#[a-f0-9]+\] text-\[#[a-f0-9]+\] border-\[#[a-f0-9]+\]".*?>.*?</Badge>', re.DOTALL), 
         '<span className="ratio-benchmark">(Normal: benchmark)</span>'),
    ])

    # 11. BudgetVsActual.tsx
    modify_file(os.path.join(root, "BudgetVsActual.tsx"), [
        (re.compile(r'<td className="px-3 py-2 text-right font-mono text-\[12px\] \$\{variance >= 0 \? "text-green-700" : "text-red-600"\}">'),
         '<td className={`td-right ${variance >= 0 ? "variance-positive" : "variance-negative"}`}>'),
    ])

    # 12. ChartOfAccounts.tsx
    modify_file(os.path.join("src/components", "ChartOfAccounts.tsx"), [
        ('<FolderOpen size={14} className="text-[#1557b0] shrink-0" />', ''),
        ('<FolderOpen size={13} className="text-gray-500 shrink-0" />', ''),
        ('<BookOpen size={12} className="text-gray-400 shrink-0" />', ''),
        ('<tr className="hover:bg-gray-50 border-b border-gray-100 transition-colors">', '<tr className="fin-row-ledger">'),
    ])

if __name__ == "__main__":
    main()
