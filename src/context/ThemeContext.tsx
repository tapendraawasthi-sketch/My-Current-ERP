import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: ResolvedTheme;
  preference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  preference: "system",
  setThemePreference: () => {},
  toggleTheme: () => {},
});

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const stored = localStorage.getItem("orbix_theme_pref") || localStorage.getItem("sutra_theme");
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
      return "system";
    } catch {
      return "system";
    }
  });
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(mq.matches ? "dark" : "light");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const theme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    try {
      localStorage.setItem("orbix_theme_pref", preference);
      localStorage.setItem("sutra_theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.style.colorScheme = theme;
    } catch {
      /* ignore */
    }
  }, [preference, theme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      preference,
      setThemePreference: setPreference,
      toggleTheme: () =>
        setPreference((prev) => {
          const resolved = resolveTheme(prev === "system" ? systemTheme : prev);
          return resolved === "light" ? "dark" : "light";
        }),
    }),
    [preference, systemTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
