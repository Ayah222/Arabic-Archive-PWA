import { createContext, useContext, useState, useEffect } from "react";

export type Lang = "ar" | "en";

const translations = {
  ar: {
    // Nav
    dashboard: "لوحة التحكم",
    projects: "المشاريع",
    contracts: "العقود",
    contractors: "المقاولون",
    meetings: "الاجتماعات",
    letters: "الخطابات والمراسلات",
    finance: "الأرشيف المالي",
    search: "البحث الموحد",
    notifications: "الإشعارات",
    reports: "التقارير",
    faq: "الأسئلة الشائعة",
    users: "المستخدمون",
    system: "النظام",
    // Header
    alerts: "التنبيهات",
    showAll: "إظهار جميع الإشعارات",
    markAllRead: "تحديد الكل",
    noNotifications: "لا توجد إشعارات",
    addNew: "إضافة جديد",
    logout: "خروج",
    // Sidebar
    appName: "أرشيف ذكي",
    appSub: "إدارة المشاريع",
  },
  en: {
    // Nav
    dashboard: "Dashboard",
    projects: "Projects",
    contracts: "Contracts",
    contractors: "Contractors",
    meetings: "Meetings",
    letters: "Letters & Correspondence",
    finance: "Financial Archive",
    search: "Unified Search",
    notifications: "Notifications",
    reports: "Reports",
    faq: "FAQ",
    users: "Users",
    system: "System",
    // Header
    alerts: "Notifications",
    showAll: "Show all notifications",
    markAllRead: "Mark all read",
    noNotifications: "No notifications",
    addNew: "Add new",
    logout: "Logout",
    // Sidebar
    appName: "Smart Archive",
    appSub: "Project Management",
  },
} as const;

type Keys = keyof typeof translations.ar;

interface LangCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (k: Keys) => string;
  toggle: () => void;
}

const Ctx = createContext<LangCtx>({
  lang: "ar", dir: "rtl",
  t: (k) => translations.ar[k],
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() =>
    (sessionStorage.getItem("lang") as Lang) ?? "ar"
  );

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    sessionStorage.setItem("lang", lang);
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang, dir]);

  const toggle = () => setLang(l => l === "ar" ? "en" : "ar");
  const t = (k: Keys) => translations[lang][k];

  return <Ctx.Provider value={{ lang, dir, t, toggle }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
