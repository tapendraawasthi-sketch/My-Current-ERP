# Premium Redesign Spec — Sutra ERP

## Binding constraint
AGENTS.md is the source of truth for all colors, fonts, button/input/table classes, and
page header pattern. This document adds INTERACTION and DENSITY rules on top of it. It
never overrides a color, font-size, or spacing value defined in AGENTS.md. No new colors,
no new font sizes, no gradients, no blur, no heavy shadows — ever.

## What "premium" means here
Premium = disciplined hierarchy + keyboard-first speed + zero clutter, not new visual
flourish. Every screen redesigned under this spec must satisfy all of the following:
 - Every list/report table uses the existing .data-table or .report-table classes from
   src/styles.css — never ad hoc <table> styling.
 - Every amount column uses .number-cell / .number-cell-bold / .number-cell-dr /
   .number-cell-cr from src/styles.css — right-aligned, tabular-nums, monospaced.
 - Every status uses the existing .status-pill-* or .badge-* classes — never a new
   inline-styled pill.
 - Every page follows the exact "Standard page header" block from AGENTS.md — title,
   subtitle, right-aligned actions — no exceptions, no custom headers.
 - Empty states use the existing .empty-state / .empty-state-icon / .empty-state-title /
   .empty-state-sub classes already defined in src/styles.css.
 - No decorative icon that doesn't map to a real action or a real data state.
 - No page introduces a new shade of blue/green/red/amber — reuse --color-accent,
   --color-positive, --color-negative, --color-warning exactly as defined in styles.css.

## The Account Books Drill-Down (Display > Ledger) interaction model
This lives under Reports, not under Masters. Masters (Chart of Accounts) keeps its
existing click-to-expand / double-click-to-edit behavior unchanged.

Three levels, rendered as a single indented tree (accordion-style), keyboard-driven:
  Level 0: Primary Groups (e.g. "Current Assets", "Sundry Creditors")
  Level 1: Sub-Groups under the focused Primary Group
  Level 2: Ledgers under the focused Sub-Group (or directly under a Primary Group with
           no sub-groups)

Keyboard map (must be identical across every screen that uses this pattern):
  ArrowDown / ArrowUp   → move focus to next/previous visible row, no scroll jump
  ArrowRight            → expand focused Group/Sub-Group (if collapsed)
  ArrowLeft             → collapse focused Group/Sub-Group (if expanded); if already
                          collapsed or is a Ledger row, move focus to its parent row
  Enter                 → on a Group/Sub-Group: toggle expand/collapse in place
                          on a Ledger: navigate into the Ledger Statement view (Phase 4)
  Escape                → from the Ledger Statement view: return to the tree at the
                          exact scroll position and expand-state it was left in
  Home / End            → jump to first / last visible row
  Type-ahead            → typing a letter jumps focus to the next visible row whose
                          name starts with that letter (case-insensitive), Explorer-style

Focus row style: left border 3px solid var(--color-accent), background
rgba(21,87,176,0.06), no other row styling changes. This must look identical whether
reached by mouse hover or by keyboard, so users always know exactly what Enter will do.

## Ledger Statement view — period model
Segmented control with four states, using the existing .report-toggle / .report-toggle
button.active classes from src/styles.css:
  "Month" | "Quarter" | "Year" | "Custom"
 - Month: dropdown of Bikram Sambat months within the ledger's fiscal year, built from
   the existing helpers in src/lib/nepaliDate.ts — do not add a new calendar library.
 - Quarter: dropdown of the four Nepali fiscal quarters (Shrawan–Ashwin, Kartik–Poush,
   Magh–Chaitra, Baisakh–Ashadh).
 - Year: whole fiscal year, default on entry.
 - Custom: two BS date inputs (From/To) using the same date-entry pattern already used
   elsewhere in the app for BS dates.
Columns, in order: Date (BS) | Voucher Type | Voucher No. | Narration | Debit |
Credit | Running Balance. Debit/Credit/Balance use .number-cell-dr / .number-cell-cr /
.number-cell-bold respectively. Opening balance and closing balance are shown as a
sticky header row above the table (position: sticky; top: <header height>) so they stay
visible while scrolling. Pressing Enter or clicking a voucher row must open that exact
voucher in its existing edit screen — reuse whatever navigation mechanism the Day Book
or Sales Register page already uses to open a voucher by id, do not invent a new one.
