// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { ScreenProvider } from "./context/ScreenContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { F12Provider } from "./hooks/useF12Config";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <ScreenProvider>
            <F12Provider>
              <App />
            </F12Provider>
          </ScreenProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
