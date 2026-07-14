# Search, Filter, and Saved View Spec

**Phase:** UI-2.7  
**Import:** `@/design-system`

## SearchField

- Visible or `sr-only` label required (never placeholder-only).
- Search icon; clear control; optional shortcut hint; optional loading.
- Debounce is a consumer concern — hook may be added later; not forced here.
- Accepts Nepali / Romanised Nepali input; search intelligence is out of scope.

## FilterBar

Slots: search, filter controls, chips, clear-all, saved views.  
Responsive pattern: move dense filters into Drawer on narrow viewports (integration point).

## FilterChip

Readable label + value; remove control ≥36px; truncation with `title` / accessible name.

## DateRangeFilter

Start / end / open-ended; preset slot reserved for consumers; BS/AD calendars integrate at the page layer — no hard-coded fiscal period logic in the primitive.

## SavedView model

```ts
{
  id: string;
  name: string;
  owner: "user" | "company" | "system";
  filters: unknown;
  sort: unknown;
  columns: unknown;
  density?: Density;
  isDefault?: boolean;
}
```

Local / lab-only persistence is acceptable in UI-2. Do not hard-code business views (Unpaid, Overdue, etc.) into the primitive — those are future consumer configurations.
