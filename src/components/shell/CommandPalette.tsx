import React, { useEffect, useMemo, useState } from "react";
import {
  FileText,
  LayoutDashboard,
  Moon,
  Package,
  Receipt,
  Search,
  Settings,
  MessageSquare,
  Sun,
  TrendingUp,
  Users,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useGlobalSearch } from "../../hooks/useGlobalSearch";
import { useTheme } from "../../context/ThemeContext";
import { useEKhataStore } from "../../store/eKhataStore";
import { filterNavForRole, canNavigateToPage } from "./shellNavVisibility";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, page list is scoped to this SHELL_NAV group id (Phase D). */
  moduleId?: string;
}

type PaletteRow =
  | {
      kind: "command";
      id: string;
      label: string;
      hint?: string;
      category?: string;
      run: () => void;
      icon: React.ReactNode;
    }
  | { kind: "result"; id: string; label: string; meta: string; run: () => void; icon: React.ReactNode };

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, moduleId }) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const { setCurrentPage, currentUser } = useStore();
  const role = currentUser?.role;
  const { theme, setThemePreference } = useTheme();
  const openOrbix = useEKhataStore((s) => s.openPanel);
  const maximizeOrbix = useEKhataStore((s) => s.maximizePanel);
  const { results } = useGlobalSearch(query);

  const go = (page: string) => () => {
    if (!canNavigateToPage(page, role)) return;
    setCurrentPage(page);
    onClose();
  };

  const commands = useMemo<PaletteRow[]>(() => {
    const rows: PaletteRow[] = [
      {
        kind: "command",
        id: "orbix",
        label: "Ask Orbix",
        hint: "Ctrl+Shift+K",
        category: "Orbix",
        icon: <MessageSquare className="h-4 w-4" />,
        run: () => {
          setCurrentPage("orbix");
          openOrbix();
          maximizeOrbix();
          onClose();
        },
      },
      {
        kind: "command",
        id: "new-sale",
        label: "New Sales Invoice",
        category: "Actions",
        icon: <TrendingUp className="h-4 w-4" />,
        run: go("billing"),
      },
      {
        kind: "command",
        id: "new-purchase",
        label: "Record Purchase",
        category: "Actions",
        icon: <Receipt className="h-4 w-4" />,
        run: go("purchase"),
      },
      {
        kind: "command",
        id: "new-receipt",
        label: "Receive Money",
        category: "Actions",
        icon: <FileText className="h-4 w-4" />,
        run: go("receipt"),
      },
      {
        kind: "command",
        id: "new-payment",
        label: "Make Payment",
        category: "Actions",
        icon: <FileText className="h-4 w-4" />,
        run: go("payment"),
      },
      {
        kind: "command",
        id: "day-book",
        label: "Open Day Book",
        category: "Actions",
        icon: <LayoutDashboard className="h-4 w-4" />,
        run: go("day-book"),
      },
      {
        kind: "command",
        id: "trial-balance",
        label: "Run Trial Balance",
        category: "Reports",
        icon: <LayoutDashboard className="h-4 w-4" />,
        run: go("trial-balance"),
      },
      {
        kind: "command",
        id: "settings",
        label: "Open settings",
        category: "Pages",
        icon: <Settings className="h-4 w-4" />,
        run: go("settings"),
      },
      {
        kind: "command",
        id: "theme-light",
        label: "Theme: Light",
        category: "Actions",
        icon: <Sun className="h-4 w-4" />,
        run: () => {
          setThemePreference("light");
          onClose();
        },
      },
      {
        kind: "command",
        id: "theme-dark",
        label: "Theme: Dark",
        category: "Actions",
        icon: <Moon className="h-4 w-4" />,
        run: () => {
          setThemePreference("dark");
          onClose();
        },
      },
      {
        kind: "command",
        id: "theme-system",
        label: "Theme: System",
        category: "Actions",
        icon: theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />,
        run: () => {
          setThemePreference("system");
          onClose();
        },
      },
    ];

    const navGroups = filterNavForRole(role).filter((g) =>
      moduleId ? g.id === moduleId : true,
    );

    const pageRows: PaletteRow[] = navGroups
      .flatMap((g) =>
        (g.items.length
          ? g.items
          : g.page
            ? [{ id: g.id, label: g.label, page: g.page, icon: g.icon, orbix: g.orbix }]
            : []
        ).map((i) => ({ ...i, moduleLabel: g.label })),
      )
      .filter((i) => i.page !== "orbix")
      .map((i) => {
        const Icon = i.icon;
        return {
          kind: "command" as const,
          id: `nav-${i.id}`,
          label: i.label,
          category: moduleId ? i.moduleLabel || "Pages" : "Pages",
          icon: <Icon className="h-4 w-4" />,
          run: go(i.page),
        };
      });

    // Module-scoped open: show that module's pages first; skip global Actions noise.
    const merged = moduleId ? pageRows : [...rows, ...pageRows];
    const q = query.trim().toLowerCase();
    if (!q) return merged.slice(0, moduleId ? 48 : 24);
    return merged.filter((r) => r.label.toLowerCase().includes(q));
  }, [
    maximizeOrbix,
    moduleId,
    onClose,
    openOrbix,
    query,
    role,
    setCurrentPage,
    setThemePreference,
    theme,
  ]);

  const searchRows = useMemo<PaletteRow[]>(() => {
    if (moduleId) return [];
    if (query.trim().length < 2) return [];
    const iconFor = (cat: string) => {
      if (cat === "parties") return <Users className="h-4 w-4" />;
      if (cat === "items") return <Package className="h-4 w-4" />;
      if (cat === "page") return <LayoutDashboard className="h-4 w-4" />;
      return <Search className="h-4 w-4" />;
    };
    const out: PaletteRow[] = [];
    results.pages.forEach((p) => {
      const page = String(p.path || "")
        .replace(/^\//, "")
        .replace("chart-of-accounts", "accounts");
      if (!canNavigateToPage(page, role)) return;
      out.push({
        kind: "result",
        id: `page-${p.path}`,
        label: p.name || p.path,
        meta: "Page",
        icon: iconFor("page"),
        run: () => {
          setCurrentPage(page);
          onClose();
        },
      });
    });
    results.parties.forEach((p) => {
      out.push({
        kind: "result",
        id: `party-${p.id}`,
        label: p.name,
        meta: "Party",
        icon: iconFor("parties"),
        run: () => {
          setCurrentPage("parties");
          onClose();
        },
      });
    });
    results.items.forEach((i) => {
      out.push({
        kind: "result",
        id: `item-${i.id}`,
        label: i.name,
        meta: "Item",
        icon: iconFor("items"),
        run: () => {
          setCurrentPage("items");
          onClose();
        },
      });
    });
    results.accounts.forEach((a) => {
      out.push({
        kind: "result",
        id: `acc-${a.id}`,
        label: a.name,
        meta: "Account",
        icon: <FileText className="h-4 w-4" />,
        run: () => {
          setCurrentPage("accounts");
          onClose();
        },
      });
    });
    return out;
  }, [moduleId, onClose, query, results, role, setCurrentPage]);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: PaletteRow[] = [];
    for (const r of [...commands, ...searchRows]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out;
  }, [commands, searchRows]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelected(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Home") {
        e.preventDefault();
        setSelected(0);
      }
      if (e.key === "End") {
        e.preventDefault();
        setSelected(Math.max(0, rows.length - 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        rows[selected]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, rows, selected]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--ds-z-command-palette)] flex items-start justify-center bg-[color-mix(in_srgb,var(--ds-surface-inverse)_40%,transparent)] p-4 pt-[12vh] max-md:items-stretch max-md:p-0 max-md:pt-0"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      data-testid="shell-command-palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] shadow-[var(--ds-shadow-3)] max-md:h-full max-md:max-w-none max-md:rounded-none">
        <div className="flex items-center gap-2 border-b border-[var(--ds-border-subtle)] px-3 py-2">
          <Search className="h-4 w-4 text-[var(--ds-text-subtle)]" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              moduleId
                ? "Search menus in this module…"
                : "Search pages, actions, parties, accounts, items…"
            }
            className="ds-focus-ring h-10 w-full bg-transparent text-[14px] text-[var(--ds-text-default)] outline-none"
            aria-label="Command search"
            aria-controls="command-palette-results"
            data-palette-module={moduleId || "all"}
          />
          <span className="sr-only" aria-live="polite">
            {rows.length} results
          </span>
        </div>
        <ul
          id="command-palette-results"
          className="max-h-[min(60vh,420px)] overflow-y-auto p-2 max-md:max-h-none max-md:flex-1"
          role="listbox"
        >
          {!rows.length ? (
            <li className="px-3 py-6 text-center text-[13px] text-[var(--ds-text-muted)]">No matches</li>
          ) : (
            rows.map((r, idx) => (
              <li key={r.id} role="option" aria-selected={idx === selected}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-[var(--ds-radius-md)] px-3 py-2 text-left text-[14px] ${
                    idx === selected
                      ? "bg-[var(--ds-surface-selected)] text-[var(--ds-text-strong)]"
                      : "text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-hover)]"
                  }`}
                  onMouseEnter={() => setSelected(idx)}
                  onClick={() => r.run()}
                >
                  <span className="text-[var(--ds-text-muted)]">{r.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                  <span className="text-[12px] text-[var(--ds-text-muted)]">
                    {r.kind === "command" ? r.category || r.hint : r.meta}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-[var(--ds-border-subtle)] px-3 py-2 text-[12px] text-[var(--ds-text-muted)]">
          Actions open established workflows — they do not post or mutate accounting data from the palette.
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
