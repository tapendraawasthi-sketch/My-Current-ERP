const fs = require('fs');

function processStyles() {
    const path = 'src/styles.css';
    let c = fs.readFileSync(path, 'utf8');

    const newRoot = `:root {
  --background: #C5E1A5;
  --foreground: #111111;
  --card: #D4EBB5;
  --card-foreground: #111111;
  --popover: #D4EBB5;
  --popover-foreground: #111111;
  --primary: #4A7A30;
  --primary-foreground: #ffffff;
  --secondary: #A8CC88;
  --secondary-foreground: #111111;
  --muted: #B2D494;
  --muted-foreground: #111111;
  --border: #8FB870;
  --input: #DCF0C4;
  --ring: #4A7A30;
  --radius: 0.25rem;
  --accent-orange: #4A7A30;
  --table-header-bg: #A8CC88;
  --table-border: #8FB870;
  --table-stripe: rgba(0,0,0,0.04);
  --table-hover: #B2D494;
  --border-strong: #6FA050;
  --amount-debit: #7A0000;
  --amount-credit: #004400;
  --amount-neutral: #111111;
  --busy-title-bar: #A8CC88;
  --busy-menu-bar: #A8CC88;
  --busy-menu-hover: #B2D494;
  --busy-workspace: #C5E1A5;
  --busy-form-panel: #D4EBB5;
  --busy-form-border: #8FB870;
  --busy-pill-bg: #4A7A30;
  --busy-field-label: #111111;
  --busy-voucher-bg: #D4EBB5;
  --busy-modal-header: #4A7A30;
  --busy-sidebar-key: #4A7A30;
  --busy-row-selected: #4A7A30;
  --busy-status-bar: #A8CC88;
  --busy-hint-bar: #A8CC88;
  --busy-grid-header: #A8CC88;
  --busy-gold-strip: #4A7A30;
  --sidebar-border: #8FB870;
}`;

    c = c.replace(/:root\s*\{[\s\S]*?\}/, newRoot);

    // Initial explicit color replacements
    c = c.replace(/#FFD1D1/gi, '#7A0000');
    c = c.replace(/#E6F2FF/gi, '#111111');
    c = c.replace(/color:\s*#ffffff/gi, 'color: #111111');
    c = c.replace(/color:\s*#fff(?![\w\d])/gi, 'color: #111111');

    // Restore specific classes that need #ffffff
    c = c.replace(/\.totals-row\.total-final\s*\{[^}]*\}/, '.totals-row.total-final { background: #4A7A30; padding: 10px 14px; font-weight: 700; font-size: 14px; color: #ffffff; }');
    c = c.replace(/\.busy-pill\s*\{[^}]*\}/, '.busy-pill { display: inline-block; background: #4A7A30; color: #ffffff; font-weight: bold; font-size: 13px; padding: 3px 18px; text-align: center; border-radius: 4px; }');
    c = c.replace(/\.badge-posted\s*\{[^}]*\}/, '.badge-posted { background: #4A7A30; color: #ffffff; }');
    c = c.replace(/\.badge-paid\s*\{[^}]*\}/, '.badge-paid { background: #4A7A30; color: #ffffff; }');
    c = c.replace(/\.badge-active\s*\{[^}]*\}/, '.badge-active { background: #4A7A30; color: #ffffff; }');

    // Other specific badge styles
    c = c.replace(/\.badge-draft\s*\{[^}]*\}/, '.badge-draft { background: rgba(0,0,0,0.15); color: #111111; }');
    c = c.replace(/\.badge-inactive\s*\{[^}]*\}/, '.badge-inactive { background: rgba(0,0,0,0.15); color: #111111; }');
    c = c.replace(/\.badge-cancelled\s*\{[^}]*\}/, '.badge-cancelled { background: rgba(122,0,0,0.15); color: #7A0000; }');
    c = c.replace(/\.badge-unpaid\s*\{[^}]*\}/, '.badge-unpaid { background: rgba(122,0,0,0.15); color: #7A0000; }');
    c = c.replace(/\.badge-partial\s*\{[^}]*\}/, '.badge-partial { background: rgba(0,0,0,0.12); color: #111111; }');

    // Specific tag inputs
    c = c.replace(/input,\s*select,\s*textarea\s*\{\s*color:\s*#1e293b;\s*\}/g, 'input, select, textarea { color: #111111; }');
    c = c.replace(/color:\s*#1e293b/gi, 'color: #111111');
    c = c.replace(/input::placeholder,\s*select::placeholder,\s*textarea::placeholder\s*\{\s*color:[^}]+\}/, 'input::placeholder,\nselect::placeholder,\ntextarea::placeholder { color: rgba(0,0,0,0.45) !important; }');
    c = c.replace(/\.search-input::placeholder\s*\{\s*color:[^}]+\}/, '.search-input::placeholder { color: rgba(0,0,0,0.45); }');

    // Amts
    c = c.replace(/\.amt-dr\s*\{\s*color:[^}]+\}/, '.amt-dr { color: var(--amount-debit); }');
    c = c.replace(/\.amt-cr\s*\{\s*color:[^}]+\}/, '.amt-cr { color: var(--amount-credit); }');
    c = c.replace(/\.amt-neutral\s*\{\s*color:[^}]+\}/, '.amt-neutral { color: #111111; }');
    c = c.replace(/\.amt-positive\s*\{\s*color:[^}]+\}/, '.amt-positive { color: #111111; }');
    c = c.replace(/\.amt-negative\s*\{\s*color:[^}]+\}/, '.amt-negative { color: #7A0000; }');
    c = c.replace(/\.amt-zero\s*\{\s*color:[^}]+\}/, '.amt-zero { color: #111111; }');

    c = c.replace(/\.sidebar-active-item::before\s*\{([^}]*)background-color:[^;]+;/g, '.sidebar-active-item::before {$1background-color: #4A7A30;');

    c = c.replace(/\.kpi-value\s*\{([^}]*)color:[^;]+;/g, '.kpi-value {$1color: #111111;');
    c = c.replace(/\.page-title\s*\{([^}]*)color:[^;]+;/g, '.page-title {$1color: #111111;');
    c = c.replace(/\.section-header\s*\{([^}]*)color:[^;]+;/g, '.section-header {$1color: #111111;');
    c = c.replace(/\.form-section-title\s*\{([^}]*)color:[^;]+;/g, '.form-section-title {$1color: #111111;');
    
    c = c.replace(/\.line-table td\s*\{([^}]*)color:[^;]+;/g, '.line-table td {$1color: #111111;');
    c = c.replace(/\.line-table td\s*\{([^}]*)background:[^;]+;/g, '.line-table td {$1background: var(--card);');
    c = c.replace(/\.line-table th\s*\{([^}]*)color:[^;]+;/g, '.line-table th {$1color: #111111;');
    c = c.replace(/\.data-table thead th\s*\{([^}]*)color:[^;]+;/g, '.data-table thead th {$1color: #111111;');
    c = c.replace(/\.data-table tbody td\s*\{([^}]*)color:[^;]+;/g, '.data-table tbody td {$1color: #111111;');
    c = c.replace(/\.data-table tfoot td\s*\{([^}]*)color:[^;]+;/g, '.data-table tfoot td {$1color: #111111;');
    c = c.replace(/\.totals-row\s*\{([^}]*)color:[^;]+;/g, '.totals-row {$1color: #111111;');
    
    c = c.replace(/\.busy-field-value\s*\{([^}]*)color:[^;]+;/g, '.busy-field-value {$1color: #111111;');
    
    c = c.replace(/\.busy-flat-btn\s*\{([^}]*)background:[^;]+;/g, '.busy-flat-btn {$1background: var(--secondary);');
    c = c.replace(/\.busy-flat-btn\s*\{([^}]*)color:[^;]+;/g, '.busy-flat-btn {$1color: #111111;');
    c = c.replace(/\.busy-flat-btn\s*\{([^}]*)border-color:[^;]+;/g, '.busy-flat-btn {$1border-color: var(--border);');
    c = c.replace(/\.busy-flat-btn\s*\{([^}]*)border:\s*1px\s+solid[^;]+;/g, '.busy-flat-btn {$1border: 1px solid var(--border);');
    
    c = c.replace(/\.busy-orange-modal-header\s*\{[^}]+\}/, '.busy-orange-modal-header { background: #4A7A30; color: #ffffff; font-weight: bold; padding: 6px 10px; font-size: 13px; border-radius: 4px 4px 0 0; }');
    c = c.replace(/\.line-table input::placeholder,\s*\.line-table select::placeholder\s*\{\s*color:[^}]+\}/, '.line-table input::placeholder,\n.line-table select::placeholder { color: rgba(0,0,0,0.45); }');

    fs.writeFileSync(path, c);
}

processStyles();
console.log('styles.css done');
