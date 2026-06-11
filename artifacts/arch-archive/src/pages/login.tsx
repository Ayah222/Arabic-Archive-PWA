import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Moon, Sun } from 'lucide-react';
import { Button } from '../components/ui/button';

const LeafLogo = () => (
  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
    <path d="M16 4 C20 9 22 15 19 21 C17 26 11 28 7 25" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M16 4 C12 9 10 15 13 21 C15 26 21 28 25 25" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55"/>
    <path d="M16 4 L16 28" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4"/>
    <path d="M16 14 C13 17 10 18 8 17 M16 14 C19 17 22 18 24 17" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.35"/>
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
      style={{ background: '#030c08' }}>

      {/* ══ LAYER 1 — Architectural background photo ══ */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/bg-scene.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 55%',
        opacity: 0.32,
      }}/>

      {/* ══ LAYER 2 — Dark glass overlay ══ */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(2,10,6,0.80) 0%, rgba(4,16,10,0.70) 50%, rgba(2,10,6,0.85) 100%)',
      }}/>

      {/* ══ LAYER 3 — Radial vignette ══ */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 85% 75% at 50% 45%, transparent 25%, rgba(1,6,4,0.60) 100%)',
      }}/>

      {/* ══ LAYER 4 — Neon glow blobs ══ */}
      <div style={{ position:'absolute', width:950, height:650, borderRadius:'50%', background:'#00d483', opacity:0.14, filter:'blur(180px)', top:-380, left:'50%', transform:'translateX(-50%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'#00d483', opacity:0.09, filter:'blur(150px)', bottom:-200, right:-120, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:380, height:380, borderRadius:'50%', background:'#00d483', opacity:0.06, filter:'blur(110px)', top:'30%', left:-100, pointerEvents:'none' }}/>

      {/* ══ LAYER 5 — Laser lines ══ */}
      <div style={{ position:'absolute', height:1, width:'80%', top:'22%', right:0, pointerEvents:'none', background:'linear-gradient(to left, transparent 0%, rgba(0,212,131,0.55) 35%, rgba(0,212,131,0.85) 55%, transparent 100%)', boxShadow:'0 0 10px rgba(0,212,131,0.55), 0 0 26px rgba(0,212,131,0.22)' }}/>
      <div style={{ position:'absolute', height:1, width:'55%', top:'74%', left:0, pointerEvents:'none', background:'linear-gradient(to right, transparent 0%, rgba(0,212,131,0.50) 40%, rgba(0,212,131,0.72) 60%, transparent 100%)', boxShadow:'0 0 8px rgba(0,212,131,0.44)' }}/>
      <div style={{ position:'absolute', height:1, width:'28%', top:'89%', right:'10%', pointerEvents:'none', background:'linear-gradient(to left, transparent 0%, rgba(0,212,131,0.44) 50%, transparent 100%)', boxShadow:'0 0 6px rgba(0,212,131,0.32)' }}/>
      <div style={{ position:'absolute', width:1, height:'46%', top:'8%', left:'17%', pointerEvents:'none', background:'linear-gradient(to bottom, transparent 0%, rgba(0,212,131,0.55) 35%, rgba(0,212,131,0.55) 65%, transparent 100%)', boxShadow:'0 0 8px rgba(0,212,131,0.40)' }}/>
      <div style={{ position:'absolute', width:1, height:'34%', top:'42%', right:'14%', pointerEvents:'none', background:'linear-gradient(to bottom, transparent 0%, rgba(0,212,131,0.44) 40%, rgba(0,212,131,0.44) 60%, transparent 100%)', boxShadow:'0 0 6px rgba(0,212,131,0.28)' }}/>

      {/* ══ LAYER 6 — Grid ══ */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:`linear-gradient(rgba(0,212,131,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,131,0.055) 1px, transparent 1px)`, backgroundSize:'40px 40px' }}/>

      {/* ── Theme toggle ── */}
      <div className="absolute top-5 left-5 z-20">
        <Button variant="ghost" size="icon" className="rounded-full"
          style={{ background:'rgba(0,212,131,0.08)', backdropFilter:'blur(10px)', border:'1px solid rgba(0,212,131,0.14)' }}
          onClick={toggleTheme}>
          {theme === 'light' ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>}
        </Button>
      </div>

      {/* ══ GLASS LOGIN CARD ══ */}
      <div className="relative z-10 w-full max-w-[420px]">

        {/* Sparkles */}
        <span className="absolute -top-5 right-8 select-none pointer-events-none text-xl" style={{ color:'rgba(0,212,131,0.70)' }}>✦</span>
        <span className="absolute -bottom-6 left-10 select-none pointer-events-none text-sm" style={{ color:'rgba(0,212,131,0.42)' }}>✦</span>
        <span className="absolute top-1/3 -left-7 select-none pointer-events-none text-xs" style={{ color:'rgba(0,212,131,0.28)' }}>✦</span>

        <div className="rounded-2xl p-8" style={{
          /* Glass card — real backdrop blur over the scene */
          background: 'rgba(4, 16, 10, 0.62)',
          backdropFilter: 'blur(36px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(36px) saturate(1.4)',
          border: '1px solid rgba(0,212,131,0.18)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,212,131,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>

          {/* Neon top border on card */}
          <div style={{
            position:'absolute', top:0, left:'10%', right:'10%', height:1, borderRadius:'50%',
            background:'linear-gradient(to right, transparent, rgba(0,212,131,0.90), transparent)',
            boxShadow:'0 0 12px rgba(0,212,131,0.60)',
          }}/>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background:'linear-gradient(135deg, #00d483 0%, #007a4c 100%)',
                boxShadow:'0 0 28px rgba(0,212,131,0.55), 0 8px 24px rgba(0,0,0,0.50)',
                border:'1px solid rgba(0,212,131,0.35)',
                color:'#061a10',
              }}>
              <LeafLogo />
            </div>
            <h1 className="text-2xl font-bold mb-1.5" style={{ color:'rgba(215,248,232,0.95)' }}>
              نظام إدارة الأرشيف المعماري
            </h1>
            <p className="text-sm" style={{ color:'rgba(150,205,175,0.60)' }}>
              تسجيل الدخول للمنصة
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selector */}
            <div className="flex p-1 rounded-xl gap-1"
              style={{ background:'rgba(0,212,131,0.06)', border:'1px solid rgba(0,212,131,0.11)' }}>
              {(['manager','entry'] as const).map(role => (
                <button key={role} type="button"
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all"
                  style={type === role ? {
                    background:'linear-gradient(135deg, rgba(0,212,131,0.22) 0%, rgba(0,154,95,0.16) 100%)',
                    boxShadow:'0 0 14px rgba(0,212,131,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
                    border:'1px solid rgba(0,212,131,0.28)',
                    color:'#00d483',
                  } : { color:'rgba(150,205,175,0.52)', border:'1px solid transparent' }}
                  onClick={() => setType(role)}>
                  {role === 'manager' ? 'مدير النظام' : 'موظف إدخال بيانات'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" style={{ color:'rgba(150,205,175,0.72)', fontSize:'0.75rem', letterSpacing:'0.05em' }}>
                  اسم المستخدم
                </Label>
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)}
                  required dir="ltr" placeholder="admin"
                  className="h-11 text-left"
                  style={{ background:'rgba(0,212,131,0.06)', border:'1px solid rgba(0,212,131,0.16)', color:'rgba(215,248,232,0.92)' }}/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" style={{ color:'rgba(150,205,175,0.72)', fontSize:'0.75rem', letterSpacing:'0.05em' }}>
                  كلمة المرور
                </Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required dir="ltr" placeholder="••••••••"
                  className="h-11 text-left"
                  style={{ background:'rgba(0,212,131,0.06)', border:'1px solid rgba(0,212,131,0.16)', color:'rgba(215,248,232,0.92)' }}/>
              </div>
            </div>

            <button type="submit"
              className="w-full h-11 rounded-xl font-bold text-base transition-all active:scale-[0.98]"
              style={{
                background:'linear-gradient(135deg, #00d483 0%, #009e60 100%)',
                color:'#061a10',
                boxShadow:'0 0 30px rgba(0,212,131,0.50), 0 4px 20px rgba(0,0,0,0.45)',
                border:'1px solid rgba(0,212,131,0.40)',
              }}>
              تسجيل الدخول
            </button>
          </form>

          {/* Bottom divider */}
          <div className="mt-8 flex items-center justify-center gap-3" style={{ opacity:0.22 }}>
            <div className="h-px flex-1" style={{ background:'rgba(0,212,131,0.55)' }}/>
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 shrink-0" fill="none" style={{ color:'#00d483' }}>
              <path d="M10 2 C12 6 13 10 11 14 C9 18 5 19 3 17 M10 2 C8 6 7 10 9 14 C11 18 15 19 17 17 M10 2 L10 18"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <div className="h-px flex-1" style={{ background:'rgba(0,212,131,0.55)' }}/>
          </div>
        </div>
      </div>
    </div>
  );
}
