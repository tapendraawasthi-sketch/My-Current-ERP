// src/components/falcon/FalconProvider.tsx
import React, { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { useFalconStore } from "../../store/falconStore";
import FalconLauncher from "./FalconLauncher";
import FalconPanel from "./FalconPanel";

// Mount <FalconProvider /> once, near the root of your authenticated app
// shell (e.g. inside Layout.tsx, alongside <Toaster />). It automatically
// tracks the current ERP page so Falcon's answers are page-aware, and it
// hides itself on the login/signup screens.
const FalconProvider: React.FC = () => {
  const { currentPage, isAuthenticated, isDbReady } = useStore();
  const setContext = useFalconStore((s) => s.setContext);

  useEffect(() => {
    setContext({ route: currentPage });
  }, [currentPage, setContext]);

  if (!isAuthenticated || !isDbReady) return null;

  return (
    <>
      <FalconLauncher />
      <FalconPanel />
    </>
  );
};

export default FalconProvider;
