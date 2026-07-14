# UI-4 Auth Accessibility and Keyboard Spec

**Phase:** UI-4  
**Surfaces:** Pre-workspace shell and auth screens  
**Target:** WCAG-aligned patterns consistent with UI-3 shell spec; zero serious/critical axe on auth fixture harness when run

## Global shell (`PreWorkspaceShell`)

| Requirement | Implementation |
|-------------|----------------|
| Skip link | First focusable element → `#pre-workspace-main`; `sr-only` until focused |
| Landmark regions | `header` `role="banner"`; optional `aside` `aria-label="Product identity"`; `main` `id="pre-workspace-main"` `tabIndex={-1}` |
| Page title | Visible screen titles use `<h2>` in cards; shell `title` prop → `sr-only` `<h1>` |
| Focus ring | `ds-focus-ring` on theme toggle, Help link, interactive controls |
| Colour | DS tokens only; status via `--ds-status-*` |
| Touch targets | Theme toggle 36×36px (`h-9 w-9`); DS buttons meet compact enterprise minimums |
| Print | Header `ds-no-print`; auth cards print as content |

## Focus management

| Screen | Initial focus | Error focus |
|--------|---------------|-------------|
| Gateway | **Open company** button (`openBtnRef`) on company id change | — |
| Company login | Username `Input` (`usernameRef`) on mount | `ErrorSummary` container `tabIndex={-1}` when `error` set |
| Onboarding | First field in active step (per step component ids) | `ErrorSummary` when step validation fails |
| Session restore | None (status-only) | — |
| Init error | Primary retry button (natural tab order) | — |

## Keyboard interactions

| Context | Key | Action |
|---------|-----|--------|
| Company login | `Escape` | `backToGateway()` when not submitting |
| Gateway / wizard | `Escape` | No global handler (avoid accidental exit) |
| All forms | `Enter` | Submit focused form (native form behaviour) |
| Password field | — | Show/hide toggle is `type="button"`; not in tab-trap |

Authenticated shell shortcuts (Ctrl+B, etc.) in `App.tsx` are **inactive** during pre-workspace stages because `renderAuthStage` returns before `Layout`.

## Live regions and status

| Component | ARIA |
|-----------|------|
| `SessionRestoringScreen` | `role="status"` `aria-live="polite"` |
| `CompanyOpeningPanel` | `role="status"` `aria-live="polite"` |
| `ErrorSummary` | Announced via focused container after submit failure |
| `Alert` / `Banner` (offline, lockout) | DS components expose appropriate semantics |
| `LoadingState` | Accessible label: "Loading company data…" |
| `StepProgress` | Step names exposed in DS component (verify harness) |

## Form accessibility

### Company login

- Labels: `htmlFor` → `orbix-login-username`, `orbix-login-password`
- `autoComplete`: `username`, `current-password`
- Invalid state: `invalid` + `aria-invalid` + `aria-describedby` → field error paragraph ids
- Password reveal: `aria-label` "Show password" / "Hide password"; icon `aria-hidden`
- Submit: `disabled` when locked or submitting; `loading` state on DS `Button`

### Onboarding steps

- Field ids prefixed `wiz-*` (e.g. `wiz-company-en`)
- `FieldError` tied to inputs via DS `Label` / `invalid` props
- Required fields marked with visible asterisk and validation message

### Gateway search

- `sr-only` label "Search companies"
- Search icon `aria-hidden`
- Company list: `ul` `aria-label="Companies"`
- Open button: `aria-label="Open company {name}"`

## Lockout and offline

- Lockout communicated via **both** `ErrorSummary` and `Alert` — ensure axe does not flag duplicate focus; error summary receives focus on failed submit.
- Offline: `Alert` tone warning before form; submit blocked with error message (policy copy).
- Countdown in lockout alert uses `<strong>` for seconds; screen readers announce changes each second via live text update in Alert body.

## Theming

- Theme toggle: `aria-label` reflects target mode ("Switch to light theme" / "Switch to dark theme")
- Icons `aria-hidden`; control name from `aria-label` only
- Dark mode via root `data-theme`; auth uses same tokens as UI-3

## Responsive

| Breakpoint | Behaviour |
|------------|-----------|
| `< lg` | Brand panel hidden; single-column centred card |
| `≥ lg` | Brand panel visible when `showBrandPanel` |
| `sm+` | Help link visible in header |
| Onboarding | `contentWidth="wide"` `max-w-3xl`; step grids `md:grid-cols-2` |

## E2E / fixture

- Harness: `/e2e/ui-auth.html` → `uiAuthHarness.tsx`
- Gate: `DEV` or `VITE_ALLOW_AUTH_FIXTURE=true`
- Stable selectors: `data-testid` on `pre-workspace-shell`, `gateway-screen`, `company-login-screen`, `signup-wizard`, `session-restoring`, `init-error-screen`, `gateway-open-company`, `login-submit`, `wizard-activate`
- Spec: `e2e/ui-auth-baseline.spec.ts` (when run in CI)

## Verification checklist

- [ ] Skip link reaches main content on Tab from load
- [ ] Gateway Open company receives initial focus
- [ ] Login username receives initial focus; Escape returns to gateway
- [ ] Failed login moves focus to error summary
- [ ] All form fields have programmatic labels
- [ ] No serious/critical axe violations on auth fixture pages
- [ ] Colour contrast passes on light and dark theme for primary auth card

## Related documents

- `UI3_SHELL_ACCESSIBILITY_AND_KEYBOARD_SPEC.md` — post-auth shell
- `UI4_AUTH_AND_TRUST_CONTENT_POLICY.md` — alert/error strings
- `UI_ACCESSIBILITY_FOUNDATIONS.md` — DS-wide patterns
