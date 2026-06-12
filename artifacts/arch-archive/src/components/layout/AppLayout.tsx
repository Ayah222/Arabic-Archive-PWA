import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppContext } from '../../context/AppContext';
import { LayoutDashboard, FolderOpen, FileText, Menu, Moon, Sun, LogOut, User } from 'lucide-react';
import { Button } from '../ui/button';

/* ── Aurora Mesh — dark mode ── */
const DarkAurora = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    {/* Primary large aurora — top right */}
    <div style={{
      position: 'absolute', width: 900, height: 700, borderRadius: '50%',
      background: 'radial-gradient(ellipse, rgba(25,211,162,0.18) 0%, rgba(25,211,162,0.07) 40%, transparent 70%)',
      filter: 'blur(80px)', top: -280, right: -180,
    }}/>
    {/* Secondary aurora — top centre */}
    <div style={{
      position: 'absolute', width: 700, height: 500,
      background: 'radial-gradient(ellipse, rgba(83,247,192,0.10) 0%, rgba(25,211,162,0.05) 50%, transparent 75%)',
      filter: 'blur(100px)', top: -100, left: '20%',
    }}/>
    {/* Deep green pool — bottom left */}
    <div style={{
      position: 'absolute', width: 650, height: 500, borderRadius: '50%',
      background: 'radial-gradient(ellipse, rgba(15,118,110,0.14) 0%, rgba(6,95,70,0.06) 55%, transparent 75%)',
      filter: 'blur(90px)', bottom: -200, left: -100,
    }}/>
    {/* Faint accent — mid right */}
    <div style={{
      position: 'absolute', width: 400, height: 300,
      background: 'radial-gradient(ellipse, rgba(25,211,162,0.07) 0%, transparent 70%)',
      filter: 'blur(70px)', top: '45%', right: '5%',
    }}/>
  </div>
);

