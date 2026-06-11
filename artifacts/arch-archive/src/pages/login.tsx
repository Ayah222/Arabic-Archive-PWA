import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Moon, Sun } from 'lucide-react';

const LeafLogo = () => (
  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 4 C20 9 22 15 19 21 C17 26 11 28 7 25"
      stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M16 4 C12 9 10 15 13 21 C15 26 21 28 25 25"
      stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55"/>
    <path d="M16 4 L16 28"
      stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4"/>
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 rtl relative overflow-hidden">

      {/* ── Background atmosphere ── */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-60"/>
      <div className="absolute -top-[180px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] blob-primary pointer-events-none"/>
      <div className="absolute bottom-0 right-0 w-[380px] h-[380px] blob-primary-sm pointer-events-none"/>
      <div className="absolute top-1/2 left-0 w-[280px] h-[280px] blob-primary-sm pointer-events-none opacity-50"/>

      {/* ── Theme toggle ── */}
      <div className="absolute top-5 left-5 z-20">
        <Button variant="ghost" size="icon" className="rounded-full glass border-border/50">
          {theme === 'light'
            ? <Moon className="w-4 h-4" onClick={toggleTheme}/>
            : <Sun className="w-4 h-4" onClick={toggleTheme}/>}
        </Button>
      </div>

      {/* ── Glass login card ── */}
      <div className="relative z-10 w-full max-w-[420px]">

        {/* Sparkle accents */}
        <span className="absolute -top-4 right-8 text-primary/60 text-xl select-none pointer-events-none">✦</span>
        <span className="absolute -bottom-5 left-10 text-primary/35 text-sm select-none pointer-events-none">✦</span>
        <span className="absolute top-1/3 -left-6 text-primary/20 text-xs select-none pointer-events-none">✦</span>

        <div className="glass-strong rounded-2xl p-8 shadow-2xl shadow-black/60">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 glow-icon"
              style={{
                background: 'linear-gradient(135deg, hsl(162 95% 35%) 0%, hsl(162 95% 22%) 100%)',
                border: '1px solid hsl(162 95% 50% / 0.25)'
              }}>
              <LeafLogo />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1.5">
              نظام إدارة الأرشيف المعماري
            </h1>
            <p className="text-muted-foreground text-sm">تسجيل الدخول للمنصة</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Role selector */}
            <div className="flex p-1 rounded-xl gap-1"
              style={{ background: 'hsl(162 30% 10%)' }}>
              {(['manager', 'entry'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    type === role
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                  style={type === role ? {
                    background: 'linear-gradient(135deg, hsl(162 50% 16%) 0%, hsl(162 40% 12%) 100%)',
                    boxShadow: '0 0 12px hsl(162 95% 42% / 0.18)',
                    border: '1px solid hsl(162 95% 42% / 0.20)'
                  } : {}}
                  onClick={() => setType(role)}
                >
                  {role === 'manager' ? 'مدير النظام' : 'موظف إدخال بيانات'}
                </button>
              ))}
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground/80 text-xs font-medium tracking-wide">
                  اسم المستخدم
                </Label>
                <Input
                  id="username" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required className="text-left h-11 bg-input/60 border-border/60 focus:border-primary/50 focus:ring-primary/20 transition-all"
                  dir="ltr" placeholder="admin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/80 text-xs font-medium tracking-wide">
                  كلمة المرور
                </Label>
                <Input
                  id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required className="text-left h-11 bg-input/60 border-border/60 focus:border-primary/50 focus:ring-primary/20 transition-all"
                  dir="ltr" placeholder="••••••••"
                />
              </div>
            </div>

            {/* Glowing submit button */}
            <button
              type="submit"
              className="w-full h-11 rounded-xl font-bold text-base transition-all glow-btn active:scale-[0.98] mt-2"
              style={{
                background: 'linear-gradient(135deg, hsl(162 95% 40%) 0%, hsl(162 95% 30%) 100%)',
                color: 'hsl(160 38% 4%)',
              }}
            >
              تسجيل الدخول
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 flex items-center justify-center gap-3 opacity-30">
            <div className="h-px flex-1 bg-border"/>
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-primary shrink-0" fill="none">
              <path d="M10 2 C12 6 13 10 11 14 C9 18 5 19 3 17 M10 2 C8 6 7 10 9 14 C11 18 15 19 17 17 M10 2 L10 18"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <div className="h-px flex-1 bg-border"/>
          </div>
        </div>
      </div>

    </div>
  );
}
