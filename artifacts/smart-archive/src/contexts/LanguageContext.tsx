import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Lang = "ar" | "en";

const T = {
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
    // App shell
    appName: "أرشيف ذكي",
    appSub: "نظام إدارة الأرشيف",
    system: "النظام",
    // Notifications panel
    alerts: "الإشعارات",
    markAllRead: "تحديد الكل مقروء",
    noNotifications: "لا توجد إشعارات",
    showAll: "عرض الكل",
    // Login
    welcome: "مرحباً بك",
    smartSystem: "نظام الأرشيف الذكي",
    loginTitle: "تسجيل الدخول",
    employee: "موظف",
    admin: "إداري",
    adminUsername: "اسم المستخدم",
    adminPassword: "كلمة المرور",
    emailField: "البريد الإلكتروني",
    passwordField: "كلمة المرور",
    loginBtn: "تسجيل الدخول",
    loggingIn: "جاري الدخول...",
    fillFields: "يرجى ملء جميع الحقول",
    errorOccurred: "حدث خطأ، يرجى المحاولة مجدداً",
    quickAdd: "إضافة جديد",
    logout: "خروج",
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
    // App shell
    appName: "Smart Archive",
    appSub: "Archive Management System",
    system: "System",
    // Notifications panel
    alerts: "Notifications",
    markAllRead: "Mark all as read",
    noNotifications: "No notifications",
    showAll: "View all",
    // Login
    welcome: "Welcome",
    smartSystem: "Smart Archive System",
    loginTitle: "Sign In",
    employee: "Employee",
    admin: "Admin",
    adminUsername: "Username",
    adminPassword: "Password",
    emailField: "Email / Username",
    passwordField: "Password",
    loginBtn: "Sign In",
    loggingIn: "Signing in…",
    fillFields: "Please fill all fields",
    errorOccurred: "An error occurred, please try again",
    quickAdd: "Add new",
    logout: "Logout",
  },
} as const;

export type TKey = keyof typeof T.ar;

interface LangCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (k: TKey) => string;
  toggle: () => void;
}

const Ctx = createContext<LangCtx>({
  lang: "ar", dir: "rtl",
  t: (k) => T.ar[k],
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  // Keep <html> dir + lang in sync instantly
  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang, dir]);

  const t = useCallback((k: TKey): string => T[lang][k], [lang]);

  const toggle = useCallback(() => {
    setLang(l => l === "ar" ? "en" : "ar");
  }, []);

  return <Ctx.Provider value={{ lang, dir, t, toggle }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
