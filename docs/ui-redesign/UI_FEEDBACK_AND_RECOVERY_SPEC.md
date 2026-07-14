# Feedback and Recovery Spec

**Phase:** UI-2.5  
**Import:** `@/design-system`

## Principles

- Colour is never the only signal.
- Toast is transient confirmation only — never the sole channel for posting conflicts, auth failure, irreversible failure, reconciliation mismatch, or data-loss risk.
- Status chips accept **authoritative** sync state; they never infer success.
- Recovery panels show what failed, what remains saved, retry, and a support/reference slot — not raw stack traces by default.

## Components

| Component | Use | Live region |
|-----------|-----|-------------|
| `Alert` | Inline contextual feedback | `role="status"` (non-assertive) |
| `Banner` | Persistent page/app conditions | sticky optional |
| `Toast` + `ToastProvider` / `useToast` | Transient success/minor retry | polite live region; max queue |
| `ErrorSummary` | Form/dialog submission failures | links to fields; focusable |
| `EmptyState` | first-use / no results / filtered / permission / error / completed | — |
| `LoadingState` / `InlineLoading` | Page/card/table/button-adjacent | — |
| `Progress` / `StepProgress` | Determinate/indeterminate; multi-stage only | progressbar / list |
| `RecoveryPanel` | Retryable failures with salvage context | — |
| `SyncStatusChip` | Local…Action required visual foundation | visual only |
| `NotificationItem` | Notification list row foundation | — |

## Alert / Banner severity

`neutral` | `info` | `success` | `warning` | `danger`

Do not paint every confirmation red. Destructive meaning belongs on **AlertDialog** primary actions with explicit verbs.

## Toast policy

- Pause on hover/focus; dismiss; optional action; reduced motion.
- Deterministic lab timing via provider; production consumers may keep `react-hot-toast` until UI-3 notification convergence.

## Sync visual states (input only)

`local` | `pending` | `syncing` | `synced` | `retry_scheduled` | `failed` | `conflict` | `action_required`
