# UI-6 — Conversation Presentation Spec

**Surface:** `OrbixWorkspace` message stream + composer  
**Authority:** `message.orbixResponse` (schema 1.0); `display.text` is presentation only  
**Renderer:** `OrbixResponseRenderer` — switch on `response_type`, not assistant prose

## Principles

1. Structured types drive chrome (success/danger/restriction cards); prose fills copy.
2. Never present Ask Mode answers as confirmed postings.
3. Never label local post as remotely synced without `sync_status` (or shell sync authority).
4. Heuristic classification (`classifyAssistantTextHeuristic`) is **deprecated fallback** only when `orbixResponse` is missing.
5. Tokens: present with `--ox-*`; target migration to `--ds-*` / design-system feedback primitives without changing meaning.

## Message roles

| Role | Presentation |
|------|----------------|
| User | Right-aligned / distinct user bubble; plain text |
| Assistant | Left-aligned; typed body via renderer |
| System / progress | Posting stages / NeuronThinking — not voucher truth |

## Response presentation matrix

| `response_type` | Visual intent | Notes |
|-----------------|---------------|-------|
| `normal_answer`, `capability_answer`, `accounting_explanation`, `erp_data_result` | Neutral surface | `OrbixMessageContent` |
| `report_result`, `report_updated` | Neutral + report table from parent | Show `changes[]` on updated |
| `mode_restriction` | Info / gate card | Switch to Accountant CTA |
| `clarification_required` | Clarification card | `nothing_posted` honesty |
| `transaction_preview`, `confirmation_required`, `journal_preview` | Pending strip owns actions | Renderer may show display text only |
| `posting_progress` | Progress / stage | Not success |
| `posting_completed` | Success — **Posted locally** | Sync line separate; forward `sync_status` |
| `posting_failed`, `permission_denied`, `validation_error`, `general_error` | Danger | Prefer `safe_message` |
| `provider_offline`, `backend_unavailable` | Offline card | Retryable honesty |
| `unknown` / null | Fallback text | Error boundary keeps original text |

## Mode-aware starters

| Mode | Starters tone |
|------|----------------|
| Ask | Reports, comparisons, explanations (read-only) |
| Accountant | Record / create / payment intents (still require confirm) |

Composer must not imply Ask can post.

## Pending confirmation (conversation-adjacent)

- Confirm / Cancel live with `pendingCard` / compound batch — authoritative preview UX (see preview specs).
- After success, clear pending; append `posting_completed`.
- On `stale_preview` or mode/permission denial, retain pending card for recovery (current store behaviour).

## Sync line copy (posting_completed)

| `sync_status` | Label |
|---------------|-------|
| `synced` | Synced |
| `disabled` | Local-only company |
| `failed` | Sync failed — local records are safe |
| `conflict` | Conflict detected — review required |
| omitted / pending / offline heuristics | Waiting to sync / Offline — will sync later |

**UI-6 fix target:** stop omitting `sync_status` in `confirmPending` message builders when the posting result provides it.

## Identity

- Conversation brand is **Orbix**.
- Falcon and Sutra are parallel product/assistant identities — do not rebrand the stream as Falcon in this phase.

## Error boundary

Renderer error boundary: show safe “couldn’t display structured details” + original message text. Never invent a voucher number in the fallback.
