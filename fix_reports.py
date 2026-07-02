import os
import re

def main():
    root = 'src/pages'
    components = 'src/components'
    
    # ---------------------------------------------------------
    # BalanceSheet.tsx
    # ---------------------------------------------------------
    p = os.path.join(root, 'BalanceSheet.tsx')
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
            
        c = re.sub(r'const sectionColors = \{.*?\};\n', '', c, flags=re.DOTALL)
        c = re.sub(r'style=\{\{\s*borderLeft:\s*`3px solid \$\{sectionColors\.[a-z]+\}`\s*\}\}', 'className="report-section-heading"', c)
        c = re.sub(r'style=\{\{\s*borderLeft:\s*`3px solid \$\{sectionColors\.[a-z]+\}`,\s*\}\}', 'className="report-section-heading"', c)
        
        # Change 2 — T-format table header
        c = re.sub(r'<table className="w-full border-collapse text-\[12px\] tabular-nums">\s*<thead>\s*<tr>\s*<th className="bg-\[#d4eabd\].*?>Assets</th>\s*<th className="bg-\[#d4eabd\].*?>Amount.*?</th>\s*<th className="bg-\[#d4eabd\].*?>Liabilities & Equity</th>\s*<th className="bg-\[#d4eabd\].*?>Amount.*?</th>\s*</tr>\s*</thead>', 
                   '<table className="tformat-table">\n  <thead>\n    <tr>\n      <th>Assets</th>\n      <th className="th-r">Amount</th>\n      <th>Liabilities &amp; Equity</th>\n      <th className="th-r">Amount</th>\n    </tr>\n  </thead>', c, flags=re.DOTALL)
        
        # Change 3 — Group / sub-group / ledger row classes
        # This one is tricky if they use dynamic tailwind classes. I'll replace the row structures.
        c = re.sub(r'<tr className="bg-\[#f0f9ff\] border-y border-\[#bae6fd\]">', '<tr className="fin-row-group">', c)
        c = re.sub(r'<tr className="bg-\[#fdf4ff\] border-b border-\[#fbcfe8\]">', '<tr className="fin-row-group">', c)
        # There might be others like `<tr className="hover:bg-gray-50 border-b border-gray-100">`
        # Or `<tr className="bg-gray-50 border-b border-gray-100">` -> subtotal
        
        # Change 4 — Grand total row dark navy
        c = re.sub(r'<div className="flex items-center justify-between px-3 py-2\.5 bg-\[#1557b0\] text-white">.*?TOTAL.*?</div>', 
                   '<tr className="fin-row-total">\n  <td>Total Assets</td>\n  <td style={{ textAlign: "right" }}>{fmt(bs.totalAssets)}</td>\n  <td>Total Liabilities &amp; Equity</td>\n  <td style={{ textAlign: "right" }}>{fmt(bs.totalLiabilitiesEquity)}</td>\n</tr>', c, flags=re.DOTALL)
        
        # Change 5 — Drill-through links
        c = re.sub(r'<button\s*onClick=\{([^}]+)\}\s*className="hover:underline text-left"\s*>', r'<button className="drill-link" onClick={\1}>', c)
        c = re.sub(r'<button\s*className="text-\[#1557b0\] hover:underline flex items-center gap-1"\s*onClick=\{([^}]+)\}\s*>', r'<button className="report-back-link" onClick={\1}>', c)
        c = re.sub(r'<button\s*onClick=\{([^}]+)\}\s*className="text-\[#1557b0\] hover:underline text-left flex items-center gap-1"\s*>', r'<button className="report-back-link" onClick={\1}>', c)

        # Change 6 — OptionsDialog toggle buttons
        c = re.sub(r'const tog = \(active: boolean\) =>\s*`inline-flex h-7 px-3 text-\[11px\] font-semibold rounded transition-colors \$\{\s*active \? "bg-\[#1557b0\] text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"\s*\}`;', 'const tog = (active: boolean) =>\n    `btn ${active ? "btn-primary" : "btn-outline"} btn-sm`;', c)

        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)

    # ---------------------------------------------------------
    # ProfitLoss.tsx
    # ---------------------------------------------------------
    p = os.path.join(root, 'ProfitLoss.tsx')
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        
        # Change 1
        c = re.sub(r'style=\{\{\s*color:\s*"#059669"\s*\}\}', 'className="report-section-heading"', c)
        c = re.sub(r'style=\{\{\s*color:\s*"#dc2626"\s*\}\}', 'className="report-section-heading"', c)
        
        # Change 2
        # Usually it's `Net Profit` or `Net Loss` with color coding. Let's just find `Net Profit` and replace the whole row if needed, but it might be easier to just remove the color inline style.
        c = re.sub(r'<tr className="fin-row-total".*?>.*?Net \{netProfit >= 0 \? "Profit" : "Loss"\}.*?</tr>', 
                   '<tr className="fin-row-total">\n  <td>Net {netProfit >= 0 ? "Profit" : "Loss"}</td>\n  <td style={{ textAlign: "right", fontFamily: "Courier New" }}>\n    {netProfit >= 0 ? fmtMoney(netProfit) : `(${fmtMoney(Math.abs(netProfit))})`}\n  </td>\n</tr>', c, flags=re.DOTALL)
        
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)

    # ---------------------------------------------------------
    # TrialBalance.tsx
    # ---------------------------------------------------------
    p = os.path.join(root, 'TrialBalance.tsx')
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()

        # Just look for the options block and replace
        # Change 1
        # Change 2
        # Change 3
        
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
            
    # And so on... this script is getting complex. I should use a simpler approach:
    # Just do a rough pass or use `replace_file_content` individually.

if __name__ == '__main__':
    main()
