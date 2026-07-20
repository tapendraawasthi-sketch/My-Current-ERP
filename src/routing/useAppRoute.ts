import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { pageIdToPath, parseAppPath, type AppRouteParts } from "./pagePaths";

const EMPTY: AppRouteParts = { pageId: "dashboard" };

/** Read current `/app/:page/:entity?` route parts. */
export function useAppRoute(): AppRouteParts {
  const location = useLocation();
  return useMemo(() => parseAppPath(location.pathname) ?? EMPTY, [location.pathname]);
}

/**
 * Navigate within the app while keeping Zustand `currentPage` in sync.
 * Prefer these helpers for entity deep-links so back/forward stay consistent.
 */
export function useNavigateApp() {
  const navigate = useNavigate();
  const setCurrentPage = useStore((s) => s.setCurrentPage);

  const go = useCallback(
    (pageId: string, entityId?: string | null, opts?: { replace?: boolean }) => {
      setCurrentPage(pageId);
      navigate(pageIdToPath(pageId, entityId), { replace: opts?.replace });
    },
    [navigate, setCurrentPage],
  );

  const openEntity = useCallback(
    (pageId: string, entityId: string, opts?: { replace?: boolean }) => {
      go(pageId, entityId, opts);
    },
    [go],
  );

  const clearEntity = useCallback(
    (pageId: string, opts?: { replace?: boolean }) => {
      go(pageId, null, { replace: opts?.replace ?? true });
    },
    [go],
  );

  return { go, openEntity, clearEntity };
}
