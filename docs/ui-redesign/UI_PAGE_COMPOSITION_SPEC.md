# Page Composition Spec

**Phase:** UI-2.6  
**Import:** `@/design-system`

## Hierarchy

```
PageHeader
  Breadcrumbs? → PageTitle + PageDescription + PageMeta + PageActions
  Tabs?
Toolbar / FilterBar
ContentWell / Section(+ SectionHeader)
DetailsPanel? (side context)
StickyActionBar? (unsaved / primary commit)
```

## PageHeader

- One title; concise description; optional status chip.
- Breadcrumbs only when hierarchy is real — never fake.
- **One** primary action; limited secondary; overflow for low-frequency.
- Destructive actions separated from primary.
- No coloured toolbar strip; no duplicate title card.
- Responsive wrapping; mobile collapses overflow actions.

## Breadcrumbs

Semantic `nav` + list; current page non-link; collapse on narrow screens.

## Tabs

Keyboard-accessible; selected state; lazy content option; URL integration point; overflow slot. Not a substitute for primary app navigation.

## Toolbar

Groups: filters, density, columns, export, actions. No icon-only action forest.

## StickyActionBar

Safe viewport + mobile bottom inset; unsaved indicator; primary + secondary; print-hidden (`ds-no-print`).

## Section / ContentWell / DetailsPanel

Structural only — no accounting logic. DetailsPanel is a foundation for row/document context (often paired with Drawer).
