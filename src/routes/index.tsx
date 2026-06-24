import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const App = lazy(() => import("../App"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accounting System" },
      {
        name: "description",
        content: "Nepali double-entry accounting, inventory, invoicing and GST/VAT reports.",
      },
    ],
  }),
  component: ClientApp,
});

function ClientApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#C5E1A5" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #4A7A30", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}
