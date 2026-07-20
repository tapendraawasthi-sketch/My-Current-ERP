import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { pageIdToPath, parseAppPath } from "./pagePaths";

/**
 * Bidirectional sync between Zustand `currentPage` and the browser URL.
 * Preserves entity segments (`/app/billing/:id`) when only the page id changes via store.
 */
export function PageUrlSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const authStage = useStore((s) => s.authStage);
  const currentPage = useStore((s) => s.currentPage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const applyingUrl = useRef(false);
  const bootstrapped = useRef(false);

  // URL → store (deep link / back / forward)
  useEffect(() => {
    if (authStage !== "authenticated") return;
    const parsed = parseAppPath(location.pathname);
    if (!parsed?.pageId) return;
    const storePage = useStore.getState().currentPage;
    if (parsed.pageId === storePage) return;
    applyingUrl.current = true;
    setCurrentPage(parsed.pageId);
    queueMicrotask(() => {
      applyingUrl.current = false;
    });
  }, [authStage, location.pathname, setCurrentPage]);

  // Store → URL (sidebar, palette, shortcuts)
  // Keep existing entityId when navigating between pages only if path already matches page.
  useEffect(() => {
    if (authStage !== "authenticated") return;
    if (applyingUrl.current) return;
    if (!currentPage) return;

    const parsed = parseAppPath(location.pathname);
    if (parsed?.pageId === currentPage) {
      bootstrapped.current = true;
      return;
    }

    // Leaving a page clears entity unless caller already navigated via useNavigateApp
    const next = pageIdToPath(currentPage);
    const replace = !bootstrapped.current || !parsed?.pageId;
    bootstrapped.current = true;
    navigate(next, { replace });
  }, [authStage, currentPage, navigate, location.pathname]);

  return null;
}

export default PageUrlSync;
