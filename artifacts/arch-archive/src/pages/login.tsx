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

      {/* ── Aurora — Dark: cyan + purple + pink ── */}
      {isDark && (
        <>
          <div style={{ position:'absolute', width:900, height:700, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(0,240,255,0.14) 0%, rgba(0,240,255,0.04) 45%, transparent 72%)', filter:'blur(100px)', top:-320, left:'40%', transform:'translateX(-50%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:600, height:500, background:'radial-gradient(ellipse, rgba(112,0,255,0.16) 0%, rgba(112,0,255,0.05) 50%, transparent 74%)', filter:'blur(110px)', bottom:-200, right:-80, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:400, height:340, background:'radial-gradient(ellipse, rgba(255,0,128,0.10) 0%, transparent 72%)', filter:'blur(90px)', top:'32%', left:-80, pointerEvents:'none' }}/>
        </>
      )}
      {/* ── Aurora — Light: pastel indigo + cyan ── */}
      {!isDark && (
        <>
          <div style={{ position:'absolute', width:800, height:600, background:'radial-gradient(ellipse, rgba(99,102,241,0.09) 0%, transparent 72%)', filter:'blur(90px)', top:-200, right:-100, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:560, height:420, background:'radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 72%)', filter:'blur(100px)', bottom:-140, left:-80, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:400, height:300, background:'radial-gradient(ellipse, rgba(168,85,247,0.06) 0%, transparent 72%)', filter:'blur(90px)', top:'40%', left:'35%', pointerEvents:'none' }}/>
        </>
      )}

      {/* ── Theme toggle ── */}
      <div className="absolute top-5 left-5 z-20">
        <Button variant="ghost" size="icon" className="rounded-full border border-border"
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            boxShadow: isDark ? 'inset 0 1px 1px rgba(255,255,255,0.10)' : 'none',
          }}
          onClick={toggleTheme}>
          {isDark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
        </Button>
      </div>

      {/* ── Login Card — Liquid Glass ── */}
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-2xl p-8 relative"
          style={{
            background: isDark ? 'var(--glass-card-bg)' : 'rgba(255,255,255,0.55)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.80)',
            boxShadow: isDark
              ? 'inset 0 1px 2px rgba(255,255,255,0.12), 0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(0,240,255,0.06)'
              : 'inset 0 1px 3px rgba(255,255,255,0.85), 0 16px 48px rgba(31,38,135,0.08)',
          }}>

          {/* Top liquid edge — cyan-to-purple */}
          <div style={{
            position: 'absolute', top: 0, left: '8%', right: '8%', height: 1,
            background: isDark
              ? 'linear-gradient(to right, transparent, rgba(0,240,255,0.60) 30%, rgba(255,255,255,0.20) 50%, rgba(112,0,255,0.50) 70%, transparent)'
              : 'linear-gradient(to right, transparent, rgba(255,255,255,0.95) 25%, rgba(99,102,241,0.50) 50%, rgba(255,255,255,0.95) 75%, transparent)',
            boxShadow: isDark ? '0 0 12px rgba(0,240,255,0.35)' : 'none',
          }}/>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)'
                  : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                boxShadow: isDark
                  ? 'inset 0 1px 1px rgba(255,255,255,0.25), 0 0 32px rgba(0,240,255,0.45), 0 8px 28px rgba(0,0,0,0.55)'
                  : '0 4px 20px rgba(99,102,241,0.40)',
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
                boxShadow: isDark ? 'inset 0 1px 1px rgba(255,255,255,0.05)' : 'none',
              }}>
              {(['manager', 'entry'] as const).map(role => (
                <button key={role} type="button"
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
                  style={type === role
                    ? {
                        background: isDark
                          ? 'linear-gradient(90deg, rgba(0,240,255,0.18) 0%, rgba(112,0,255,0.14) 100%)'
                          : 'rgba(255,255,255,0.90)',
                        boxShadow: isDark
                          ? 'inset 0 1px 1px rgba(255,255,255,0.10), 0 0 14px rgba(0,240,255,0.18)'
                          : '0 2px 10px rgba(0,0,0,0.07)',
                        border: isDark
                          ? '1px solid rgba(0,240,255,0.25)'
                          : '1px solid rgba(99,102,241,0.28)',
                        color: isDark ? '#00f0ff' : '#4338ca',
                      }
                    : { color: 'var(--color-muted-foreground)', border: '1px solid transparent' }}
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

            {/* Submit */}
            <button type="submit"
              className="w-full h-11 rounded-xl font-bold text-base transition-all duration-200 active:scale-[0.98]"
              style={{
                background: isDark
                  ? 'linear-gradient(90deg, #00f0ff 0%, #7000ff 100%)'
                  : 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
                color: '#ffffff',
                boxShadow: isDark
                  ? 'inset 0 1px 1px rgba(255,255,255,0.25), 0 0 28px rgba(0,240,255,0.40), 0 4px 20px rgba(0,0,0,0.42)'
                  : 'inset 0 1px 1px rgba(255,255,255,0.30), 0 4px 16px rgba(99,102,241,0.38)',
                border: isDark ? '1px solid rgba(0,240,255,0.25)' : '1px solid rgba(99,102,241,0.28)',
              }}>
              تسجيل الدخول
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
