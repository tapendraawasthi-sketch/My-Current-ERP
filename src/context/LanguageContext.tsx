import React, { createContext, useContext, useState } from "react";

type Language = "en" | "ne" | "bilingual";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  t_array: (items: Array<{ en: string; ne: string }>) => string[];
}

const translations: Record<string, Record<Language, string>> = {
  dashboard: { en: "Dashboard", ne: "ड्यासबोर्ड", bilingual: "Dashboard / ड्यासबोर्ड" },
  accounts: { en: "Accounts", ne: "खाताहरू", bilingual: "Accounts / खाताहरू" },
  vouchers: { en: "Vouchers", ne: "भौचरहरू", bilingual: "Vouchers / भौचरहरू" },
  reports: { en: "Reports", ne: "प्रतिवेदनहरू", bilingual: "Reports / प्रतिवेदनहरू" },
  settings: { en: "Settings", ne: "सेटिङहरू", bilingual: "Settings / सेटिङहरू" },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  const t_array = (items: Array<{ en: string; ne: string }>): string[] => {
    return items.map((item) => {
      if (language === "bilingual") {
        return `${item.en} / ${item.ne}`;
      }
      return language === "en" ? item.en : item.ne;
    });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, t_array }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
