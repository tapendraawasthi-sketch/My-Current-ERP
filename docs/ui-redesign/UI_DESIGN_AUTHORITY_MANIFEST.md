# UI Design Authority Manifest

**Phase:** UI-3 (extends UI-1 / UI-2)  
**Generated:** 2026-07-13  
**Updated:** 2026-07-14 — looks authority → `ORBIX_UI_IMPLEMENT_NOW.md`

## Missing authority file

| File | Status |
|------|--------|
| `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` | **Absent** — searched repository; not found. Do not claim alignment with this document. |

## Active authority (precedence)

| Order | Source | Role |
|------:|--------|------|
| 1 | `AGENTS.md` — accounting/sync safety & Lovable git rules | Non-negotiable functional safety |
| 2 | **`docs/ui-redesign/ORBIX_UI_IMPLEMENT_NOW.md`** | **Sole looks / presentation authority for all new UI migration work** |
| 3 | Phase UI-3…UI-7 reports | Historical evidence of prior waves |
| 4 | Phase UI-2 + UI-1 reports | Interaction + token foundations (superseded where IMPLEMENT_NOW differs) |
| 5 | `docs/PREMIUM_UI_REDESIGN_SPEC.md` | Legacy page patterns until a file is migrated |
| 6 | Phase UI-0 artifacts | Measured baseline |
| 7 | Existing production UI | Compatibility evidence only |

**Superseded looks plans (do not use for new work):** `ORBIX_UI_100_PERCENT_LOOKS_MASTER_PLAN.md`, `ORBIX_UI_FINAL_LOOKS_IMPLEMENTATION_PLAN.md`, `ORBIX_UI_PREMIUM_SIMPLICITY_LOOKS_PLAN.md`.

## Conflict resolution (documented)

- **AGENTS.md** still documents 10–11px labels and `#1557b0` arbitrary Tailwind for **unmigrated** production pages only.
- **Any file touched under IMPLEMENT_NOW** uses `@/design-system`, `var(--ds-*)`, essential text ≥12px, primary `#0F5C8C` per that doc — never mix AGENTS hex into a migrated file.
- Until a page is migrated, legacy AGENTS/ox tokens may remain on that page.
- **PREMIUM_UI_REDESIGN_SPEC.md** never overrides AGENTS safety; looks on migrated code follow IMPLEMENT_NOW.

## Documents read for Phase UI-1

- `AGENTS.md`
- `docs/PREMIUM_UI_REDESIGN_SPEC.md`
- `docs/ui-redesign/ORBIX_UI_PHASE0_BASELINE_AND_GOVERNANCE_REPORT.md`
- `docs/ui-redesign/UI_MIGRATION_TRACKER.md`
- `docs/ui-redesign/UI_DEPENDENCY_MAP.md`
- `docs/ui-redesign/UI_GOVERNANCE_RULES.md`
- `docs/ui-audit/UI_STYLE_AUDIT.md`
- `docs/ui-audit/UI_COMPONENT_DUPLICATION_MAP.md`
- `docs/ui-audit/UI_ACCESSIBILITY_BASELINE.md`
- `docs/ui-audit/UI_RESPONSIVE_BASELINE.md`
- `docs/ui-audit/UI_DARK_MODE_BASELINE.md`
- `docs/ui-audit/UI_SHELL_AUTHORITY_AUDIT.md`
- `docs/ui-audit/UI_NAVIGATION_AUDIT.md`
- `src/styles/design-tokens.css`
- `src/styles.css` (load order)
- Auth: `GatewayScreen.tsx`, `CompanyLoginScreen.tsx`
- UI-0 scripts under `scripts/ui-*.mjs` and `tools/ui-governance/baselines/`

## Before-state capture (UI-1.1)

| Check | Result |
|-------|--------|
| `npm run ui:governance` | PASS (0 new debt) |
| `npx tsc --noEmit` | 151 diagnostics (pre-existing) |
| Token authority | `--ox-*` in `design-tokens.css` imported by `styles.css` |
| CSS load order | Google Fonts CDN → Tailwind → design-tokens → global rules |
| Dark mode | `data-theme="light\|dark"` |
| Density | none (to be added as `data-density`) |
| Icons | Lucide direct imports |
| Component export | `@/components/ui` barrel |
| E2E harnesses | `/e2e/ui-qa.html`, `/e2e/ekhata.html` in Vite MPA input |
