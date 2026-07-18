/**
 * Legacy Busy company picker — retired (Wave A / Function 22).
 * Auth uses GatewayScreen; this route only forwards users there.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";
import { PreWorkspaceShell } from "../components/auth/PreWorkspaceShell";

export default function CompanySelector() {
  const setAuthStage = useStore((s) => s.setAuthStage);
  const backToGateway = useStore((s) => s.backToGateway);

  useEffect(() => {
    if (typeof backToGateway === "function") {
      backToGateway();
      return;
    }
    setAuthStage?.("gateway");
  }, [backToGateway, setAuthStage]);

  return (
    <PreWorkspaceShell title="Choose a company" footerNote="Redirecting to company gateway…">
      <LoadingState label="Opening company gateway…" />
    </PreWorkspaceShell>
  );
}
