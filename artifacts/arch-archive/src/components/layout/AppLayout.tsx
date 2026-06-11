import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppContext } from '../../context/AppContext';
import { LayoutDashboard, FolderOpen, FileText, Menu, Moon, Sun, LogOut, User } from 'lucide-react';
import { Button } from '../ui/button';

/* ─── Fixed full-screen atmosphere ─── */
const AppGlow = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>

    {/* Architectural scene image */}
    <img
      src="/bg-scene.png" alt="" aria-hidden="true"
      style={{
        position: 'absolute', left: -80, bottom: -40,
        width: '75vw', maxWidth: 900,
        opacity: 0.07, mixBlendMode: 'screen',
        filter: 'saturate(1.3) brightness(1.1)',
        pointerEvents: 'none', userSelect: 'none', objectFit: 'cover',
      }}
    />

    {/* Green glow blobs */}
    <div style={{ position:'absolute', width:900, height:900, borderRadius:'50%', background:'#00d483', opacity:0.13, filter:'blur(160px)', top:-350, right:-250 }}/>
    <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%', background:'#00d483', opacity:0.08, filter:'blur(140px)', bottom:-200, left:-200 }}/>
    <div style={{ position:'absolute', width:800, height:350, borderRadius:'50%', background:'#00d483', opacity:0.04, filter:'blur(130px)', top:'48%', left:'38%', transform:'translate(-50%,-50%)' }}/>

    {/* ── LASER LINES ── */}
    {/* Top horizontal beam — full width fade */}
    <div style={{
      position:'absolute', height:1, width:'70%', top:'18%', right:0,
      background:'linear-gradient(to left, transparent 0%, rgba(0,212,131,0.65) 45%, rgba(0,212,131,0.80) 55%, transparent 100%)',
      boxShadow:'0 0 8px rgba(0,212,131,0.50), 0 0 20px rgba(0,212,131,0.20)',
    }}/>
    {/* Mid-left horizontal beam */}
    <div style={{
      position:'absolute', height:1, width:'45%', top:'55%', left:0,
      background:'linear-gradient(to right, transparent 0%, rgba(0,212,131,0.55) 40%, rgba(0,212,131,0.70) 60%, transparent 100%)',
      boxShadow:'0 0 8px rgba(0,212,131,0.45), 0 0 18px rgba(0,212,131,0.15)',
    }}/>
    {/* Bottom beam — right side */}
    <div style={{
      position:'absolute', height:1, width:'35%', top:'80%', right:'10%',
      background:'linear-gradient(to left, transparent 0%, rgba(0,212,131,0.45) 50%, transparent 100%)',
      boxShadow:'0 0 6px rgba(0,212,131,0.35)',
    }}/>
    {/* Thin vertical accent — right edge */}
    <div style={{
      position:'absolute', width:1, height:'40%', top:'15%', right:'28%',
      background:'linear-gradient(to bottom, transparent 0%, rgba(0,212,131,0.50) 40%, rgba(0,212,131,0.50) 60%, transparent 100%)',
      boxShadow:'0 0 6px rgba(0,212,131,0.35)',
    }}/>

    {/* Grid pattern */}
    <div style={{
      position:'absolute', inset:0,
      backgroundImage:`linear-gradient(rgba(0,212,131,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,131,0.04) 1px, transparent 1px)`,
      backgroundSize:'40px 40px',
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row rtl relative">
      <AppGlow />

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:sticky top-0 right-0 z-40 h-screen transition-all duration-300
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 translate-x-full md:w-20 md:translate-x-0'}
          overflow-hidden flex flex-col`}
        style={{
          background:'hsl(160 42% 3% / 0.94)',
          backdropFilter:'blur(24px)',
          borderLeft:'1px solid rgba(0,212,131,0.12)',
          boxShadow:'-1px 0 0 rgba(0,212,131,0.06)',
        }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 min-h-[64px] relative overflow-hidden"
          style={{ borderBottom:'1px solid rgba(0,212,131,0.10)' }}>
          <div className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none"
            style={{ background:'#00d483', opacity:0.06, filter:'blur(28px)' }}/>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background:'linear-gradient(135deg,#00d483 0%,#007a4c 100%)',
              boxShadow:'0 0 18px rgba(0,212,131,0.50), 0 0 0 1px rgba(0,212,131,0.25)',
            }}>
            <FolderOpen className="w-4 h-4" style={{ color:'#061a10' }}/>
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative overflow-hidden group
                  ${active ? 'text-[#061a10]' : 'text-sidebar-foreground/75 hover:text-white'}`}
                style={active ? {
                  background:'linear-gradient(135deg,#00d483 0%,#009e60 100%)',
                  boxShadow:'0 0 22px rgba(0,212,131,0.38), 0 2px 8px rgba(0,0,0,0.35)',
                  border:'1px solid rgba(0,212,131,0.45)',
                } : {}}
              >
                {!active && <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background:'rgba(0,212,131,0.08)' }}/>}
                <item.icon className={`w-5 h-5 shrink-0 relative z-10 ${active ? '' : 'opacity-60'}`}/>
                <span className={`whitespace-nowrap relative z-10 text-sm font-semibold transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
                  {item.label}
                </span>
                {active && <span className="mr-auto text-[10px] opacity-50 relative z-10">✦</span>}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="px-4 py-1 pointer-events-none overflow-hidden" style={{ opacity:0.12 }}>
          <svg viewBox="0 0 200 36" className="w-full" fill="none">
            <path d="M10,18 C35,4 65,0 100,6 C135,12 165,4 190,18" stroke="#bbd7c8" strokeWidth="1.2" strokeLinecap="round"/>
            <ellipse cx="100" cy="6" rx="7" ry="4" fill="#6dab8c" opacity="0.8"/>
            <ellipse cx="35" cy="14" rx="5" ry="3" transform="rotate(-20 35 14)" fill="#6dab8c" opacity="0.6"/>
            <ellipse cx="165" cy="14" rx="5" ry="3" transform="rotate(20 165 14)" fill="#6dab8c" opacity="0.6"/>
            <path d="M100,6 L100,30" stroke="#bbd7c8" strokeWidth="0.8" opacity="0.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* User */}
        <div className="p-4 mt-auto" style={{ borderTop:'1px solid rgba(0,212,131,0.10)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background:'rgba(0,212,131,0.10)', border:'1px solid rgba(0,212,131,0.22)' }}>
              <User className="w-4 h-4" style={{ color:'rgba(0,212,131,0.70)' }}/>
            </div>
            <div className={`overflow-hidden transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
              <p className="text-sm font-semibold whitespace-nowrap" style={{ color:'rgba(180,240,210,0.85)' }}>
                {userType === 'manager' ? 'مدير النظام' : 'موظف إدخال'}
              </p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10 gap-3 rounded-xl" onClick={handleLogout}>
            <LogOut className="w-4 h-4 shrink-0"/>
            <span className={`whitespace-nowrap transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>تسجيل الخروج</span>
          </Button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 relative" style={{ zIndex:1 }}>
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 sticky top-0"
          style={{
            background:'hsl(160 38% 4% / 0.82)',
            backdropFilter:'blur(20px)',
            borderBottom:'1px solid rgba(0,212,131,0.10)',
            boxShadow:'0 1px 0 rgba(0,212,131,0.06)',
            zIndex:30,
          }}>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5"/>
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-[10px]" style={{ color:'rgba(0,212,131,0.60)' }}>✦</span>
              <h2 className="font-bold text-base" style={{ color:'rgba(210,245,230,0.92)' }}>
                {navItems.find(i => location.startsWith(i.path))?.label || 'النظام'}
              </h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="w-5 h-5"/> : <Sun className="w-5 h-5"/>}
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
