/**
 * Google Translate–powered language toggle.
 * No manual translations needed — GT handles everything automatically.
 */
import { createContext, useContext, useState, useEffect } from "react";

export type Lang = "ar" | "en";

interface LangCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  toggle: () => void;
}

const Ctx = createContext<LangCtx>({ lang: "ar", dir: "rtl", toggle: () => {} });

function getCurrentLang(): Lang {
  // Google Translate sets a cookie like: googtrans=/ar/en
  return document.cookie.includes("googtrans=/ar/en") ? "en" : "ar";
}

function setGoogCookie(value: string) {
  document.cookie = `googtrans=${value}; path=/`;
  document.cookie = `googtrans=${value}; path=/; domain=.${location.hostname}`;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(getCurrentLang);
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  // Keep html dir in sync
  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang, dir]);

  const toggle = () => {
    if (lang === "ar") {
      // Translate to English
      setGoogCookie("/ar/en");
      window.location.reload();
    } else {
      // Restore to Arabic
      const past = new Date(0).toUTCString();
      document.cookie = `googtrans=; path=/; expires=${past}`;
      document.cookie = `googtrans=; path=/; domain=.${location.hostname}; expires=${past}`;
      window.location.reload();
    }
  };

  return <Ctx.Provider value={{ lang, dir, toggle }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
