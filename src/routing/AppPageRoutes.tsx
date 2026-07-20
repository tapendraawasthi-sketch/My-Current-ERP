/**
 * Declarative <Route> entries for migrated pages + catch-all legacy outlet.
 * Content still follows Zustand `currentPage` (synced by PageUrlSync) so
 * setCurrentPage / sidebar / shortcuts keep working during the strangler.
 */
import React from "react";
import { Route, Routes } from "react-router-dom";
import { useStore } from "../store/useStore";
import { APP_BASE } from "./pagePaths";
import { DECLARATIVE_ROUTE_PAGE_IDS } from "./routeTable";
import { renderPage } from "./renderPage";

function StoreDrivenPage() {
  const currentPage = useStore((s) => s.currentPage);
  return <>{renderPage(currentPage)}</>;
}

export function AppPageRoutes() {
  return (
    <Routes>
      {DECLARATIVE_ROUTE_PAGE_IDS.map((pageId) => (
        <Route
          key={pageId}
          path={`${APP_BASE}/${pageId}/:entityId?`}
          element={<StoreDrivenPage />}
        />
      ))}
      <Route path={`${APP_BASE}/:pageId/:entityId?`} element={<StoreDrivenPage />} />
      <Route path="*" element={<StoreDrivenPage />} />
    </Routes>
  );
}

export default AppPageRoutes;
