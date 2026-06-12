import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppContext } from '../../context/AppContext';
import { LayoutDashboard, FolderOpen, FileText, Menu, Moon, Sun, LogOut, User } from 'lucide-react';
import { Button } from '../ui/button';

/* ── Aurora Mesh — dark mode ── */
const DarkAurora = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    <div style={{ position:'absolute', width:900, height:700, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(25,211,162,0.14) 0%, rgba(25,211,162,0.05) 45%, transparent 72%)', filter:'blur(90px)', top:-280, right:-180 }}/>
    <div style={{ position:'absolute', width:650, height:500, background:'radial-gradient(ellipse, rgba(83,247,192,0.08) 0%, rgba(25,211,162,0.03) 55%, transparent 78%)', filter:'blur(110px)', top:-80, left:'18%' }}/>
    <div style={{ position:'absolute', width:580, height:480, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(15,118,110,0.10) 0%, rgba(6,95,70,0.04) 58%, transparent 78%)', filter:'blur(100px)', bottom:-200, left:-100 }}/>
    <div style={{ position:'absolute', width:380, height:280, background:'radial-gradient(ellipse, rgba(25,211,162,0.05) 0%, transparent 72%)', filter:'blur(80px)', top:'42%', right:'6%' }}/>
  </div>
);

/* ── Aurora Mesh — light mode ── */
const LightAurora = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    <div style={{ position:'absolute', width:800, height:600, background:'radial-gradient(ellipse, rgba(20,184,166,0.08) 0%, rgba(20,184,166,0.02) 55%, transparent 74%)', filter:'blur(90px)', top:-200, right:-100 }}/>
    <div style={{ position:'absolute', width:560, height:420, background:'radial-gradient(ellipse, rgba(15,118,110,0.06) 0%, transparent 72%)', filter:'blur(100px)', bottom:-140, left:-80 }}/>
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

  return (
    <div className="min-h-screen text-foreground flex flex-col md:flex-row rtl relative">

      {isDark ? <DarkAurora /> : <LightAurora />}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:sticky top-0 right-0 z-40 h-screen transition-all duration-300
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 translate-x-full md:w-20 md:translate-x-0'}
          overflow-hidden flex flex-col border-l border-sidebar-border`}
        style={{
          background: isDark ? 'var(--glass-sidebar-bg)' : 'rgba(255,255,255,0.70)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          boxShadow: isDark
            ? 'var(--glass-inner-glow), -1px 0 40px rgba(0,0,0,0.40)'
            : 'var(--glass-inner-glow), -1px 0 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 min-h-[64px] relative overflow-hidden border-b border-sidebar-border">
          {isDark && (
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
              style={{ background:'rgba(25,211,162,0.06)', filter:'blur(36px)' }}/>
          )}
          {/* Inner top highlight on logo row */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:1,
            background: isDark
              ? 'linear-gradient(to right, transparent 8%, rgba(255,255,255,0.12) 35%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 65%, transparent 92%)'
              : 'linear-gradient(to right, transparent 8%, rgba(255,255,255,0.90) 50%, transparent 92%)',
          }}/>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background: 'linear-gradient(135deg, #19D3A2 0%, #0d9488 100%)',
              boxShadow: isDark
                ? 'var(--glass-inner-glow), 0 0 20px rgba(25,211,162,0.45)'
                : '0 2px 12px rgba(13,148,136,0.35)',
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
                  ${active ? '' : 'text-sidebar-foreground/65 hover:text-sidebar-foreground'}`}
                style={active ? {
                  background: 'linear-gradient(135deg, #19D3A2 0%, #0d9488 100%)',
                  boxShadow: isDark
                    ? 'var(--glass-inner-glow), 0 0 18px rgba(25,211,162,0.32), 0 2px 12px rgba(0,0,0,0.45)'
                    : '0 2px 14px rgba(13,148,136,0.30)',
                  border: '1px solid rgba(25,211,162,0.35)',
                  color: '#fff',
                } : {}}
              >
                {!active && (
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(13,148,136,0.06)' }}/>
                )}
                <item.icon className={`w-5 h-5 shrink-0 relative z-10 ${active ? '' : 'opacity-50 group-hover:opacity-80 transition-opacity'}`}/>
                <span className={`whitespace-nowrap relative z-10 text-sm font-semibold transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
                  {item.label}
                </span>
                {active && <span className="mr-auto text-[10px] opacity-55 relative z-10">✦</span>}
              </Link>
            );
          })}
        </nav>

        {/* User — clean spacing, no decorative SVG */}
        <div className="p-4 pt-3 mt-auto border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: isDark ? 'rgba(25,211,162,0.08)' : 'rgba(13,148,136,0.08)',
                border: `1px solid ${isDark ? 'rgba(25,211,162,0.18)' : 'rgba(13,148,136,0.18)'}`,
                boxShadow: isDark ? 'var(--glass-inner-glow)' : 'none',
              }}>
              <User className="w-4 h-4 text-sidebar-foreground/65"/>
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
            background: isDark ? 'rgba(13,17,23,0.72)' : 'rgba(255,255,255,0.78)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            boxShadow: isDark
              ? 'var(--glass-inner-glow), 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.40)'
              : 'var(--glass-inner-glow), 0 1px 0 rgba(255,255,255,0.95), 0 4px 16px rgba(0,0,0,0.05)',
            zIndex: 30,
          }}>
          {/* Header top inner highlight */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:1,
            background: isDark
              ? 'linear-gradient(to right, transparent 5%, rgba(255,255,255,0.10) 30%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.10) 70%, transparent 95%)'
              : 'rgba(255,255,255,0.95)',
          }}/>
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
