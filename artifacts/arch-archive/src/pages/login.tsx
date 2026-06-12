import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Moon, Sun } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function Login() {
  const { login, theme, toggleTheme } = useAppContext();
  const [, setLocation] = useLocation();
  const [type, setType] = useState<'manager' | 'entry'>('manager');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(type);
    setLocation('/dashboard');
  };

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 rtl relative overflow-hidden"
      style={{ background: isDark ? '#0B0F12' : '#F8FAFC' }}>

      {/* ── DARK MODE: Aurora mesh ── */}
      {isDark && (
        <>
          <div style={{ position:'absolute', width:900, height:700, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(25,211,162,0.20) 0%, rgba(25,211,162,0.07) 40%, transparent 70%)', filter:'blur(90px)', top:-320, left:'40%', transform:'translateX(-50%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:600, height:500, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(83,247,192,0.10) 0%, rgba(25,211,162,0.04) 55%, transparent 75%)', filter:'blur(100px)', bottom:-200, right:-80, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:400, height:350, background:'radial-gradient(ellipse, rgba(15,118,110,0.12) 0%, transparent 70%)', filter:'blur(80px)', top:'35%', left:-80, pointerEvents:'none' }}/>
        </>
      )}

      {/* ── LIGHT MODE: subtle mint wash ── */}
      {!isDark && (
        <>
          <div style={{ position:'absolute', width:800, height:600, background:'radial-gradient(ellipse, rgba(20,184,166,0.10) 0%, transparent 70%)', filter:'blur(90px)', top:-200, right:-100, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:600, height:450, background:'radial-gradient(ellipse, rgba(15,118,110,0.07) 0%, transparent 70%)', filter:'blur(100px)', bottom:-150, left:-80, pointerEvents:'none' }}/>
        </>
      )}

      {/* ── Theme toggle ── */}
      <div className="absolute top-5 left-5 z-20">
        <Button variant="ghost" size="icon" className="rounded-full border border-border bg-card/80" onClick={toggleTheme}>
          {isDark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
        </Button>
      </div>

      {/* ── Login Card ── */}
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-2xl p-8 relative"
          style={isDark ? {
            background: 'rgba(18, 24, 29, 0.80)',
            backdropFilter: 'blur(40px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
            border: '1px solid rgba(25,211,162,0.14)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)',
          } : {
            background: 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(20,184,166,0.18)',
            boxShadow: '0 8px 40px rgba(15,118,110,0.10), 0 2px 8px rgba(0,0,0,0.05)',
          }}>

          {/* Top accent line */}
          <div style={{
            position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, borderRadius: 1,
            background: isDark
              ? 'linear-gradient(to right, transparent, rgba(25,211,162,0.90), transparent)'
              : 'linear-gradient(to right, transparent, rgba(20,184,166,0.70), transparent)',
            boxShadow: isDark ? '0 0 12px rgba(25,211,162,0.50)' : 'none',
          }}/>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: 'linear-gradient(135deg, #19D3A2 0%, #0d9488 100%)',
                boxShadow: isDark
                  ? '0 0 30px rgba(25,211,162,0.50), 0 8px 24px rgba(0,0,0,0.55)'
                  : '0 4px 20px rgba(13,148,136,0.35)',
              }}>
              <svg viewBox="0 0 32 32" className="w-8 h-8 text-white" fill="none">
                <path d="M16 4 C20 9 22 15 19 21 C17 26 11 28 7 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 4 C12 9 10 15 13 21 C15 26 21 28 25 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                <path d="M16 4 L16 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-1.5 text-foreground">نظام إدارة الأرشيف المعماري</h1>
            <p className="text-sm text-muted-foreground">تسجيل الدخول للمنصة</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role toggle */}
            <div className="flex p-1 rounded-xl gap-1"
              style={isDark
                ? { background:'rgba(25,211,162,0.05)', border:'1px solid rgba(25,211,162,0.10)' }
                : { background:'rgba(20,184,166,0.07)', border:'1px solid rgba(20,184,166,0.18)' }}>
              {(['manager','entry'] as const).map(role => (
                <button key={role} type="button"
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
                  style={type === role
                    ? isDark
                      ? { background:'rgba(25,211,162,0.14)', boxShadow:'0 0 12px rgba(25,211,162,0.18)', border:'1px solid rgba(25,211,162,0.24)', color:'#19D3A2' }
                      : { background:'white', boxShadow:'0 2px 10px rgba(0,0,0,0.08)', border:'1px solid rgba(20,184,166,0.30)', color:'#0F766E' }
                    : { color:'var(--color-muted-foreground)', border:'1px solid transparent' }}
                  onClick={() => setType(role)}>
                  {role === 'manager' ? 'مدير النظام' : 'موظف إدخال بيانات'}
                </button>
              ))}
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-medium text-muted-foreground tracking-wide">اسم المستخدم</Label>
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required dir="ltr" placeholder="admin" className="h-11 text-left"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground tracking-wide">كلمة المرور</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required dir="ltr" placeholder="••••••••" className="h-11 text-left"/>
              </div>
            </div>

            <button type="submit"
              className="w-full h-11 rounded-xl font-bold text-base transition-all duration-200 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #19D3A2 0%, #0d9488 100%)',
                color: isDark ? '#051a14' : '#ffffff',
                boxShadow: isDark
                  ? '0 0 28px rgba(25,211,162,0.45), 0 4px 20px rgba(0,0,0,0.45)'
                  : '0 4px 16px rgba(13,148,136,0.38)',
                border: '1px solid rgba(25,211,162,0.30)',
              }}>
              تسجيل الدخول
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
