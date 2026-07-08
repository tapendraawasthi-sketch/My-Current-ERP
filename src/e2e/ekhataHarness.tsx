import React, { Component, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { bootstrapEkhataHarness } from "./bootstrapHarness";
import "../styles.css";

class HarnessErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.error) {
      return (
        <div data-testid="ekhata-harness-error" className="p-4 text-red-700 text-[12px]">
          Panel render error: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

function EKhataHarnessPanel() {
  const [Launcher, setLauncher] = useState<React.ComponentType | null>(null);
  const [Panel, setPanel] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    void Promise.all([
      import("../components/ekhata/EKhataLauncher"),
      import("../components/ekhata/EKhataPanel"),
    ]).then(([launcherMod, panelMod]) => {
      setLauncher(() => launcherMod.default);
      setPanel(() => panelMod.default);
    });
  }, []);

  if (!Launcher || !Panel) {
    return <div className="p-4 text-gray-600 text-[12px]">Mounting e-Khata panel…</div>;
  }

  return (
    <>
      <Launcher />
      <Panel />
    </>
  );
}

function EKhataHarnessApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrapEkhataHarness()
      .then(() => {
        console.log("[ekhata-harness] setReady(true)");
        setReady(true);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (error) {
    return (
      <div data-testid="ekhata-harness-error" className="p-4 text-red-700 text-[12px]">
        Harness error: {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div data-testid="ekhata-harness-loading" className="p-4 text-gray-600 text-[12px]">
        Loading e-Khata harness…
      </div>
    );
  }

  return (
    <div data-testid="ekhata-harness-ready">
      <HarnessErrorBoundary>
        <EKhataHarnessPanel />
      </HarnessErrorBoundary>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Harness root element missing");
}

ReactDOM.createRoot(root).render(<EKhataHarnessApp />);
