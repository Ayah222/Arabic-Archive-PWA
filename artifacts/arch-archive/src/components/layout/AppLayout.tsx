import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppContext } from '../../context/AppContext';
import { LayoutDashboard, FolderOpen, FileText, Menu, Moon, Sun, LogOut, User, X } from 'lucide-react';
import { Button } from '../ui/button';

/* ── Aurora — Dark: cyan + purple + pink neon blobs ── */
const DarkAurora = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    <div style={{ position:'absolute', width:800, height:700, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(0,240,255,0.12) 0%, rgba(0,240,255,0.04) 45%, transparent 72%)', filter:'blur(100px)', top:-300, right:-150 }}/>
    <div style={{ position:'absolute', width:700, height:550, background:'radial-gradient(ellipse, rgba(112,0,255,0.14) 0%, rgba(112,0,255,0.04) 50%, transparent 74%)', filter:'blur(120px)', top:-100, left:'15%' }}/>
    <div style={{ position:'absolute', width:580, height:480, background:'radial-gradient(ellipse, rgba(255,0,128,0.10) 0%, rgba(112,0,255,0.03) 55%, transparent 76%)', filter:'blur(110px)', bottom:-200, left:-80 }}/>
    <div style={{ position:'absolute', width:360, height:280, background:'radial-gradient(ellipse, rgba(0,240,255,0.06) 0%, transparent 72%)', filter:'blur(80px)', top:'45%', right:'8%' }}/>
  </div>
);

