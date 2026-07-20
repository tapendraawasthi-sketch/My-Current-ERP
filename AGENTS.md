<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

---

## Sutra ERP — Design System & Project Rules (read before any UI task)

Brand & tone: professional accounting software (Busy Cloud / Tally Cloud style), not a consumer app. Sharp corners, dense data tables, no decorative gradients/blur/heavy shadows. Avoid shout UI (oversized type, decorative gradients, purple/violet accents).

### Migrated pages (prefer this)

Use tokens from `src/design-system/foundations/tokens.css` via Tailwind `var(--ds-*)` / DS primitives (`Button`, `Input`, `PageHeader`, `Avatar`, `EnterpriseDataTable`, etc.). Do not hardcode brand hex on surfaces already on `--ds-*`.

- Brand: `--ds-action-primary` / `--ds-brand-*` (reference hex #1557b0 / hover #0f4a96)
- Surfaces: `--ds-canvas`, `--ds-surface`, `--ds-surface-muted`
- Text: `--ds-text-strong`, `--ds-text-default`, `--ds-text-muted`, `--ds-text-subtle`
- Borders / status: `--ds-border-default`, `--ds-status-*`
- Dark mode: `[data-theme="dark"]` overrides the same `--ds-*` keys (ThemeContext)

Typography on migrated pages: page title ~15px semibold `--ds-text-strong`; subtitle ~11px `--ds-text-muted`; table headers ~10px uppercase tracking-wide muted; body/cells ~12px; never font-black, text-base/xl, tracking-widest, or uppercase on data/names/amounts.

Prefer `PageHeader` / DS layout composites over hand-rolled page chrome.

### Legacy Busy tips (unmigrated pages only)

Colors (also in `src/styles.css`): primary #1557b0 (hover #0f4a96), success #059669, warning #d97706, danger #dc2626, info #0284c7. Sidebar bg #1e2433, hover #273148, border #2d3748. Page bg #f5f6fa. Never re-introduce indigo/purple/violet.

Typography: page title `text-[15px] font-semibold text-gray-800`; page subtitle `text-[11px] text-gray-500`; section/table header `text-[10px] font-semibold text-gray-500 uppercase tracking-wide`; form label `text-[11px] font-medium text-gray-600`; body/cell text `text-[12px]`.

Standard page header (list/report pages not yet on PageHeader):

<div className="flex items-center justify-between mb-4">
  <div>
    <h1 className="text-[15px] font-semibold text-gray-800">{TITLE}</h1>
    <p className="text-[11px] text-gray-500 mt-0.5">{SUBTITLE}</p>
  </div>
  <div className="flex items-center gap-2">{ACTIONS}</div>
</div>

Buttons: primary `h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md`; outline `h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50`. Heights: xs=h-6, sm=h-7, md=h-8, lg=h-9. Never h-10+/h-12 except the auth Sign In button.

Inputs/selects: `h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]`.

Tables: thead tr `bg-[#f5f6fa] border-b border-gray-200`; th `px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide`; td `px-3 py-2.5 text-[12px] text-gray-700`; total/closing row `bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe]`; amount cells `font-mono text-right`.

Badges: rounded `px-2 py-0.5 text-[10px] font-semibold uppercase`. Status colors: success=green-100/green-700, warning=amber-100/amber-700, danger=red-100/red-700, info=blue-100/blue-700, default=gray-100/gray-700.

Balance/validation indicator pattern (journal balance, opening balance, bank reconciliation):
balanced → bg-green-50 text-green-700 border border-green-200
unbalanced → bg-red-50 text-red-700 border border-red-200

Print: wrap on-screen filters/toolbars in `no-print`, wrap print-only headers in `print-only hidden`.

Scope rules — do not deviate without being told:

- Never read or edit anything under node_modules, dist, .git, .workspace, .tanstack.
- src/components/StockItems.tsx, src/components/invoice/PurchaseInvoiceForm.tsx, and src/components/invoice/ReturnInvoiceForm.tsx are dead/unused files. Do not open or edit them.
- The 'items' route renders src/pages/StockBook.tsx (not StockItems.tsx).
- src/components/invoice/SalesInvoiceForm.tsx is the single form used for all 4 billing tabs (sales invoice, purchase invoice, sales return, purchase return) inside src/pages/BillingInvoice.tsx.
- Only edit the files explicitly named in the current task. Do not search the rest of the repo "just in case."
