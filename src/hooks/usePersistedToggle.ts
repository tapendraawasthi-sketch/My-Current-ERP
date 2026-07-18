import { useState } from "react";

/** Boolean UI toggle persisted in localStorage (TXN progressive disclosure, Home More, etc.). */
export function usePersistedToggle(key: string, defaultValue = false): [boolean, (open: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return raw === "true";
    } catch {
      return defaultValue;
    }
  });

  const set = (open: boolean) => {
    setValue(open);
    try {
      localStorage.setItem(key, String(open));
    } catch {
      /* ignore quota / private mode */
    }
  };

  return [value, set];
}
