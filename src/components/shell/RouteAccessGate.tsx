import React from "react";
import { Button, EmptyState } from "@/design-system";
import { useStore } from "../../store/useStore";
import { canNavigateToPage } from "./shellNavVisibility";

/** Soft permission surface for restricted deep links — does not invent ACL. */
export const RouteAccessGate: React.FC<{ page: string; children: React.ReactNode }> = ({
  page,
  children,
}) => {
  const role = useStore((s) => s.currentUser?.role);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  if (canNavigateToPage(page, role)) return <>{children}</>;
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6" data-testid="shell-route-denied">
      <EmptyState
        title="Access limited"
        description="Your role does not include this administration area. Contact an administrator if you need access."
        primaryAction={
          <Button variant="primary" onClick={() => setCurrentPage("dashboard")}>
            Go to Home
          </Button>
        }
      />
    </div>
  );
};

export default RouteAccessGate;
