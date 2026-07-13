import React, { useEffect, useState } from "react";
import TopCommandBar from "./TopCommandBar";
import PrimarySideNav from "./PrimarySideNav";
import CommandPalette from "./CommandPalette";
import DataLoadWarningBanner from "../DataLoadWarningBanner";
import FalconProvider from "../falcon/FalconProvider";
import NiosProvider from "../nios/NiosProvider";
import EKhataProvider from "../ekhata/EKhataProvider";
import SutraAiProvider from "../sutra-ai/SutraAiProvider";
import { useIsMobile } from "../../hooks/use-mobile";
import { useStore } from "../../store/useStore";

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const currentPage = useStore((s) => s.currentPage);
  const isOrbixPage = currentPage === "orbix";
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem("orbix_sidenav_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("orbix_sidenav_collapsed", String(navCollapsed));
    } catch {
      /* ignore */
    }
  }, [navCollapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (e.target as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (!typing && e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setNavCollapsed(true);
    }
  }, []);

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[var(--ox-bg)] text-[var(--ox-text)]"
      data-component="app-shell"
    >
      <TopCommandBar
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleNav={() => setMobileNavOpen(true)}
        showMenuButton
      />
      <DataLoadWarningBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PrimarySideNav
          collapsed={navCollapsed}
          onCollapsedChange={setNavCollapsed}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <main
          className={`min-w-0 flex-1 bg-[var(--ox-bg)] ${
            isOrbixPage
              ? "overflow-hidden p-2 sm:p-3"
              : isMobile
                ? "overflow-y-auto p-3 pb-4"
                : "overflow-y-auto p-4 md:p-5"
          }`}
          id="app-main"
        >
          <div
            className={`page-enter w-full ${
              isOrbixPage ? "h-full max-w-none" : "mx-auto min-h-full max-w-[1600px]"
            }`}
          >
            {children}
          </div>
        </main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <FalconProvider />
      <NiosProvider />
      <EKhataProvider />
      {isMobile && <SutraAiProvider />}
    </div>
  );
};

export default AppShell;
