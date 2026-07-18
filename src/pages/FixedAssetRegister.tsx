/**
 * Legacy localStorage fixed-asset UI — retired (Wave D / Function 16).
 * Canonical: FixedAssets.tsx via nav `fixed-assets`.
 */
import React, { useEffect } from "react";
import { useStore } from "../store/useStore";
import { LoadingState } from "@/design-system";

export default function FixedAssetRegister() {
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  useEffect(() => {
    setCurrentPage?.("fixed-assets");
  }, [setCurrentPage]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState label="Opening Fixed Assets…" />
    </div>
  );
}
