/**
 * Scenario planning master — optional / not in primary nav (Wave G).
 * Soft-retired to Budget until a dedicated scenario engine ships.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

const ScenarioMaster: React.FC = () => {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("budget");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Budget…" />
    </div>
  );
};

export default ScenarioMaster;
