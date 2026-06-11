import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Moon, Sun } from 'lucide-react';
import { Button } from '../components/ui/button';

const LeafLogo = () => (
  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 4 C20 9 22 15 19 21 C17 26 11 28 7 25"
      stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M16 4 C12 9 10 15 13 21 C15 26 21 28 25 25"
      stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55"/>
    <path d="M16 4 L16 28" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4"/>
    <path d="M16 14 C13 17 10 18 8 17 M16 14 C19 17 22 18 24 17"
      stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.35"/>
  </svg>
);

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 rtl relative overflow-hidden"
      style={{ background: 'hsl(160, 38%, 4%)' }}>

      {/* ── GLOW BLOBS ── */}
      {/* Top-center main glow */}
      <div style={{
        position: 'absolute', width: 1000, height: 700, borderRadius: '50%',
        background: '#00d483', opacity: 0.18, filter: 'blur(180px)',
        top: -400, left: '50%', transform: 'translateX(-50%)',
        pointerEvents: 'none',
      }}/>
      {/* Bottom-right secondary glow */}
      <div style={{
        position: 'absolute', width: 650, height: 650, borderRadius: '50%',
        background: '#00d483', opacity: 0.12, filter: 'blur(150px)',
        bottom: -200, right: -150,
        pointerEvents: 'none',
      }}/>
      {/* Left ambient glow */}
      <div style={{
        position: 'absolute', width: 450, height: 450, borderRadius: '50%',
        background: '#00d483', opacity: 0.07, filter: 'blur(120px)',
        top: '30%', left: -150,
        pointerEvents: 'none',
      }}/>

      {/* ── GRID PATTERN ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(0,212,131,0.06) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(0,212,131,0.06) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }}/>

      {/* ── Theme toggle ── */}
      <div className="absolute top-5 left-5 z-20">
        <Button variant="ghost" size="icon" className="rounded-full border border-white/10"
          style={{ background: 'rgba(0,212,131,0.08)', backdropFilter: 'blur(8px)' }}
          onClick={toggleTheme}>
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>
      </div>

      {/* ── GLASS CARD ── */}
      <div className="relative z-10 w-full max-w-[420px]">

        {/* Sparkle decorations */}
        <span className="absolute -top-5 right-8 select-none pointer-events-none text-xl"
          style={{ color: 'rgba(0,212,131,0.65)' }}>✦</span>
        <span className="absolute -bottom-6 left-10 select-none pointer-events-none text-sm"
          style={{ color: 'rgba(0,212,131,0.40)' }}>✦</span>
        <span className="absolute top-1/3 -left-7 select-none pointer-events-none text-xs"
          style={{ color: 'rgba(0,212,131,0.25)' }}>✦</span>

        <div className="rounded-2xl p-8" style={{
          background: 'rgba(12, 28, 20, 0.75)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(0,212,131,0.18)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.60), 0 0 0 1px rgba(0,212,131,0.06)',
        }}>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: 'linear-gradient(135deg, #00d483 0%, #007a4c 100%)',
                boxShadow: '0 0 24px rgba(0,212,131,0.50), 0 8px 20px rgba(0,0,0,0.40)',
                border: '1px solid rgba(0,212,131,0.35)',
                color: '#061a10',
              }}>
              <LeafLogo />
            </div>
            <h1 className="text-2xl font-bold mb-1.5" style={{ color: '#e8f5f0' }}>
              نظام إدارة الأرشيف المعماري
            </h1>
            <p className="text-sm" style={{ color: 'rgba(180,220,200,0.55)' }}>
              تسجيل الدخول للمنصة
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Role selector */}
            <div className="flex p-1 rounded-xl gap-1" style={{ background: 'rgba(0,212,131,0.06)', border: '1px solid rgba(0,212,131,0.10)' }}>
              {(['manager', 'entry'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all"
                  style={type === role ? {
                    background: 'linear-gradient(135deg, rgba(0,212,131,0.22) 0%, rgba(0,154,95,0.18) 100%)',
                    boxShadow: '0 0 14px rgba(0,212,131,0.20)',
                    border: '1px solid rgba(0,212,131,0.28)',
                    color: '#00d483',
                  } : {
                    color: 'rgba(180,220,200,0.50)',
                    border: '1px solid transparent',
                  }}
                  onClick={() => setType(role)}
                >
                  {role === 'manager' ? 'مدير النظام' : 'موظف إدخال بيانات'}
                </button>
              ))}
            </div>

            {/* Input fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" style={{ color: 'rgba(180,220,200,0.70)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  اسم المستخدم
                </Label>
                <Input
                  id="username" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required dir="ltr" placeholder="admin"
                  className="h-11 text-left transition-all"
                  style={{
                    background: 'rgba(0,212,131,0.05)',
                    border: '1px solid rgba(0,212,131,0.15)',
                    color: '#e8f5f0',
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" style={{ color: 'rgba(180,220,200,0.70)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  كلمة المرور
                </Label>
                <Input
                  id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required dir="ltr" placeholder="••••••••"
                  className="h-11 text-left transition-all"
                  style={{
                    background: 'rgba(0,212,131,0.05)',
                    border: '1px solid rgba(0,212,131,0.15)',
                    color: '#e8f5f0',
                  }}
                />
              </div>
            </div>

            {/* Glow submit button */}
            <button
              type="submit"
              className="w-full h-11 rounded-xl font-bold text-base transition-all active:scale-[0.98] mt-1"
              style={{
                background: 'linear-gradient(135deg, #00d483 0%, #009e60 100%)',
                color: '#061a10',
                boxShadow: '0 0 28px rgba(0,212,131,0.45), 0 4px 20px rgba(0,0,0,0.40)',
                border: '1px solid rgba(0,212,131,0.35)',
              }}
            >
              تسجيل الدخول
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 flex items-center justify-center gap-3" style={{ opacity: 0.25 }}>
            <div className="h-px flex-1" style={{ background: 'rgba(0,212,131,0.4)' }}/>
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 shrink-0" fill="none" style={{ color: '#00d483' }}>
              <path d="M10 2 C12 6 13 10 11 14 C9 18 5 19 3 17 M10 2 C8 6 7 10 9 14 C11 18 15 19 17 17 M10 2 L10 18"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <div className="h-px flex-1" style={{ background: 'rgba(0,212,131,0.4)' }}/>
          </div>
        </div>
      </div>
    </div>
  );
}
