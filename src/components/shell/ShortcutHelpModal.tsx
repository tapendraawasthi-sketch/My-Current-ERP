import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/design-system";
import { PAGE_SHORTCUT_HINTS } from "./shortcutHints";

type ShortcutRow = { keys: string; action: string };

const GROUPS: Array<{ title: string; rows: ShortcutRow[] }> = [
  {
    title: "Global",
    rows: [
      { keys: "Ctrl/⌘ K", action: "Open command palette" },
      { keys: "Ctrl/⌘ /", action: "Open command palette" },
      { keys: "/", action: "Open command palette (when not typing)" },
      { keys: "?", action: "Show this shortcut help" },
      { keys: "Esc", action: "Close dialog / panel" },
    ],
  },
  {
    title: "Reports",
    rows: [
      { keys: PAGE_SHORTCUT_HINTS["balance-sheet"], action: "Balance Sheet" },
      { keys: PAGE_SHORTCUT_HINTS["trial-balance"], action: "Trial Balance" },
      { keys: PAGE_SHORTCUT_HINTS.ledger, action: "General Ledger" },
      { keys: PAGE_SHORTCUT_HINTS["vat-reports"], action: "VAT Reports" },
      { keys: PAGE_SHORTCUT_HINTS.users, action: "Users & Roles" },
    ],
  },
  {
    title: "Navigation",
    rows: [
      { keys: "Browser Back", action: "Previous page / close entity" },
      { keys: "Browser Forward", action: "Next page in history" },
    ],
  },
];

export function ShortcutHelpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (typing) return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="medium" showClose>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Press ? anytime to toggle this panel.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ds-text-muted)] mb-2">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.rows.map((row) => (
                  <li
                    key={row.keys}
                    className="flex items-center justify-between gap-3 text-[13px]"
                  >
                    <span className="text-[var(--ds-text-default)]">{row.action}</span>
                    <kbd className="shrink-0 rounded-md border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] px-2 py-0.5 font-mono text-[11px] text-[var(--ds-text-muted)]">
                      {row.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default ShortcutHelpModal;
