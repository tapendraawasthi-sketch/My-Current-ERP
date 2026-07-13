import React, { useEffect, useMemo, useState } from "react";
import {
  FileText,
  LayoutDashboard,
  Moon,
  Package,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useGlobalSearch } from "../../hooks/useGlobalSearch";
import { useTheme } from "../../context/ThemeContext";
import { useEKhataStore } from "../../store/eKhataStore";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaletteRow =
  | { kind: "command"; id: string; label: string; hint?: string; run: () => void; icon: React.ReactNode }
  | { kind: "result"; id: string; label: string; meta: string; run: () => void; icon: React.ReactNode };

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const { setCurrentPage } = useStore();
  const { theme, setThemePreference } = useTheme();
  const openOrbix = useEKhataStore((s) => s.openPanel);
  const maximizeOrbix = useEKhataStore((s) => s.maximizePanel);
  const { results } = useGlobalSearch(query);

  const commands = useMemo<PaletteRow[]>(() => {
    const go = (page: string) => () => {
      setCurrentPage(page);
      onClose();
    };
    const rows: PaletteRow[] = [
      {
        kind: "command",
        id: "orbix",
        label: "Ask Orbix",
        hint: "Ctrl+Shift+K",
        icon: <Sparkles className="h-4 w-4" />,
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
        label: "New sale",
        icon: <TrendingUp className="h-4 w-4" />,
        run: go("billing"),
      },
      {
        kind: "command",
        id: "new-purchase",
        label: "New purchase",
        icon: <Receipt className="h-4 w-4" />,
        run: go("purchase"),
      },
      {
        kind: "command",
        id: "new-receipt",
        label: "New receipt",
        icon: <FileText className="h-4 w-4" />,
        run: go("receipt"),
      },
      {
        kind: "command",
        id: "new-payment",
        label: "New payment",
        icon: <FileText className="h-4 w-4" />,
        run: go("payment"),
      },
      {
        kind: "command",
        id: "balance-sheet",
        label: "Open Balance Sheet",
        icon: <LayoutDashboard className="h-4 w-4" />,
        run: go("balance-sheet"),
      },
      {
        kind: "command",
        id: "trial-balance",
        label: "Open Trial Balance",
        icon: <LayoutDashboard className="h-4 w-4" />,
        run: go("trial-balance"),
      },
      {
        kind: "command",
        id: "settings",
        label: "Open settings",
        icon: <Settings className="h-4 w-4" />,
        run: go("settings"),
      },
      {
        kind: "command",
        id: "theme-light",
        label: "Theme: Light",
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
        icon: theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />,
        run: () => {
          setThemePreference("system");
          onClose();
        },
      },
    ];

    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.label.toLowerCase().includes(q));
  }, [maximizeOrbix, onClose, openOrbix, query, setCurrentPage, setThemePreference, theme]);

  const searchRows = useMemo<PaletteRow[]>(() => {
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
        icon: iconFor("accounts"),
        run: () => {
          setCurrentPage("accounts");
          onClose();
        },
      });
    });
    return out.slice(0, 20);
  }, [onClose, query, results, setCurrentPage]);

  const rows = [...commands, ...searchRows];

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelected(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelected(0);
  }, [query, rows.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        rows[selected]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, rows, selected]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/40 px-4 pt-[12vh]">
      <button type="button" className="absolute inset-0" aria-label="Close palette" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-[var(--ox-radius-xl)] border border-[var(--ox-border)] bg-[var(--ox-surface-elevated)] shadow-[var(--ox-shadow-md)]"
      >
        <div className="flex h-12 items-center gap-2 border-b border-[var(--ox-border)] px-3">
          <Search className="h-4 w-4 text-[var(--ox-text-subtle)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts, vouchers, reports, parties, items…"
            className="h-full w-full border-0 bg-transparent text-[14px] text-[var(--ox-text)] outline-none placeholder:text-[var(--ox-text-subtle)]"
          />
          <kbd className="rounded border border-[var(--ox-border)] px-1.5 py-0.5 text-[10px] text-[var(--ox-text-subtle)]">
            Esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {rows.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--ox-text-muted)]">
              No matching commands or results
            </p>
          )}
          {rows.map((row, index) => (
            <button
              key={row.id}
              type="button"
              onClick={row.run}
              onMouseEnter={() => setSelected(index)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                index === selected ? "bg-[var(--ox-primary-soft)]" : "hover:bg-[var(--ox-surface-muted)]"
              }`}
            >
              <span className="text-[var(--ox-text-muted)]">{row.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[var(--ox-text)]">
                  {row.label}
                </span>
                {"meta" in row && row.meta && (
                  <span className="text-[11px] text-[var(--ox-text-subtle)]">{row.meta}</span>
                )}
              </span>
              {"hint" in row && row.hint && (
                <span className="text-[11px] text-[var(--ox-text-subtle)]">{row.hint}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
