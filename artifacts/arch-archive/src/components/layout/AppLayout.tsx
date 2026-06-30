import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { useAppContext } from "../../context/AppContext";
import { useNotifications, NOTIF_COLORS } from "../../context/NotificationsContext";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Menu,
  Moon,
  Sun,
  LogOut,
  X,
  LayoutGrid,
  HardHat,
  Mail,
  CalendarCheck,
  Users,
  Bell,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCheck,
  FileSignature,
  Search,
} from "lucide-react";
import { Button } from "../ui/button";

/* ── Aurora — Dark: stronger cyan + purple + pink ── */
const DarkAurora = () => (
  <div
    className="fixed inset-0 overflow-hidden pointer-events-none"
    style={{ zIndex: 0 }}
  >
    <div
      style={{
        position: "absolute",
        width: 900,
        height: 750,
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse, rgba(0,240,255,0.18) 0%, rgba(0,240,255,0.06) 40%, transparent 70%)",
        filter: "blur(90px)",
        top: -320,
        right: -120,
      }}
    />
    <div
      style={{
        position: "absolute",
        width: 750,
        height: 600,
        background:
          "radial-gradient(ellipse, rgba(112,0,255,0.20) 0%, rgba(112,0,255,0.06) 45%, transparent 72%)",
        filter: "blur(110px)",
        top: -80,
        left: "12%",
      }}
    />
    <div
      style={{
        position: "absolute",
        width: 620,
        height: 520,
        background:
          "radial-gradient(ellipse, rgba(255,0,128,0.14) 0%, rgba(112,0,255,0.04) 50%, transparent 74%)",
        filter: "blur(100px)",
        bottom: -200,
        left: -60,
      }}
    />
    <div
      style={{
        position: "absolute",
        width: 400,
        height: 320,
        background:
          "radial-gradient(ellipse, rgba(0,240,255,0.09) 0%, transparent 70%)",
        filter: "blur(80px)",
        top: "48%",
        right: "5%",
      }}
    />
  </div>
);

