import { Link, useLocation } from "react-router-dom";
import { useNotifications } from "../../controllers/useNotifications";
import MicrophoneButton from "../components/shared/MicrophoneButton";
import { useState } from "react";
import Toast from "../components/shared/Toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const navItems = [
  { to: "/", label: "الرئيسية", icon: "🏠" },
  { to: "/projects", label: "المشاريع", icon: "📁" },
  { to: "/notifications", label: "الإشعارات", icon: "🔔" },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/" || location.pathname === BASE + "/";
    return location.pathname.startsWith(BASE + to) || location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Desktop Sidebar + Main Content */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 min-h-screen bg-sidebar text-sidebar-foreground border-l border-sidebar-border fixed top-0 right-0 z-30">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🗂️</span>
              <div>
                <h1 className="font-bold text-lg leading-tight">أرشيف ذكي</h1>
                <p className="text-xs opacity-70">إدارة المشاريع</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 ${
                  isActive(to)
                    ? "bg-white/20 font-semibold"
                    : "hover:bg-white/10"
                }`}
              >
                <span className="text-xl">{icon}</span>
                <span className="font-medium">{label}</span>
                {to === "/notifications" && unreadCount > 0 && (
                  <span className="mr-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Mic button */}
          <div className="p-6 border-t border-sidebar-border flex justify-center">
            <MicrophoneButton onResult={(msg) => setToast({ message: msg, type: "info" })} />
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 md:mr-64 flex flex-col min-h-screen">
          {/* Mobile header */}
          <header className="md:hidden sticky top-0 z-20 bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🗂️</span>
              <span className="font-bold">أرشيف ذكي</span>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Link to="/notifications" className="relative">
                  <span className="text-xl">🔔</span>
                  <span className="absolute -top-1 -left-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </Link>
              )}
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 pb-24 md:pb-0">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border tab-bar-safe shadow-2xl">
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          {navItems.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-150 relative ${
                isActive(to) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-medium">{label}</span>
              {to === "/notifications" && unreadCount > 0 && (
                <span className="absolute top-0.5 right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>
          ))}
          {/* Mobile Mic button */}
          <div className="flex flex-col items-center gap-0.5">
            <MicrophoneButton onResult={(msg) => setToast({ message: msg, type: "info" })} />
          </div>
        </div>
      </nav>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
