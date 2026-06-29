/**
 * Backend API endpoints referenced by Top Menu Bar:
 *
 * POST /api/companies
 * GET  /api/companies
 * PUT  /api/companies/:id
 * PUT  /api/companies/:id/features
 * POST /api/auth/switch-user
 * POST /api/data/backup
 * GET  /api/data/backup/status
 * POST /api/data/restore
 * POST /api/data/migrate
 * POST /api/data/split
 * POST /api/data/repair
 * POST /api/exchange/sync
 * POST /api/import/masters
 * POST /api/import/transactions
 * POST /api/import/bank-statement
 * POST /api/import/payroll
 * GET  /api/export/masters
 * GET  /api/export/transactions
 * GET  /api/reports/[report-name]/export
 * POST /api/share/email
 * POST /api/share/link
 * PUT  /api/settings/security
 * PUT  /api/settings/email
 * PUT  /api/settings/general
 * PUT  /api/settings/connectivity
 * POST /api/support/ticket
 * POST /api/admin/check-integrity
 * POST /api/admin/rebuild-indexes
 * POST /api/admin/clear-cache
 * GET  /api/admin/logs
 * POST /api/admin/diagnostics
 * POST /api/license/sync
 */

import React, { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/store/useStore";
import { TopbarMenuKey, useTopbarStore } from "@/store/topbarStore";
import CompanyMenu from "./CompanyMenu";
import DataMenu from "./DataMenu";
import ExchangeMenu from "./ExchangeMenu";
import ImportMenu from "./ImportMenu";
import ExportMenu from "./ExportMenu";
import ShareMenu from "./ShareMenu";
import PrintMenu from "./PrintMenu";
import HelpMenu from "./HelpMenu";
import GoToPanel from "./GoToPanel";
import SwitchToPanel from "./SwitchToPanel";

interface MenuButtonDef {
  key: TopbarMenuKey;
  label: string;
  shortcut: string;
}

const menuButtons: MenuButtonDef[] = [
  { key: "company", label: "Company", shortcut: "Alt+K" },
  { key: "data", label: "Data", shortcut: "Alt+Y" },
  { key: "exchange", label: "Exchange", shortcut: "Alt+Z" },
  { key: "import", label: "Import", shortcut: "Alt+O" },
  { key: "export", label: "Export", shortcut: "Alt+E" },
  { key: "share", label: "Share", shortcut: "Alt+M" },
  { key: "print", label: "Print", shortcut: "Alt+P" },
  { key: "help", label: "Help", shortcut: "F1" },
];

export default function TopMenuBar() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const currentUser = useStore((state) => state.currentUser);
  const companySettings = useStore((state) => state.companySettings);
  const currentFiscalYear = useStore((state) => state.currentFiscalYear);

  const {
    openMenu,
    goToOpen,
    switchToOpen,
    activeCompany,
    setOpenMenu,
    setGoToOpen,
    setSwitchToOpen,
    setCurrentUser,
  } = useTopbarStore();

  useEffect(() => {
    if (!currentUser) {
      setCurrentUser(null);
      return;
    }

    setCurrentUser({
      id: String(currentUser.id || ""),
      username: String(currentUser.username || currentUser.name || "User"),
      role: String(currentUser.role || "user"),
      permissions: {},
    });
  }, [currentUser, setCurrentUser]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [setOpenMenu]);

  useEffect(() => {
    const openCompanyAction = (detail: string) => {
      window.dispatchEvent(new CustomEvent("topbar:company-action", { detail }));
      setOpenMenu("company");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        setOpenMenu(null);
        setGoToOpen(false);
        setSwitchToOpen(false);
        return;
      }

      if (event.key === "F1") {
        event.preventDefault();
        setOpenMenu(openMenu === "help" ? null : "help");
        return;
      }

      if (event.key === "F3" && !event.ctrlKey) {
        event.preventDefault();
        openCompanyAction("select");
        return;
      }

      if (event.key === "F3" && event.ctrlKey) {
        event.preventDefault();
        openCompanyAction("shut");
        return;
      }

      if (event.key === "F11") {
        event.preventDefault();
        openCompanyAction("features");
        return;
      }

      if (event.altKey && key === "g") {
        event.preventDefault();
        setGoToOpen(true);
        setOpenMenu(null);
        return;
      }

      if (event.ctrlKey && key === "g") {
        event.preventDefault();
        setSwitchToOpen(true);
        setOpenMenu(null);
        return;
      }

      const altMap: Record<string, TopbarMenuKey> = {
        k: "company",
        y: "data",
        z: "exchange",
        o: "import",
        e: "export",
        m: "share",
        p: "print",
      };

      if (event.altKey && altMap[key]) {
        event.preventDefault();
        setOpenMenu(openMenu === altMap[key] ? null : altMap[key]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openMenu, setGoToOpen, setOpenMenu, setSwitchToOpen]);

  const companyName = useMemo(() => {
    const name =
      activeCompany?.name || companySettings?.companyNameEn || companySettings?.name || "Sutra ERP";

    return name.length > 20 ? `${name.slice(0, 20)}…` : name;
  }, [activeCompany?.name, companySettings?.companyNameEn, companySettings?.name]);

  const fiscalYearLabel =
    activeCompany?.fiscalYear ||
    currentFiscalYear?.name ||
    currentFiscalYear?.fiscalYearBS ||
    "FY —";

  const username = currentUser?.username || currentUser?.name || "User";

  const renderMenu = () => {
    if (!openMenu) return null;

    if (openMenu === "company") return <CompanyMenu />;
    if (openMenu === "data") return <DataMenu />;
    if (openMenu === "exchange") return <ExchangeMenu />;
    if (openMenu === "import") return <ImportMenu />;
    if (openMenu === "export") return <ExportMenu />;
    if (openMenu === "share") return <ShareMenu />;
    if (openMenu === "print") return <PrintMenu />;
    if (openMenu === "help") return <HelpMenu />;

    return null;
  };

  return (
    <>
      <div ref={wrapperRef} className="top-menu-bar">
        <div className="flex h-full items-center">
          {menuButtons.map((item) => (
            <div key={item.key} className="relative h-full">
              <button
                type="button"
                className={`top-menu-btn ${openMenu === item.key ? "active" : ""}`}
                onClick={() => setOpenMenu(openMenu === item.key ? null : item.key)}
              >
                <span>{item.label}</span>
                <span className="top-menu-shortcut">{item.shortcut}</span>
              </button>

              {openMenu === item.key && renderMenu()}
            </div>
          ))}
        </div>

        <div className="ml-auto flex h-full items-center gap-3 px-3 text-[11px] text-gray-300">
          <button
            type="button"
            className={`top-menu-btn ${goToOpen ? "active" : ""}`}
            onClick={() => {
              setGoToOpen(true);
              setOpenMenu(null);
            }}
          >
            Go To <span className="top-menu-shortcut">Alt+G</span>
          </button>

          <button
            type="button"
            className={`top-menu-btn ${switchToOpen ? "active" : ""}`}
            onClick={() => {
              setSwitchToOpen(true);
              setOpenMenu(null);
            }}
          >
            Switch To <span className="top-menu-shortcut">Ctrl+G</span>
          </button>

          <div className="hidden items-center gap-2 border-l border-[#2d3748] pl-3 md:flex">
            <span className="max-w-[160px] truncate font-medium text-white">{companyName}</span>
            <span className="text-gray-500">|</span>
            <span>{fiscalYearLabel}</span>
            <span className="text-gray-500">|</span>
            <span>{username}</span>
          </div>
        </div>
      </div>

      {goToOpen && <GoToPanel onClose={() => setGoToOpen(false)} />}
      {switchToOpen && <SwitchToPanel onClose={() => setSwitchToOpen(false)} />}
    </>
  );
}
