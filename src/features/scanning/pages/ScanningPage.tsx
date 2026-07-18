/**
 * scanning/pages/ScanningPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Routed page component for the Orbix AI Scanning workspace.
 * Mounted by App.tsx at the /scanning route.
 */

import React from "react";
import { ScannerShell } from "../components/ScannerShell";

const ScanningPage: React.FC = () => {
  return (
    <div className="p-6 h-full flex flex-col">
      <ScannerShell />
    </div>
  );
};

export default ScanningPage;
