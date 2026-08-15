/**
 * Google Translate language toggle.
 *
 * AR → EN : manipulates GT combo select — instant, no reload.
 * EN → AR : page reload — the only 100% reliable way to restore GT original.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Lang = "ar" | "en";

interface LangCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  toggle: () => void;
}

const Ctx = createContext<LangCtx>({ lang: "ar", dir: "rtl", toggle: () => {} });

/** Retry until the GT combo select is injected (up to ~8 s). */
function waitForCombo(cb: (el: HTMLSelectElement) => void) {
  const start = Date.now();
  const id = setInterval(() => {
    const el = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
    if (el) { clearInterval(id); cb(el); return; }
    if (Date.now() - start > 8000) clearInterval(id);
  }, 150);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang, dir]);

  const toggle = useCallback(() => {
    if (lang === "ar") {
      // ── Arabic → English : no reload ─────────────────────────────────
      setLang("en");
      waitForCombo((combo) => {
        combo.value = "en";
        combo.dispatchEvent(new Event("change"));
      });
    } else {
      // ── English → Arabic : reload (only guaranteed restore for GT) ───
      window.location.reload();
    }
  }, [lang]);

  return <Ctx.Provider value={{ lang, dir, toggle }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