/* ── Aurora Mesh — light mode ── */
const LightAurora = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    {/* Top-right mint wash */}
    <div style={{
      position: 'absolute', width: 800, height: 600,
      background: 'radial-gradient(ellipse, rgba(20,184,166,0.09) 0%, rgba(20,184,166,0.03) 50%, transparent 72%)',
      filter: 'blur(80px)', top: -200, right: -100,
    }}/>
    {/* Bottom-left teal tint */}
    <div style={{
      position: 'absolute', width: 600, height: 450,
      background: 'radial-gradient(ellipse, rgba(15,118,110,0.07) 0%, transparent 70%)',
      filter: 'blur(90px)', bottom: -150, left: -80,
    }}/>
  </div>
);

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, toggleTheme, logout, userType } = useAppContext();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { path: '/projects',  label: 'المشاريع',    icon: FolderOpen },
    { path: '/documents', label: 'المستندات',   icon: FileText },
  ];

  const handleLogout = () => { logout(); setLocation('/login'); };
  const isDark = theme === 'dark';

  /* Palette tokens derived from new design system */
  const P = isDark ? {
    primary: '#19D3A2',
    primaryDim: 'rgba(25,211,162,0.70)',
    sidebarBg: 'rgba(8,12,15,0.92)',
    headerBg: 'rgba(11,15,18,0.82)',
    activeGrad: 'linear-gradient(135deg, #19D3A2 0%, #0d9488 100%)',
    activeGlow: '0 0 18px rgba(25,211,162,0.35), 0 2px 12px rgba(0,0,0,0.50)',
    activeBorder: 'rgba(25,211,162,0.40)',
    hoverBg: 'rgba(25,211,162,0.07)',
    headerLine: 'linear-gradient(to right, transparent 5%, rgba(25,211,162,0.55) 35%, rgba(25,211,162,0.80) 55%, rgba(25,211,162,0.55) 75%, transparent 95%)',
    logoGlow: '0 0 22px rgba(25,211,162,0.50)',
    activeText: '#051a12',
  } : {
    primary: '#0F766E',
    primaryDim: 'rgba(15,118,110,0.80)',
    sidebarBg: undefined,
    headerBg: 'rgba(255,255,255,0.88)',
    activeGrad: 'linear-gradient(135deg, #19D3A2 0%, #0d9488 100%)',
    activeGlow: '0 2px 14px rgba(15,118,110,0.30)',
    activeBorder: 'rgba(15,118,110,0.35)',
    hoverBg: 'rgba(15,118,110,0.08)',
    headerLine: 'none',
    logoGlow: '0 2px 10px rgba(15,118,110,0.40)',
    activeText: '#ffffff',
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row rtl relative">

      {/* Aurora background */}
      {isDark ? <DarkAurora /> : <LightAurora />}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:sticky top-0 right-0 z-40 h-screen transition-all duration-300
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 translate-x-full md:w-20 md:translate-x-0'}
          overflow-hidden flex flex-col bg-sidebar border-l border-sidebar-border`}
        style={isDark ? {
          background: P.sidebarBg,
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
        } : undefined}
      >
        {/* Logo area */}
        <div className="p-4 flex items-center gap-3 min-h-[64px] relative overflow-hidden border-b border-sidebar-border">
          {isDark && (
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
              style={{ background: 'rgba(25,211,162,0.08)', filter: 'blur(32px)' }}/>
          )}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background: 'linear-gradient(135deg, #19D3A2 0%, #0d9488 100%)',
              boxShadow: P.logoGlow,
            }}>
            <FolderOpen className="w-4 h-4 text-white"/>
          </div>
          <h1 className={`font-bold text-base text-sidebar-foreground whitespace-nowrap transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
            نظام إدارة الأرشيف
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-5 flex flex-col gap-1 px-2">
          {navItems.map(item => {
            const active = location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden group
                  ${active ? '' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'}`}
                style={active ? {
                  background: P.activeGrad,
                  boxShadow: P.activeGlow,
                  border: `1px solid ${P.activeBorder}`,
                  color: P.activeText,
                } : {}}
              >
                {!active && (
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: P.hoverBg }}/>
                )}
                <item.icon className={`w-5 h-5 shrink-0 relative z-10 ${active ? '' : 'opacity-55 group-hover:opacity-85 transition-opacity'}`}/>
                <span className={`whitespace-nowrap relative z-10 text-sm font-semibold transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
                  {item.label}
                </span>
                {active && <span className="mr-auto text-[10px] opacity-50 relative z-10">✦</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section — no decorative SVG */}
        <div className="p-4 pt-3 mt-auto border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: isDark ? 'rgba(25,211,162,0.12)' : 'rgba(15,118,110,0.12)',
                border: `1px solid ${isDark ? 'rgba(25,211,162,0.20)' : 'rgba(15,118,110,0.20)'}`,
              }}>
              <User className="w-4 h-4 text-sidebar-foreground/70"/>
            </div>
            <div className={`overflow-hidden transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
              <p className="text-sm font-semibold whitespace-nowrap text-sidebar-foreground">
                {userType === 'manager' ? 'مدير النظام' : 'موظف إدخال'}
              </p>
            </div>
          </div>
          <Button variant="ghost"
            className="w-full justify-start text-destructive hover:bg-destructive/10 gap-3 rounded-xl"
            onClick={handleLogout}>
            <LogOut className="w-4 h-4 shrink-0"/>
            <span className={`whitespace-nowrap transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
              تسجيل الخروج
            </span>
          </Button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 sticky top-0 overflow-hidden border-b border-border"
          style={{
            background: P.headerBg,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            zIndex: 30,
          }}>
          {isDark && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1,
              background: P.headerLine,
              boxShadow: '0 0 6px rgba(25,211,162,0.35)',
            }}/>
          )}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5"/>
            </Button>
            <h2 className="font-bold text-base text-foreground">
              {navItems.find(i => location.startsWith(i.path))?.label || 'النظام'}
            </h2>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggleTheme}>
            {isDark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
