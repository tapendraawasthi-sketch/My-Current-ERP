import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import EKhataLauncher from "../components/ekhata/EKhataLauncher";
import EKhataPanel from "../components/ekhata/EKhataPanel";
import { bootstrapEkhataHarness } from "./bootstrapHarness";
import "../styles.css";

function EKhataHarnessApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrapEkhataHarness()
      .then(() => setReady(true))
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
      <EKhataLauncher />
      <EKhataPanel />
    </div>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Harness root element missing");
}

ReactDOM.createRoot(root).render(<EKhataHarnessApp />);
