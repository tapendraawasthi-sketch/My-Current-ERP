# UI-6 — Orbix Accessibility and Keyboard Spec

**Surface:** `OrbixWorkspace` (page + overlay) inside AppShell  
**Target:** zero **serious** / **critical** axe violations on an Orbix fixture (to be added alongside UI-6 implementation; follow UI-4/UI-5 fixture pattern)

## Landmarks and headings

- Workspace should expose a clear main region (conversation) and complementary region (context inspector / session rail).
- Visible heading hierarchy: workspace title → section labels (sessions, messages, context) without skipped levels.
- Context inspector already uses `aria-label="Context inspector"` — keep or promote to labelled landmark.

## Focusable only when interactive

| Element | Focusable? |
|---------|------------|
| Session select / new chat / delete | Yes |
| Mode toggle (Ask / Accountant) | Yes |
| Message actions (switch mode, open voucher when wired) | Yes |
| Confirm / Cancel pending | Yes |
| Composer textarea + send / stop | Yes |
| Context panel toggle | Yes |
| Static message text, sync labels, journal readouts | No (unless a control) |
| Decorative neuron / sparkles icons | `aria-hidden` |

All interactive controls: visible `focus-visible` ring (`--ox-focus-ring` today; migrate to DS focus tokens).

## Keyboard

| Action | Expectation |
|--------|-------------|
| Tab order | Session rail → mode/header → message actions → pending confirm → composer → context toggle/panel |
| Enter in composer | Send (existing behaviour) unless Shift+Enter for newline if supported |
| Escape | Close overlay / help popovers; must not discard pending confirm without Cancel |
| Confirm / Cancel | Reachable without pointer; danger confirm should not be the only Tab stop after error |
| Jump to latest | Keyboard-activatable when shown |

No positive `tabIndex` on non-interactive nodes. Shell skip link and command palette remain AppShell responsibilities.

## Live regions

| Event | Politeness |
|-------|------------|
| Posting progress / stages | `aria-live="polite"` |
| Posting completed / failed | `polite` or `assertive` for failure |
| Stale preview / mode restriction | `assertive` preferred for gate failures |
| Sync status line under Posted locally | `polite` |

Avoid flooding live regions on every token of streaming text — announce final structured state.

## Mode honesty (a11y)

- Mode selector must expose selected state (`aria-pressed` / `role="radiogroup"` pattern as implemented).
- Ask Mode description must remain available to SR users (help popover content not pointer-only).

## Overlays

- `EKhataPanel` overlay: focus trap recommended when maximized; page variant relies on AppShell.
- When `currentPage === "orbix"`, panel returns null — no duplicate focusable trees.

## Charts / reports

`OrbixReportTable` must remain keyboard-scrollable and header-announced; numeric cells remain text, not only colour.

## Axe target

- Tags: WCAG 2.0/2.1 A/AA as in prior UI phases.
- Scope: workspace root test id (to be standardized, e.g. `data-testid="orbix-workspace"`).
- **Pass criterion:** `serious_or_critical.length === 0`.
