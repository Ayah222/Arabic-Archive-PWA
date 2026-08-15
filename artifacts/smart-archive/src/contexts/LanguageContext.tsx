/**
 * Google Translate–powered language toggle — no page reload.
 *
 * AR → EN : sets the hidden GT combo select to 'en' and fires 'change'.
 * EN → AR : sets the combo back to '' (blank = show original) and fires 'change'.
 *
 * dir (rtl/ltr) is applied immediately; GT translates the text asynchronously.
 */
import { createContext, useContext, useState, useEffect } from "react";

export type Lang = "ar" | "en";

interface LangCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  toggle: () => void;
}

const Ctx = createContext<LangCtx>({ lang: "ar", dir: "rtl", toggle: () => {} });

/** Wait up to 8 s for Google Translate to inject its hidden combo select. */
function waitForCombo(cb: (el: HTMLSelectElement) => void) {
  const start = Date.now();
  const id = setInterval(() => {
    const el = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
    if (el) { clearInterval(id); cb(el); return; }
    if (Date.now() - start > 8000) clearInterval(id);
  }, 120);
}

/** Fire a real 'change' event so Google Translate picks it up. */
function triggerChange(el: HTMLSelectElement) {
  el.dispatchEvent(new Event("change"));
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  // Keep <html> dir in sync instantly (layout flips before GT finishes translating)
  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang, dir]);

  const toggle = () => {
    if (lang === "ar") {
      // ── Translate to English ──────────────────────────────────────────────
      setLang("en");
      waitForCombo((combo) => {
        combo.value = "en";
        triggerChange(combo);
      });
    } else {
      // ── Restore to Arabic (original) ─────────────────────────────────────
      // Setting value to '' and firing 'change' tells GT to show the original.
      setLang("ar");
      waitForCombo((combo) => {
        combo.value = "";
        triggerChange(combo);
        // GT sometimes needs a second nudge after clearing
        setTimeout(() => {
          combo.selectedIndex = 0;
          triggerChange(combo);
        }, 80);
      });
    }
  };

  return <Ctx.Provider value={{ lang, dir, toggle }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
