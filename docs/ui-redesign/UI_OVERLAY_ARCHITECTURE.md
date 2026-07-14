# Overlay Architecture

**Phase:** UI-2.2  
**Implementation:** Radix Dialog / AlertDialog / Popover / DropdownMenu + vaul Drawer  
**Z-index:** Phase UI-1 `--ds-z-*` tokens only

## Portal policy

All overlays portal to `document.body` via Radix/vaul portals. Feature code must not create ad-hoc `fixed` overlays with arbitrary `z-index`.

| Layer | Token | Components |
|-------|-------|------------|
| dropdown | `--ds-z-dropdown` | Select, DropdownMenu |
| popover | `--ds-z-popover` | Popover, Tooltip |
| drawer | `--ds-z-drawer` | Drawer/Sheet |
| modal | `--ds-z-modal` | Dialog, AlertDialog |
| toast | `--ds-z-toast` | Toast viewport |
| command palette | `--ds-z-command-palette` | Reserved UI-3 |

## Focus

- Dialog / AlertDialog / Drawer: focus trap + restore to trigger
- Menu / Popover: Radix focus management
- Escape closes topmost overlay first
- Outside pointer: configurable on Dialog (`onInteractOutside`); AlertDialog typically prevents dismiss on outside for destructive flows

## Scroll lock

Radix Dialog / AlertDialog / vaul Drawer lock body scroll while open.

## Nested overlay policy

| Outer | Inner | Allowed |
|-------|-------|---------|
| Dialog | Select / Popover / Tooltip / DropdownMenu | Yes |
| Dialog | AlertDialog (confirm) | Yes — confirm above |
| Drawer | Select / Menu / Popover | Yes |
| Drawer | Dialog | Prefer AlertDialog for confirmations |
| Popover | Dialog | No — elevate to Dialog |
| Nested Dialog as ordinary pattern | — | **Avoid** |

Command Palette (UI-3) sits at command-palette z-index above toasts only when explicitly opened.

## Mobile

- Dialog → full-screen sheet class on narrow viewports
- Drawer → full height / bottom sheet via vaul
- Print: overlays `display:none` via `.ds-no-print` / print foundations

## Reduced motion

Use `--ds-duration-*`; respect `prefers-reduced-motion`.
