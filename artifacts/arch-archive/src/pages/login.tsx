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
    <div className="min-h-screen flex items-center justify-center p-4 rtl relative overflow-hidden">

      {/* ── Aurora Mesh — dark ── */}
      {isDark && (
        <>
          <div style={{ position:'absolute', width:900, height:700, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(25,211,162,0.16) 0%, rgba(25,211,162,0.05) 45%, transparent 72%)', filter:'blur(95px)', top:-320, left:'40%', transform:'translateX(-50%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:580, height:480, background:'radial-gradient(ellipse, rgba(83,247,192,0.08) 0%, transparent 72%)', filter:'blur(110px)', bottom:-200, right:-80, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:380, height:340, background:'radial-gradient(ellipse, rgba(15,118,110,0.10) 0%, transparent 72%)', filter:'blur(90px)', top:'32%', left:-80, pointerEvents:'none' }}/>
        </>
      )}
      {/* ── Aurora Mesh — light ── */}
      {!isDark && (
        <>
          <div style={{ position:'absolute', width:800, height:600, background:'radial-gradient(ellipse, rgba(20,184,166,0.09) 0%, transparent 72%)', filter:'blur(90px)', top:-200, right:-100, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:560, height:420, background:'radial-gradient(ellipse, rgba(15,118,110,0.06) 0%, transparent 72%)', filter:'blur(100px)', bottom:-140, left:-80, pointerEvents:'none' }}/>
        </>
      )}

      {/* ── Theme toggle ── */}
      <div className="absolute top-5 left-5 z-20">
        <Button variant="ghost" size="icon" className="rounded-full border border-border"
          style={{
            background: isDark ? 'var(--glass-bg)' : 'rgba(255,255,255,0.65)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            boxShadow: isDark ? 'var(--glass-inner-glow)' : 'none',
          }}
          onClick={toggleTheme}>
          {isDark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
        </Button>
      </div>

      {/* ── Login Card — Liquid Glass ── */}
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-2xl p-8 relative"
          style={{
            background: isDark ? 'var(--glass-card-bg)' : 'var(--glass-card-bg)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: `1px solid ${isDark ? 'var(--glass-card-border)' : 'rgba(255,255,255,0.82)'}`,
            boxShadow: isDark
              ? 'var(--glass-inner-glow), 0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(25,211,162,0.06)'
              : 'var(--glass-inner-glow), 0 16px 48px rgba(0,0,0,0.08), 0 0 0 1px rgba(20,184,166,0.12)',
          }}>

          {/* Top liquid edge */}
          <div style={{
            position:'absolute', top:0, left:'8%', right:'8%', height:1,
            background: isDark
              ? 'linear-gradient(to right, transparent, rgba(255,255,255,0.18) 25%, rgba(25,211,162,0.80) 50%, rgba(255,255,255,0.18) 75%, transparent)'
              : 'linear-gradient(to right, transparent, rgba(255,255,255,0.95) 25%, rgba(20,184,166,0.60) 50%, rgba(255,255,255,0.95) 75%, transparent)',
            boxShadow: isDark ? '0 0 12px rgba(25,211,162,0.40)' : 'none',
          }}/>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: 'linear-gradient(135deg, #19D3A2 0%, #0d9488 100%)',
                boxShadow: isDark
                  ? 'var(--glass-inner-glow), 0 0 28px rgba(25,211,162,0.45), 0 8px 24px rgba(0,0,0,0.55)'
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
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.50)',
                border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(255,255,255,0.70)',
                boxShadow: isDark ? 'var(--glass-inner-glow)' : 'none',
                backdropFilter: 'var(--glass-blur)',
                WebkitBackdropFilter: 'var(--glass-blur)',
              }}>
              {(['manager','entry'] as const).map(role => (
                <button key={role} type="button"
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
                  style={type === role
                    ? {
                        background: isDark
                          ? 'linear-gradient(135deg, rgba(25,211,162,0.14) 0%, rgba(25,211,162,0.08) 100%)'
                          : 'rgba(255,255,255,0.92)',
                        boxShadow: isDark
                          ? 'var(--glass-inner-glow), 0 0 12px rgba(25,211,162,0.16)'
                          : '0 2px 10px rgba(0,0,0,0.07)',
                        border: isDark ? '1px solid rgba(25,211,162,0.22)' : '1px solid rgba(255,255,255,0.90)',
                        color: isDark ? '#19D3A2' : '#0d766e',
                      }
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

            {/* Submit — Liquid glass primary button */}
            <button type="submit"
              className="w-full h-11 rounded-xl font-bold text-base transition-all duration-200 active:scale-[0.98] relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #19D3A2 0%, #0d9488 100%)',
                color: isDark ? '#051a14' : '#ffffff',
                boxShadow: isDark
                  ? 'inset 0 1px 1px rgba(255,255,255,0.25), 0 0 28px rgba(25,211,162,0.40), 0 4px 20px rgba(0,0,0,0.42)'
                  : 'inset 0 1px 1px rgba(255,255,255,0.40), 0 4px 16px rgba(13,148,136,0.35)',
                border: '1px solid rgba(25,211,162,0.28)',
              }}>
              تسجيل الدخول
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
