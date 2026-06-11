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
      style={{ background: isDark ? 'hsl(160, 38%, 4%)' : 'hsl(148, 22%, 96%)' }}>

      {/* ── DARK MODE atmosphere ── */}
      {isDark && (
        <>
          {/* Glow blobs */}
          <div style={{ position:'absolute', width:950, height:650, borderRadius:'50%', background:'#00d483', opacity:0.16, filter:'blur(180px)', top:-380, left:'50%', transform:'translateX(-50%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'#00d483', opacity:0.10, filter:'blur(150px)', bottom:-200, right:-120, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:380, height:380, borderRadius:'50%', background:'#00d483', opacity:0.06, filter:'blur(110px)', top:'30%', left:-100, pointerEvents:'none' }}/>
          {/* Laser lines */}
          <div style={{ position:'absolute', height:1, width:'80%', top:'22%', right:0, pointerEvents:'none', background:'linear-gradient(to left, transparent 0%, rgba(0,212,131,0.55) 35%, rgba(0,212,131,0.85) 55%, transparent 100%)', boxShadow:'0 0 10px rgba(0,212,131,0.55), 0 0 26px rgba(0,212,131,0.22)' }}/>
          <div style={{ position:'absolute', height:1, width:'55%', top:'74%', left:0, pointerEvents:'none', background:'linear-gradient(to right, transparent 0%, rgba(0,212,131,0.50) 40%, rgba(0,212,131,0.72) 60%, transparent 100%)', boxShadow:'0 0 8px rgba(0,212,131,0.44)' }}/>
          <div style={{ position:'absolute', width:1, height:'46%', top:'8%', left:'17%', pointerEvents:'none', background:'linear-gradient(to bottom, transparent 0%, rgba(0,212,131,0.55) 35%, rgba(0,212,131,0.55) 65%, transparent 100%)', boxShadow:'0 0 8px rgba(0,212,131,0.40)' }}/>
          {/* Grid */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(0,212,131,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,131,0.055) 1px, transparent 1px)', backgroundSize:'40px 40px' }}/>
        </>
      )}

      {/* ── LIGHT MODE atmosphere ── */}
      {!isDark && (
        <>
          {/* Soft green gradient top */}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, hsl(148,30%,94%) 0%, hsl(162,40%,90%) 50%, hsl(148,22%,96%) 100%)', pointerEvents:'none' }}/>
          {/* Soft decorative circles */}
          <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'hsl(162,70%,50%)', opacity:0.06, filter:'blur(100px)', top:-200, right:-100, pointerEvents:'none' }}/>
          <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'hsl(162,70%,50%)', opacity:0.05, filter:'blur(80px)', bottom:-100, left:-80, pointerEvents:'none' }}/>
        </>
      )}

      {/* ── Theme toggle ── */}
      <div className="absolute top-5 left-5 z-20">
        <Button variant="ghost" size="icon" className="rounded-full border border-border bg-card/80" onClick={toggleTheme}>
          {isDark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
        </Button>
      </div>

      {/* ── CARD ── */}
      <div className="relative z-10 w-full max-w-[420px]">

        {isDark && (
          <>
            <span className="absolute -top-5 right-8 select-none pointer-events-none text-xl" style={{ color:'rgba(0,212,131,0.70)' }}>✦</span>
            <span className="absolute -bottom-6 left-10 select-none pointer-events-none text-sm" style={{ color:'rgba(0,212,131,0.42)' }}>✦</span>
          </>
        )}

        <div className="rounded-2xl p-8 relative"
          style={isDark ? {
            background: 'rgba(4, 16, 10, 0.65)',
            backdropFilter: 'blur(36px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(36px) saturate(1.4)',
            border: '1px solid rgba(0,212,131,0.18)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(0,212,131,0.06)',
          } : {
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(5,117,105,0.15)',
            boxShadow: '0 8px 40px rgba(5,117,105,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}>

          {/* Dark-mode top laser edge */}
          {isDark && (
            <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:'linear-gradient(to right, transparent, rgba(0,212,131,0.90), transparent)', boxShadow:'0 0 12px rgba(0,212,131,0.55)' }}/>
          )}
          {/* Light-mode top accent line */}
          {!isDark && (
            <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:2, borderRadius:2, background:'linear-gradient(to right, transparent, hsl(162,70%,50%), transparent)' }}/>
          )}

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: 'linear-gradient(135deg, #00d483 0%, #007a4c 100%)',
                boxShadow: isDark
                  ? '0 0 28px rgba(0,212,131,0.55), 0 8px 24px rgba(0,0,0,0.50)'
                  : '0 4px 20px rgba(0,154,96,0.40)',
                color: '#061a10',
              }}>
              <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
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
                ? { background:'rgba(0,212,131,0.06)', border:'1px solid rgba(0,212,131,0.11)' }
                : { background:'hsl(148,20%,91%)', border:'1px solid hsl(162,30%,82%)' }}>
              {(['manager','entry'] as const).map(role => (
                <button key={role} type="button"
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all"
                  style={type === role
                    ? isDark
                      ? { background:'linear-gradient(135deg,rgba(0,212,131,0.22),rgba(0,154,95,0.16))', boxShadow:'0 0 14px rgba(0,212,131,0.22)', border:'1px solid rgba(0,212,131,0.28)', color:'#00d483' }
                      : { background:'white', boxShadow:'0 2px 8px rgba(0,0,0,0.10)', border:'1px solid hsl(162,30%,75%)', color:'hsl(174,92%,24%)' }
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
              className="w-full h-11 rounded-xl font-bold text-base transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #00d483 0%, #009e60 100%)',
                color: '#061a10',
                boxShadow: isDark
                  ? '0 0 30px rgba(0,212,131,0.50), 0 4px 20px rgba(0,0,0,0.45)'
                  : '0 4px 16px rgba(0,154,96,0.40)',
                border: '1px solid rgba(0,212,131,0.35)',
              }}>
              تسجيل الدخول
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
