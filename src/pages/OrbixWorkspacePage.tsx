import React, { useEffect } from "react";
import { useEKhataStore } from "../store/eKhataStore";
import OrbixWorkspace from "../components/ekhata/OrbixWorkspace";

/** First-class Orbix workspace page inside the AppShell main area. */
const OrbixWorkspacePage: React.FC = () => {
  const openPanel = useEKhataStore((s) => s.openPanel);
  const maximizePanel = useEKhataStore((s) => s.maximizePanel);
  const minimizePanel = useEKhataStore((s) => s.minimizePanel);

  useEffect(() => {
    openPanel();
    maximizePanel();
    return () => {
      minimizePanel();
    };
  }, [maximizePanel, minimizePanel, openPanel]);

  return <OrbixWorkspace variant="page" />;
};

export default OrbixWorkspacePage;
