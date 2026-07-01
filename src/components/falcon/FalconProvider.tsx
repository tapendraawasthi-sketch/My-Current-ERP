// src/components/falcon/FalconProvider.tsx
import React, { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { useFalconStore } from "../../store/falconStore";
import FalconLauncher from "./FalconLauncher";
import FalconPanel from "./FalconPanel";

const FalconProvider: React.FC = () => {
  const { currentPage, isAuthenticated, isDbReady } = useStore();

  const setContext = useFalconStore((state) => state.setContext);

  useEffect(() => {
    setContext({
      route: currentPage,
      screenTitle: currentPage?.replace(/-/g, " "),
    });
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
