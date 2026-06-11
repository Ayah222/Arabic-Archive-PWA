import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppContext } from '../../context/AppContext';
import { LayoutDashboard, FolderOpen, FileText, Menu, Moon, Sun, LogOut, User } from 'lucide-react';
import { Button } from '../ui/button';

/* ─── Full-screen atmospheric background ─── */
const AppGlow = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>

    {/* LAYER 1 — Architectural scene photo (clear & visible) */}
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: 'url(/bg-scene.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center 60%',
      opacity: 0.28,
    }}/>

    {/* LAYER 2 — Dark tinted overlay to create depth */}
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(135deg, rgba(3,12,8,0.78) 0%, rgba(5,18,12,0.68) 50%, rgba(3,14,9,0.82) 100%)',
    }}/>

    {/* LAYER 3 — Vignette edges (darken edges, brighten center) */}
    <div style={{
      position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse 90% 80% at 50% 40%, transparent 30%, rgba(2,8,5,0.55) 100%)',
    }}/>

    {/* LAYER 4 — Green neon glow blobs */}
    <div style={{ position:'absolute', width:800, height:800, borderRadius:'50%', background:'#00d483', opacity:0.11, filter:'blur(160px)', top:-300, right:-200 }}/>
    <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'#00d483', opacity:0.07, filter:'blur(140px)', bottom:-150, left:-150 }}/>
    <div style={{ position:'absolute', width:500, height:250, borderRadius:'50%', background:'#00d483', opacity:0.04, filter:'blur(120px)', top:'50%', left:'40%', transform:'translate(-50%,-50%)' }}/>

    {/* LAYER 5 — Laser lines */}
    <div style={{
      position:'absolute', height:1, width:'70%', top:'20%', right:0,
      background:'linear-gradient(to left, transparent 0%, rgba(0,212,131,0.55) 35%, rgba(0,212,131,0.85) 55%, transparent 100%)',
      boxShadow:'0 0 10px rgba(0,212,131,0.55), 0 0 28px rgba(0,212,131,0.20)',
    }}/>
    <div style={{
      position:'absolute', height:1, width:'45%', top:'58%', left:0,
      background:'linear-gradient(to right, transparent 0%, rgba(0,212,131,0.50) 40%, rgba(0,212,131,0.72) 60%, transparent 100%)',
      boxShadow:'0 0 8px rgba(0,212,131,0.45)',
    }}/>
    <div style={{
      position:'absolute', height:1, width:'30%', top:'82%', right:'12%',
      background:'linear-gradient(to left, transparent 0%, rgba(0,212,131,0.40) 50%, transparent 100%)',
      boxShadow:'0 0 6px rgba(0,212,131,0.30)',
    }}/>
    <div style={{
      position:'absolute', width:1, height:'42%', top:'14%', right:'26%',
      background:'linear-gradient(to bottom, transparent 0%, rgba(0,212,131,0.50) 35%, rgba(0,212,131,0.50) 65%, transparent 100%)',
      boxShadow:'0 0 7px rgba(0,212,131,0.35)',
    }}/>

    {/* LAYER 6 — Grid pattern */}
    <div style={{
      position:'absolute', inset:0,
      backgroundImage:`linear-gradient(rgba(0,212,131,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,131,0.045) 1px, transparent 1px)`,
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
    <div className="min-h-screen text-foreground flex flex-col md:flex-row rtl relative"
      style={{ background: 'hsl(160, 38%, 3%)' }}>

      <AppGlow />

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:sticky top-0 right-0 z-40 h-screen transition-all duration-300
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 translate-x-full md:w-20 md:translate-x-0'}
          overflow-hidden flex flex-col`}
        style={{
          background: 'rgba(3, 12, 8, 0.82)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderLeft: '1px solid rgba(0,212,131,0.14)',
          boxShadow: 'inset -1px 0 0 rgba(0,212,131,0.06), -8px 0 32px rgba(0,0,0,0.40)',
        }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 min-h-[64px] relative overflow-hidden"
          style={{ borderBottom:'1px solid rgba(0,212,131,0.10)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
            style={{ background:'#00d483', opacity:0.07, filter:'blur(30px)' }}/>
          {/* Top laser edge on logo area */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:1,
            background:'linear-gradient(to right, transparent 10%, rgba(0,212,131,0.80) 50%, transparent 90%)',
            boxShadow:'0 0 8px rgba(0,212,131,0.50)',
          }}/>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background:'linear-gradient(135deg,#00d483 0%,#007a4c 100%)',
              boxShadow:'0 0 20px rgba(0,212,131,0.55), 0 0 0 1px rgba(0,212,131,0.25)',
            }}>
            <FolderOpen className="w-4 h-4" style={{ color:'#061a10' }}/>
          </div>
          <h1 className={`font-bold text-base whitespace-nowrap transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}
            style={{ color:'rgba(200,240,220,0.90)' }}>
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
                  ${active ? 'text-[#061a10]' : 'hover:text-white'}`}
                style={active ? {
                  background:'linear-gradient(135deg,#00d483 0%,#009e60 100%)',
                  boxShadow:'0 0 22px rgba(0,212,131,0.40), 0 2px 10px rgba(0,0,0,0.40)',
                  border:'1px solid rgba(0,212,131,0.50)',
                  color:'#061a10',
                } : { color:'rgba(170,220,195,0.70)' }}
              >
                {!active && (
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background:'rgba(0,212,131,0.10)', backdropFilter:'blur(8px)' }}/>
                )}
                <item.icon className={`w-5 h-5 shrink-0 relative z-10 ${active ? '' : 'opacity-60 group-hover:opacity-90'}`}/>
                <span className={`whitespace-nowrap relative z-10 text-sm font-semibold transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
                  {item.label}
                </span>
                {active && <span className="mr-auto text-[10px] opacity-55 relative z-10">✦</span>}
              </Link>
            );
          })}
        </nav>

        {/* Divider SVG */}
        <div className="px-4 py-1 pointer-events-none overflow-hidden" style={{ opacity:0.14 }}>
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
              <User className="w-4 h-4" style={{ color:'rgba(0,212,131,0.75)' }}/>
            </div>
            <div className={`overflow-hidden transition-opacity ${!sidebarOpen ? 'md:opacity-0' : 'opacity-100'}`}>
              <p className="text-sm font-semibold whitespace-nowrap" style={{ color:'rgba(180,240,210,0.88)' }}>
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

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 relative" style={{ zIndex:1 }}>
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 sticky top-0 relative overflow-hidden"
          style={{
            background:'rgba(3,12,8,0.72)',
            backdropFilter:'blur(24px)',
            WebkitBackdropFilter:'blur(24px)',
            borderBottom:'1px solid rgba(0,212,131,0.10)',
            boxShadow:'0 1px 0 rgba(0,212,131,0.06), 0 4px 20px rgba(0,0,0,0.30)',
            zIndex:30,
          }}>
          {/* Header top laser edge */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, height:1,
            background:'linear-gradient(to right, transparent 5%, rgba(0,212,131,0.65) 35%, rgba(0,212,131,0.90) 55%, rgba(0,212,131,0.65) 75%, transparent 95%)',
            boxShadow:'0 0 8px rgba(0,212,131,0.45)',
          }}/>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5"/>
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color:'rgba(0,212,131,0.65)' }}>✦</span>
              <h2 className="font-bold text-base" style={{ color:'rgba(210,245,230,0.93)' }}>
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
