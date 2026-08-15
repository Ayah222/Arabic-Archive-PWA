import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Lang = "ar" | "en";
interface LangCtx { lang: Lang; dir: "rtl" | "ltr"; toggle: () => void; }
const Ctx = createContext<LangCtx>({ lang: "ar", dir: "rtl", toggle: () => {} });

/** Clear every googtrans cookie variant so GT doesn't auto-translate on reload. */
function clearGTCookie() {
  const past = new Date(0).toUTCString();
  document.cookie = `googtrans=; path=/; expires=${past}`;
  document.cookie = `googtrans=; domain=${location.hostname}; path=/; expires=${past}`;
  document.cookie = `googtrans=; domain=.${location.hostname}; path=/; expires=${past}`;
}

/** Wait up to 8 s for GT to inject its hidden combo select. */
function waitForCombo(cb: (el: HTMLSelectElement) => void) {
  const start = Date.now();
  const id = setInterval(() => {
    const el = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
    if (el) { clearInterval(id); cb(el); }
    else if (Date.now() - start > 8000) clearInterval(id);
  }, 150);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Detect stale cookie so button label matches actual page state
  const [lang, setLang] = useState<Lang>(() =>
    document.cookie.includes("googtrans=/ar/en") ? "en" : "ar"
  );
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang, dir]);

  const toggle = useCallback(() => {
    if (lang === "ar") {
      // AR → EN : instant, no reload
      setLang("en");
      waitForCombo((combo) => {
        combo.value = "en";
        combo.dispatchEvent(new Event("change"));
      });
    } else {
      // EN → AR : clear cookie first so GT doesn't re-translate after reload
      clearGTCookie();
      window.location.reload();
    }
  }, [lang]);

  return <Ctx.Provider value={{ lang, dir, toggle }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
