/**
 * Page registry — fully declarative (STEP 4.3 complete).
 * Unknown pageIds fall back to the financial dashboard (legacy switch behaviour).
 */
import React from "react";
import { renderDeclarativePage } from "./routeTable";
import FinancialDashboard from "../pages/FinancialDashboard";

export function renderPage(currentPage: string): React.ReactNode {
  return renderDeclarativePage(currentPage) ?? <FinancialDashboard />;
}
