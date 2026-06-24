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

## Sutra ERP — Design System (Busy Accounting Style)

Colors: Use CSS variables defined in src/styles.css.
- Primary: var(--busy-primary) = #1557b0
- Success: var(--busy-success) = #059669  
- Warning: var(--busy-warning) = #d97706
- Danger: var(--busy-danger) = #dc2626
- Sidebar bg: #1a2a3a

Typography: Use CSS classes .page-title, .page-subtitle, .busy-label
Tables: Use class .data-table with thead/tbody structure
Buttons: Use .btn .btn-primary, .btn-outline, .btn-sm, .btn-xs, .btn-lg
Cards: Use .busy-card, .busy-card-header, .busy-card-body
Badges: Use .badge .badge-posted / .badge-draft / .badge-cancelled / .badge-partial

Never use: indigo, purple, violet, green-100/green-700 Tailwind classes for new code.
Always use: CSS variable tokens and Busy-style class names.

Scope rules — do not deviate without being told:
- Never read or edit anything under node_modules, dist, .git, .workspace, .tanstack.
- src/components/StockItems.tsx, src/components/invoice/PurchaseInvoiceForm.tsx, and src/components/invoice/ReturnInvoiceForm.tsx are dead/unused files. Do not open or edit them.
- The 'items' route renders src/pages/StockBook.tsx (not StockItems.tsx).
- src/components/invoice/SalesInvoiceForm.tsx is the single form used for all 4 billing tabs (sales invoice, purchase invoice, sales return, purchase return) inside src/pages/BillingInvoice.tsx.
- Only edit the files explicitly named in the current task. Do not search the rest of the repo "just in case."