/* ── Aurora — Light: vibrant pastel ── */
const LightAurora = () => (
  <div
    className="fixed inset-0 overflow-hidden pointer-events-none"
    style={{ zIndex: 0 }}
  >
    <div
      style={{
        position: "absolute",
        width: 900,
        height: 700,
        background:
          "radial-gradient(ellipse, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.04) 50%, transparent 72%)",
        filter: "blur(80px)",
        top: -200,
        right: -100,
      }}
    />
    <div
      style={{
        position: "absolute",
        width: 700,
        height: 550,
        background:
          "radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, rgba(168,85,247,0.03) 55%, transparent 74%)",
        filter: "blur(90px)",
        top: -100,
        left: "20%",
      }}
    />
    <div
      style={{
        position: "absolute",
        width: 600,
        height: 450,
        background:
          "radial-gradient(ellipse, rgba(6,182,212,0.10) 0%, transparent 70%)",
        filter: "blur(100px)",
        bottom: -140,
        left: -60,
      }}
    />
    <div
      style={{
        position: "absolute",
        width: 500,
        height: 380,
        background:
          "radial-gradient(ellipse, rgba(236,72,153,0.09) 0%, transparent 72%)",
        filter: "blur(90px)",
        bottom: -60,
        right: -40,
      }}
    />
  </div>
);

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { theme, toggleTheme, logout, userType } = useAppContext();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellRect, setBellRect] = useState<DOMRect | null>(null);
  const bellRef        = useRef<HTMLDivElement>(null);
  const bellButtonRef  = useRef<HTMLButtonElement>(null);
  const dropdownRef    = useRef<HTMLDivElement>(null);

  const handleBellClick = () => {
    if (!bellOpen && bellButtonRef.current) {
      setBellRect(bellButtonRef.current.getBoundingClientRect());
    }
    setBellOpen(prev => !prev);
  };

  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setBellOpen(false);
        return;
      }
      const t = e.target as Node;
      const insideBell     = bellRef.current?.contains(t);
      const insideDropdown = dropdownRef.current?.contains(t);
      if (!insideBell && !insideDropdown) setBellOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [bellOpen]);

  const navItems = [
    { path: "/dashboard",       label: "لوحة التحكم",           icon: LayoutDashboard },
    { path: "/projects",        label: "المشاريع",              icon: FolderOpen       },
    { path: "/contracts",       label: "العقود",                icon: FileSignature    },
    { path: "/documents",       label: "المستندات",             icon: FileText         },
    { path: "/contractors",     label: "المقاولون",             icon: HardHat          },
    { path: "/correspondence",  label: "الخطابات والمراسلات",   icon: Mail             },
    { path: "/meetings",        label: "الاجتماعات",            icon: CalendarCheck    },
    { path: "/search",          label: "البحث الموحد",          icon: Search           },
    { path: "/users",           label: "المستخدمون",            icon: Users            },
  ];

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };
  const isDark = theme === "dark";

  /* ─── Active nav: neon framed pill (matches reference) ─── */
  const activeStyle: React.CSSProperties = isDark
    ? {
        background: "rgba(0,240,255,0.06)",
        border: "1px solid rgba(0,240,255,0.70)",
        boxShadow:
          "0 0 0 1px rgba(0,240,255,0.12), 0 0 20px rgba(0,240,255,0.28), inset 0 1px 1px rgba(0,240,255,0.10)",
        color: "#00f0ff",
      }
    : {
        background: "rgba(99,102,241,0.10)",
        border: "1px solid rgba(99,102,241,0.55)",
        boxShadow:
          "0 0 0 1px rgba(99,102,241,0.12), 0 4px 16px rgba(99,102,241,0.22), inset 0 1px 2px rgba(255,255,255,0.50)",
        color: "#4338ca",
      };

  return (
    <div className="min-h-screen text-foreground flex rtl relative">
      {isDark ? <DarkAurora /> : <LightAurora />}

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{
            background: "rgba(5,4,10,0.65)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 right-0 z-40 h-screen flex flex-col
          transition-transform duration-300 ease-in-out will-change-transform
          w-[260px] md:w-64
          ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
          md:sticky md:translate-x-0`}
        style={{
          background: isDark ? "rgba(8,6,18,0.82)" : "rgba(248,250,255,0.85)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderLeft: isDark
            ? "1px solid rgba(0,240,255,0.10)"
            : "1px solid rgba(99,102,241,0.14)",
          boxShadow: isDark
            ? "inset 0 1px 0 rgba(0,240,255,0.08), -2px 0 60px rgba(0,0,0,0.65)"
            : "inset 0 1px 0 rgba(255,255,255,0.90), -2px 0 32px rgba(99,102,241,0.08)",
        }}
      >
        {/* ── Logo / App title ── */}
        <div
          className="p-4 flex items-center gap-3 min-h-[68px] relative overflow-hidden"
          style={{
            borderBottom: isDark
              ? "1px solid rgba(0,240,255,0.08)"
              : "1px solid rgba(99,102,241,0.10)",
          }}
        >
          {/* Top chromatic edge on logo row */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: isDark
                ? "linear-gradient(to right, transparent 5%, rgba(0,240,255,0.40) 35%, rgba(112,0,255,0.30) 65%, transparent 95%)"
                : "rgba(255,255,255,0.95)",
              boxShadow: isDark ? "0 0 10px rgba(0,240,255,0.20)" : "none",
            }}
          />
          {isDark && (
            <div
              style={{
                position: "absolute",
                top: -10,
                right: -10,
                width: 90,
                height: 90,
                borderRadius: "50%",
                background: "rgba(0,240,255,0.08)",
                filter: "blur(28px)",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Logo icon with neon frame */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background: isDark
                ? "linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)"
                : "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
              boxShadow: isDark
                ? "inset 0 1px 1px rgba(255,255,255,0.25), 0 0 24px rgba(0,240,255,0.50), 0 0 50px rgba(0,240,255,0.18)"
                : "0 2px 14px rgba(99,102,241,0.42), inset 0 1px 1px rgba(255,255,255,0.30)",
              border: isDark
                ? "1px solid rgba(0,240,255,0.30)"
                : "1px solid rgba(99,102,241,0.30)",
            }}
          >
            <FolderOpen className="w-4 h-4 text-white" />
          </div>

          {/* App title */}
          <div className="flex-1 min-w-0">
            <h1
              className="font-bold text-sm leading-tight whitespace-nowrap overflow-hidden"
              style={{ color: isDark ? "#ffffff" : "#1e1b4b" }}
            >
              نظام إدارة الأرشيف
            </h1>
            <p
              className="text-[10px] mt-0.5 font-medium"
              style={{
                color: isDark
                  ? "rgba(0,240,255,0.55)"
                  : "rgba(99,102,241,0.70)",
              }}
            >
              المعماري
            </p>
          </div>

          <button
            className="md:hidden p-1 rounded-lg"
            style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#6b7280" }}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 py-4 flex flex-col gap-1.5 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group"
                style={
                  active
                    ? activeStyle
                    : {
                        color: isDark ? "rgba(255,255,255,0.55)" : "#6b7280",
                        border: "1px solid transparent",
                      }
                }
              >
                {/* Hover bg */}
                {!active && (
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: isDark
                        ? "rgba(0,240,255,0.04)"
                        : "rgba(99,102,241,0.06)",
                    }}
                  />
                )}
                {/* Prefix "+" for active */}
                {active && (
                  <span
                    className="text-xs font-bold relative z-10"
                    style={{
                      color: isDark
                        ? "rgba(0,240,255,0.70)"
                        : "rgba(99,102,241,0.70)",
                    }}
                  >
                    +
                  </span>
                )}
                <item.icon
                  className={`w-5 h-5 shrink-0 relative z-10 ${active ? "" : "opacity-50 group-hover:opacity-80 transition-opacity"}`}
                />
                <span className="whitespace-nowrap relative z-10 text-sm font-bold flex-1">
                  {item.label}
                </span>
                {/* Grid icon on right for active item */}
                {active && (
                  <LayoutGrid className="w-3.5 h-3.5 shrink-0 relative z-10 opacity-55" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── User area ── */}
        <div
          className="p-4 mt-auto"
          style={{
            borderTop: isDark
              ? "1px solid rgba(0,240,255,0.08)"
              : "1px solid rgba(99,102,241,0.10)",
          }}
        >
          <div className="flex items-center gap-3 mb-3 px-1">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, rgba(0,240,255,0.16) 0%, rgba(112,0,255,0.12) 100%)"
                  : "linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(168,85,247,0.10) 100%)",
                border: isDark
                  ? "1px solid rgba(0,240,255,0.25)"
                  : "1px solid rgba(99,102,241,0.25)",
                boxShadow: isDark ? "0 0 12px rgba(0,240,255,0.18)" : "none",
                color: isDark ? "#00f0ff" : "#4338ca",
              }}
            >
              {userType === "manager" ? "م" : "د"}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold whitespace-nowrap truncate"
                style={{ color: isDark ? "rgba(255,255,255,0.90)" : "#1e1b4b" }}
              >
                {userType === "manager" ? "مدير النظام" : "موظف إدخال"}
              </p>
              <p
                className="text-[10px] font-medium"
                style={{
                  color: isDark
                    ? "rgba(0,240,255,0.50)"
                    : "rgba(99,102,241,0.65)",
                }}
              >
                متصل الآن
              </p>
            </div>
          </div>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{
              color: isDark ? "#f87171" : "#dc2626",
              background: isDark
                ? "rgba(239,68,68,0.07)"
                : "rgba(239,68,68,0.06)",
              border: isDark
                ? "1px solid rgba(239,68,68,0.16)"
                : "1px solid rgba(239,68,68,0.14)",
            }}
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div
        className="flex-1 flex flex-col min-w-0 relative"
        style={{ zIndex: 1 }}
      >
        {/* ── Header ── */}
        <header
          className="h-14 md:h-16 flex items-center justify-between px-3 md:px-5 sticky top-0 overflow-hidden"
          style={{
            background: isDark ? "rgba(8,6,18,0.78)" : "rgba(248,250,255,0.88)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            borderBottom: isDark
              ? "1px solid rgba(0,240,255,0.08)"
              : "1px solid rgba(99,102,241,0.10)",
            boxShadow: isDark
              ? "inset 0 1px 0 rgba(0,240,255,0.08), 0 4px 30px rgba(0,0,0,0.50)"
              : "inset 0 1px 0 rgba(255,255,255,0.95), 0 4px 20px rgba(99,102,241,0.06)",
            zIndex: 30,
          }}
        >
          {/* Chromatic top edge */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: isDark
                ? "linear-gradient(to right, transparent 3%, rgba(0,240,255,0.22) 30%, rgba(112,0,255,0.18) 55%, rgba(255,0,128,0.12) 75%, transparent 97%)"
                : "rgba(255,255,255,0.95)",
              boxShadow: isDark ? "0 0 8px rgba(0,240,255,0.15)" : "none",
            }}
          />

          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl w-9 h-9 md:w-10 md:h-10"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h2
              className="font-bold text-sm md:text-base truncate"
              style={{ color: isDark ? "#ffffff" : "#1e1b4b" }}
            >
              {navItems.find((i) => location.startsWith(i.path))?.label ||
                "النظام"}
            </h2>
          </div>

          {/* ── Bell + Theme buttons ── */}
          <div className="flex items-center gap-1">

            {/* ── Bell Icon ── */}
            <div className="relative" ref={bellRef}>
              <Button
                ref={bellButtonRef}
                variant="ghost"
                size="icon"
                className="relative rounded-xl w-9 h-9 md:w-10 md:h-10"
                onClick={handleBellClick}
                aria-label="التنبيهات"
              >
                <Bell className="w-4 h-4 md:w-5 md:h-5" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-[3px] text-[10px] font-black leading-none flex items-center justify-center rounded-full"
                    style={{
                      background: isDark ? 'rgba(255,0,128,0.90)' : 'rgba(220,38,100,0.88)',
                      color: '#fff',
                      boxShadow: isDark ? '0 0 8px rgba(255,0,128,0.60)' : 'none',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </div>

            {/* ── Notifications Dropdown (Portal — bypasses overflow-hidden on header) ── */}
            {bellOpen && bellRect && createPortal(
              <div
                ref={dropdownRef}
                style={{
                  position: 'fixed',
                  top: bellRect.bottom + 8,
                  left: bellRect.left,
                  width: 340,
                  zIndex: 9999,
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: isDark ? 'rgba(10,8,22,0.97)' : 'rgba(248,250,255,0.98)',
                  backdropFilter: 'blur(28px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                  border: isDark ? '1px solid rgba(0,240,255,0.12)' : '1px solid rgba(99,102,241,0.16)',
                  boxShadow: isDark
                    ? '0 24px 60px rgba(0,0,0,0.80), 0 0 0 1px rgba(0,240,255,0.06)'
                    : '0 20px 50px rgba(31,38,135,0.14), 0 0 0 1px rgba(99,102,241,0.08)',
                  direction: 'rtl',
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.09)' }}
                >
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" style={{ color: isDark ? '#ff4da6' : '#be185d' }} />
                    <span className="text-sm font-bold" style={{ color: isDark ? '#fff' : '#1e1b4b' }}>
                      التنبيهات
                    </span>
                    {unreadCount > 0 && (
                      <span
                        className="text-xs font-black px-1.5 py-0.5 rounded-full"
                        style={{
                          background: isDark ? 'rgba(255,0,128,0.14)' : 'rgba(236,72,153,0.10)',
                          color: isDark ? '#ff4da6' : '#be185d',
                          border: isDark ? '1px solid rgba(255,0,128,0.25)' : '1px solid rgba(236,72,153,0.22)',
                        }}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-70"
                      style={{ color: isDark ? '#00f0ff' : '#6366f1' }}
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      تحديد الكل
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: isDark ? '#00f0ff' : '#6366f1' }} />
                      <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}>
                        لا توجد تنبيهات
                      </p>
                    </div>
                  ) : (
                    notifications.slice(0, 10).map(n => {
                      const nc = NOTIF_COLORS[n.level][isDark ? 'dark' : 'light'];
                      const Icon = n.level === 'danger' ? ShieldAlert : n.level === 'warning' ? AlertTriangle : Info;
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            markRead(n.id);
                            if (n.link) { setBellOpen(false); setLocation(n.link); }
                          }}
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-150 hover:opacity-80"
                          style={{
                            background: n.isRead ? 'transparent' : nc.bg,
                            borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(99,102,241,0.06)',
                          }}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: nc.bg, border: `1px solid ${nc.border}`, opacity: n.isRead ? 0.5 : 1 }}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color: nc.text }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p
                                className="text-xs font-bold truncate"
                                style={{ color: n.isRead ? (isDark ? 'rgba(255,255,255,0.38)' : '#9ca3af') : (isDark ? 'rgba(255,255,255,0.90)' : '#1e1b4b') }}
                              >
                                {n.title}
                              </p>
                              {!n.isRead && (
                                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: nc.text, boxShadow: isDark ? `0 0 5px ${nc.text}` : 'none' }} />
                              )}
                            </div>
                            <p className="text-[11px] mt-0.5 truncate"
                              style={{ color: isDark ? 'rgba(255,255,255,0.40)' : '#6b7280' }}>
                              {n.body}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div
                  className="px-4 py-2.5"
                  style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.09)' }}
                >
                  <Link
                    href="/notifications"
                    onClick={() => setBellOpen(false)}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold py-1.5 rounded-xl w-full transition-all hover:opacity-80"
                    style={{
                      color: isDark ? '#00f0ff' : '#6366f1',
                      background: isDark ? 'rgba(0,240,255,0.06)' : 'rgba(99,102,241,0.06)',
                      border: isDark ? '1px solid rgba(0,240,255,0.15)' : '1px solid rgba(99,102,241,0.15)',
                      display: 'flex',
                    }}
                  >
                    إظهار جميع التنبيهات
                  </Link>
                </div>
              </div>,
              document.body
            )}

            {/* ── Theme Toggle ── */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl w-9 h-9 md:w-10 md:h-10"
              onClick={toggleTheme}
            >
              {isDark ? (
                <Sun className="w-4 h-4 md:w-5 md:h-5" />
              ) : (
                <Moon className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-3 md:p-5 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
