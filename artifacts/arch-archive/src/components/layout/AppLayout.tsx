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
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border min-h-[64px]">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shrink-0">
            <FolderOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className={`font-bold text-lg text-sidebar-foreground whitespace-nowrap transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
            نظام إدارة الأرشيف
          </h1>
        </div>
        
        <nav className="flex-1 py-4 flex flex-col gap-2 px-2">
          {navItems.map(item => {
            const isActive = location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className={`whitespace-nowrap transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Botanical divider */}
        <div className="px-4 py-3 opacity-[0.18] pointer-events-none overflow-hidden">
          <svg viewBox="0 0 200 36" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10,18 C35,4 65,0 100,6 C135,12 165,4 190,18"
              stroke="#bbd7c8" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M55,18 C65,8 80,5 100,6 C120,7 135,8 145,18"
              stroke="#bbd7c8" strokeWidth="0.9" strokeLinecap="round" opacity="0.7"/>
            <ellipse cx="100" cy="6" rx="7" ry="4" fill="#6dab8c" opacity="0.8"/>
            <ellipse cx="35" cy="14" rx="5" ry="3" transform="rotate(-20 35 14)" fill="#6dab8c" opacity="0.6"/>
            <ellipse cx="165" cy="14" rx="5" ry="3" transform="rotate(20 165 14)" fill="#6dab8c" opacity="0.6"/>
            <ellipse cx="68" cy="9" rx="4" ry="2.5" transform="rotate(-10 68 9)" fill="#bbd7c8" opacity="0.7"/>
            <ellipse cx="132" cy="9" rx="4" ry="2.5" transform="rotate(10 132 9)" fill="#bbd7c8" opacity="0.7"/>
            <circle cx="10" cy="18" r="2" fill="#bbd7c8" opacity="0.6"/>
            <circle cx="190" cy="18" r="2" fill="#bbd7c8" opacity="0.6"/>
            <circle cx="100" cy="30" r="1.5" fill="#bbd7c8" opacity="0.4"/>
            <path d="M100,6 L100,30" stroke="#bbd7c8" strokeWidth="0.8" opacity="0.5" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="p-4 border-t border-sidebar-border mt-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className={`overflow-hidden transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
              <p className="text-sm font-medium whitespace-nowrap">{userType === 'manager' ? 'مدير النظام' : 'موظف إدخال'}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive gap-3" onClick={handleLogout}>
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>تسجيل الخروج</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold text-lg">
              {navItems.find(i => location.startsWith(i.path))?.label || 'النظام'}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
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