/* ── Aurora — Light: pastel cyan + indigo ── */
const LightAurora = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    <div style={{ position:'absolute', width:800, height:600, background:'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 72%)', filter:'blur(90px)', top:-200, right:-100 }}/>
    <div style={{ position:'absolute', width:560, height:420, background:'radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 72%)', filter:'blur(100px)', bottom:-140, left:-80 }}/>
    <div style={{ position:'absolute', width:400, height:300, background:'radial-gradient(ellipse, rgba(168,85,247,0.06) 0%, transparent 72%)', filter:'blur(90px)', top:'40%', left:'35%' }}/>
  </div>
);

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, toggleTheme, logout, userType } = useAppContext();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { path: '/projects',  label: 'المشاريع',    icon: FolderOpen },
    { path: '/documents', label: 'المستندات',   icon: FileText },
  ];

  const handleLogout = () => { logout(); setLocation('/login'); };
  const isDark = theme === 'dark';

  /* ── Active nav pill style ── */
  const activeStyle = {
    background: 'var(--btn-active-gradient)',
    boxShadow: isDark
      ? 'var(--glass-inner-glow), 0 0 20px rgba(0,240,255,0.28), 0 2px 14px rgba(0,0,0,0.50)'
      : '0 2px 14px rgba(99,102,241,0.30)',
    border: isDark ? '1px solid rgba(0,240,255,0.22)' : '1px solid rgba(99,102,241,0.26)',
    color: '#fff',
  };

  return (
    <div className="min-h-screen text-foreground flex rtl relative">

      {isDark ? <DarkAurora /> : <LightAurora />}

      {/* ── Mobile overlay backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(5,4,10,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 right-0 z-40 h-screen flex flex-col border-l border-sidebar-border
          transition-transform duration-300 ease-in-out will-change-transform
          w-[260px] md:w-64
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          md:sticky md:translate-x-0`}
        style={{
          background: isDark ? 'var(--glass-sidebar-bg)' : 'rgba(255,255,255,0.70)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          boxShadow: isDark
            ? 'var(--glass-inner-glow), -1px 0 50px rgba(0,0,0,0.55)'
            : 'var(--glass-inner-glow), -1px 0 24px rgba(99,102,241,0.07)',
        }}
      >
        {/* Logo row */}
        <div className="p-4 flex items-center gap-3 min-h-[64px] relative overflow-hidden border-b border-sidebar-border">
          {/* Inner top highlight */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:1,
            background: isDark
              ? 'linear-gradient(to right, transparent 8%, rgba(0,240,255,0.25) 40%, rgba(112,0,255,0.20) 60%, transparent 92%)'
              : 'rgba(255,255,255,0.90)',
          }}/>
          {/* Aurora bloom behind logo */}
          {isDark && (
            <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(0,240,255,0.06)', filter:'blur(30px)', pointerEvents:'none' }}/>
          )}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)'
                : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              boxShadow: isDark
                ? 'var(--glass-inner-glow), 0 0 22px rgba(0,240,255,0.45)'
                : '0 2px 12px rgba(99,102,241,0.35)',
            }}>
            <FolderOpen className="w-4 h-4 text-white"/>
          </div>
          <h1 className="font-bold text-sm leading-tight text-sidebar-foreground whitespace-nowrap overflow-hidden">
            نظام إدارة الأرشيف
          </h1>
          {/* Close btn — mobile only */}
          <button
            className="mr-auto md:hidden p-1 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
          {navItems.map(item => {
            const active = location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden group
                  ${active ? '' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'}`}
                style={active ? activeStyle : {}}
              >
                {!active && (
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: isDark ? 'rgba(0,240,255,0.04)' : 'rgba(99,102,241,0.06)' }}/>
                )}
                <item.icon className={`w-5 h-5 shrink-0 relative z-10 ${active ? '' : 'opacity-45 group-hover:opacity-75 transition-opacity'}`}/>
                <span className="whitespace-nowrap relative z-10 text-sm font-semibold">{item.label}</span>
                {active && <span className="mr-auto text-[10px] opacity-60 relative z-10">✦</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 mt-auto border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: isDark ? 'rgba(0,240,255,0.07)' : 'rgba(99,102,241,0.08)',
                border: isDark ? '1px solid rgba(0,240,255,0.16)' : '1px solid rgba(99,102,241,0.18)',
                boxShadow: isDark ? 'var(--glass-inner-glow)' : 'none',
              }}>
              <User className="w-4 h-4 text-sidebar-foreground/60"/>
            </div>
            <p className="text-sm font-semibold whitespace-nowrap text-sidebar-foreground">
              {userType === 'manager' ? 'مدير النظام' : 'موظف إدخال'}
            </p>
          </div>
          <Button variant="ghost"
            className="w-full justify-start text-destructive hover:bg-destructive/10 gap-3 rounded-xl text-sm"
            onClick={handleLogout}>
            <LogOut className="w-4 h-4 shrink-0"/>
            <span>تسجيل الخروج</span>
          </Button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 relative" style={{ zIndex: 1 }}>

        {/* Header */}
        <header className="h-14 md:h-16 flex items-center justify-between px-3 md:px-5 sticky top-0 overflow-hidden border-b border-border"
          style={{
            background: isDark ? 'rgba(5,4,10,0.75)' : 'rgba(255,255,255,0.80)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            boxShadow: isDark
              ? 'var(--glass-inner-glow), 0 4px 24px rgba(0,0,0,0.45)'
              : 'var(--glass-inner-glow), 0 4px 16px rgba(99,102,241,0.05)',
            zIndex: 30,
          }}>
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:1,
            background: isDark
              ? 'linear-gradient(to right, transparent 5%, rgba(0,240,255,0.14) 35%, rgba(112,0,255,0.12) 65%, transparent 95%)'
              : 'rgba(255,255,255,0.95)',
          }}/>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Hamburger — always visible */}
            <Button variant="ghost" size="icon" className="rounded-xl w-9 h-9 md:w-10 md:h-10"
              onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5"/>
            </Button>
            <h2 className="font-bold text-sm md:text-base text-foreground truncate">
              {navItems.find(i => location.startsWith(i.path))?.label || 'النظام'}
            </h2>
          </div>

          <Button variant="ghost" size="icon" className="rounded-xl w-9 h-9 md:w-10 md:h-10" onClick={toggleTheme}>
            {isDark ? <Sun className="w-4 h-4 md:w-5 md:h-5"/> : <Moon className="w-4 h-4 md:w-5 md:h-5"/>}
          </Button>
        </header>

        <main className="flex-1 p-3 md:p-5 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
