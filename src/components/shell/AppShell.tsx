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
import { usePermissionsStore } from "../../store/permissionsStore";
import { applyDensity, type Density } from "@/design-system";
import { PageContentFrame } from "./PageContentFrame";
import { RouteAccessGate } from "./RouteAccessGate";
import { NotificationCentre } from "./NotificationCentre";
import { MobileBottomNav } from "./MobileBottomNav";

interface AppShellProps {
  children: React.ReactNode;
}

const DENSITY_KEY = "orbix_shell_density";

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const currentPage = useStore((s) => s.currentPage);
  const currentUser = useStore((s) => s.currentUser);
  const isOrbixPage = currentPage === "orbix";
  const loadPermissions = usePermissionsStore((s) => s.loadPermissions);
  const clearPermissions = usePermissionsStore((s) => s.clearPermissions);

  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem("orbix_sidenav_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [density, setDensity] = useState<Density>(() => {
    try {
      const d = localStorage.getItem(DENSITY_KEY);
      if (d === "comfortable" || d === "productive" || d === "compact") return d;
    } catch {
      /* ignore */
    }
    return "productive";
  });

  useEffect(() => {
    try {
      localStorage.setItem("orbix_sidenav_collapsed", String(navCollapsed));
    } catch {
      /* ignore */
    }
  }, [navCollapsed]);

  useEffect(() => {
    const effective: Density = isMobile && density === "compact" ? "productive" : density;
    applyDensity(effective);
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* ignore */
    }
  }, [density, isMobile]);

  useEffect(() => {
    if (currentUser?.id && currentUser?.role) {
      void loadPermissions(String(currentUser.id), String(currentUser.role));
    } else {
      clearPermissions();
    }
  }, [currentUser?.id, currentUser?.role, loadPermissions, clearPermissions]);

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

  useEffect(() => {
    document.title = `Orbix ERP — ${currentPage}`;
  }, [currentPage]);

  return (
    <div
      className="ds-root flex h-screen flex-col overflow-hidden bg-[var(--ds-canvas)] text-[var(--ds-text-default)]"
      data-component="app-shell"
      data-shell-version="ui3"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[var(--ds-z-toast)] focus:rounded-[var(--ds-radius-md)] focus:bg-[var(--ds-surface-raised)] focus:px-3 focus:py-2 focus:text-[14px] focus:shadow-[var(--ds-shadow-2)]"
      >
        Skip to main content
      </a>
      <TopCommandBar
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleNav={() => setMobileNavOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
        density={density}
        onDensityChange={setDensity}
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
          className={`min-w-0 flex-1 bg-[var(--ds-canvas)] ${
            isOrbixPage
              ? "flex h-full min-h-0 flex-col overflow-hidden p-2 sm:p-3"
              : isMobile
                ? "overflow-y-auto p-3 pb-20"
                : "overflow-y-auto p-4 md:p-5"
          }`}
          id="app-main"
          aria-label="Main content"
        >
          <PageContentFrame page={currentPage}>
            <RouteAccessGate page={currentPage}>{children}</RouteAccessGate>
          </PageContentFrame>
        </main>
      </div>
      {isMobile ? <MobileBottomNav onOpenNotifications={() => setNotificationsOpen(true)} /> : null}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationCentre open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      {/* Internal providers retained off Orbix page; Orbix is the sole user-facing assistant identity on /orbix */}
      {!isOrbixPage ? <FalconProvider /> : null}
      <NiosProvider />
      <EKhataProvider />
      {isMobile && !isOrbixPage ? <SutraAiProvider /> : null}
    </div>
  );
};

export default AppShell;
