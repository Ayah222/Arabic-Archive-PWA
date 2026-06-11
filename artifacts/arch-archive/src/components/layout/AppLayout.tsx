import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppContext } from '../../context/AppContext';
import { LayoutDashboard, FolderOpen, FileText, Menu, Moon, Sun, LogOut, User } from 'lucide-react';
import { Button } from '../ui/button';

/* ─── Shared background glow — fixed, behind everything ─── */
const AppGlow = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    {/* TOP-RIGHT main blob */}
    <div style={{
      position: 'absolute', width: 900, height: 900, borderRadius: '50%',
      background: '#00d483', opacity: 0.14, filter: 'blur(160px)',
      top: -350, right: -250,
    }}/>
    {/* BOTTOM-LEFT secondary blob */}
    <div style={{
      position: 'absolute', width: 700, height: 700, borderRadius: '50%',
      background: '#00d483', opacity: 0.09, filter: 'blur(140px)',
      bottom: -200, left: -200,
    }}/>
    {/* CENTER ambient */}
    <div style={{
      position: 'absolute', width: 800, height: 350, borderRadius: '50%',
      background: '#00d483', opacity: 0.05, filter: 'blur(130px)',
      top: '48%', left: '38%', transform: 'translate(-50%,-50%)',
    }}/>
  </div>
);

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, toggleTheme, logout, userType } = useAppContext();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { path: '/projects', label: 'المشاريع', icon: FolderOpen },
    { path: '/documents', label: 'المستندات', icon: FileText },
  ];

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row rtl relative">

      {/* Global glow background */}
      <AppGlow />

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:sticky top-0 right-0 z-40 h-screen border-l border-sidebar-border transition-all duration-300 ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 translate-x-full md:w-20 md:translate-x-0'} overflow-hidden flex flex-col`}
        style={{ background: 'hsl(160 42% 3% / 0.92)', backdropFilter: 'blur(20px)' }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border min-h-[64px] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none"
            style={{ background: '#00d483', opacity: 0.08, filter: 'blur(30px)' }}/>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative"
            style={{
              background: 'linear-gradient(135deg, #00d483 0%, #007a4c 100%)',
              boxShadow: '0 0 16px rgba(0,212,131,0.45)',
              border: '1px solid rgba(0,212,131,0.30)',
            }}>
            <FolderOpen className="w-4 h-4" style={{ color: '#061a10' }} />
          </div>
          <h1 className={`font-bold text-base text-sidebar-foreground whitespace-nowrap transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
            نظام إدارة الأرشيف
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-5 flex flex-col gap-1 px-2">
          {navItems.map(item => {
            const isActive = location.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative overflow-hidden ${
                  isActive ? 'text-[#061a10]' : 'text-sidebar-foreground hover:text-white'
                }`}
                style={isActive ? {
                  background: 'linear-gradient(135deg, #00d483 0%, #009e60 100%)',
                  boxShadow: '0 0 20px rgba(0,212,131,0.35)',
                  border: '1px solid rgba(0,212,131,0.40)',
                } : {}}
              >
                {!isActive && (
                  <div className="absolute inset-0 rounded-xl transition-opacity opacity-0 hover:opacity-100"
                    style={{ background: 'rgba(0,212,131,0.08)' }}/>
                )}
                <item.icon className={`w-5 h-5 shrink-0 relative z-10 ${isActive ? '' : 'opacity-65'}`} />
                <span className={`whitespace-nowrap transition-opacity relative z-10 text-sm font-medium ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="mr-auto text-[10px] opacity-60 relative z-10">✦</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Botanical divider */}
        <div className="px-4 py-2 pointer-events-none overflow-hidden" style={{ opacity: 0.12 }}>
          <svg viewBox="0 0 200 36" className="w-full" fill="none">
            <path d="M10,18 C35,4 65,0 100,6 C135,12 165,4 190,18" stroke="#bbd7c8" strokeWidth="1.2" strokeLinecap="round"/>
            <ellipse cx="100" cy="6" rx="7" ry="4" fill="#6dab8c" opacity="0.8"/>
            <ellipse cx="35" cy="14" rx="5" ry="3" transform="rotate(-20 35 14)" fill="#6dab8c" opacity="0.6"/>
            <ellipse cx="165" cy="14" rx="5" ry="3" transform="rotate(20 165 14)" fill="#6dab8c" opacity="0.6"/>
            <circle cx="100" cy="30" r="1.5" fill="#bbd7c8" opacity="0.4"/>
            <path d="M100,6 L100,30" stroke="#bbd7c8" strokeWidth="0.8" opacity="0.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border mt-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,212,131,0.10)', border: '1px solid rgba(0,212,131,0.20)' }}>
              <User className="w-4 h-4 text-sidebar-foreground/70" />
            </div>
            <div className={`overflow-hidden transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
              <p className="text-sm font-medium whitespace-nowrap text-sidebar-foreground">
                {userType === 'manager' ? 'مدير النظام' : 'موظف إدخال'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive gap-3 rounded-xl"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
              تسجيل الخروج
            </span>
          </Button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 sticky top-0"
          style={{ background: 'hsl(160 38% 4% / 0.80)', backdropFilter: 'blur(16px)', zIndex: 30 }}>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-[10px]" style={{ color: 'rgba(0,212,131,0.55)' }}>✦</span>
              <h2 className="font-semibold text-base">
                {navItems.find(i => location.startsWith(i.path))?.label || 'النظام'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
