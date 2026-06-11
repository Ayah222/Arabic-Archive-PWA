import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppContext } from '../../context/AppContext';
import { LayoutDashboard, FolderOpen, FileText, Menu, Moon, Sun, LogOut, User } from 'lucide-react';
import { Button } from '../ui/button';

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
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row rtl">
      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 right-0 z-40 h-screen bg-sidebar border-l border-sidebar-border transition-all duration-300 ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 translate-x-full md:w-20 md:translate-x-0'} overflow-hidden flex flex-col`}>

        {/* Logo header */}
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border min-h-[64px] relative overflow-hidden">
          {/* Subtle glow behind logo */}
          <div className="absolute top-0 right-0 w-20 h-20 blob-primary-sm pointer-events-none opacity-60"/>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative glow-icon"
            style={{
              background: 'linear-gradient(135deg, hsl(162 95% 35%) 0%, hsl(162 95% 22%) 100%)',
              border: '1px solid hsl(162 95% 50% / 0.25)'
            }}>
            <FolderOpen className="w-4 h-4 text-primary-foreground" />
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
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-sidebar-foreground hover:text-sidebar-foreground'
                }`}
                style={isActive ? {
                  background: 'linear-gradient(135deg, hsl(162 95% 35%) 0%, hsl(162 95% 24%) 100%)',
                  boxShadow: '0 0 16px hsl(162 95% 42% / 0.30), inset 0 1px 0 hsl(255 100% 100% / 0.08)',
                  border: '1px solid hsl(162 95% 50% / 0.20)'
                } : {}}
              >
                {isActive && (
                  <div className="absolute inset-0 blob-primary-sm opacity-30 pointer-events-none"/>
                )}
                <item.icon className={`w-5 h-5 shrink-0 relative z-10 ${isActive ? '' : 'opacity-70'}`} />
                <span className={`whitespace-nowrap transition-opacity relative z-10 text-sm font-medium ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="mr-auto text-primary/80 text-[10px] opacity-70 relative z-10">✦</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Botanical divider */}
        <div className="px-4 py-3 opacity-[0.15] pointer-events-none overflow-hidden">
          <svg viewBox="0 0 200 36" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10,18 C35,4 65,0 100,6 C135,12 165,4 190,18"
              stroke="#bbd7c8" strokeWidth="1.2" strokeLinecap="round"/>
            <ellipse cx="100" cy="6" rx="7" ry="4" fill="#6dab8c" opacity="0.8"/>
            <ellipse cx="35" cy="14" rx="5" ry="3" transform="rotate(-20 35 14)" fill="#6dab8c" opacity="0.6"/>
            <ellipse cx="165" cy="14" rx="5" ry="3" transform="rotate(20 165 14)" fill="#6dab8c" opacity="0.6"/>
            <ellipse cx="68" cy="9" rx="4" ry="2.5" transform="rotate(-10 68 9)" fill="#bbd7c8" opacity="0.7"/>
            <ellipse cx="132" cy="9" rx="4" ry="2.5" transform="rotate(10 132 9)" fill="#bbd7c8" opacity="0.7"/>
            <circle cx="100" cy="30" r="1.5" fill="#bbd7c8" opacity="0.4"/>
            <path d="M100,6 L100,30" stroke="#bbd7c8" strokeWidth="0.8" opacity="0.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border mt-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: 'hsl(162 30% 13%)',
                border: '1px solid hsl(162 95% 42% / 0.20)'
              }}>
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 sticky top-0 z-30"
          style={{ background: 'hsl(160 38% 4% / 0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-primary/50 text-xs">✦</span>
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
