import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Moon, Sun } from 'lucide-react';

const BotanicalPanel = () => (
  <svg
    viewBox="0 0 460 600"
    className="absolute inset-0 w-full h-full"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid slice"
  >
    <defs>
      <path id="l-lg" d="M0,-90 C24,-58 30,14 19,68 Q0,82 0,82 Q0,82 -19,68 C-30,14 -24,-58 0,-90Z"/>
      <path id="l-md" d="M0,-60 C16,-40 20,9 13,46 Q0,56 0,56 Q0,56 -13,46 C-20,9 -16,-40 0,-60Z"/>
      <path id="l-sm" d="M0,-38 C11,-25 14,6 9,30 Q0,36 0,36 Q0,36 -9,30 C-14,6 -11,-25 0,-38Z"/>
    </defs>

    {/* Main diagonal branch stem */}
    <path d="M90,610 C115,510 158,398 202,296 C246,194 298,88 332,12"
      stroke="#6dab8c" strokeWidth="2.2" fill="none" opacity="0.28"/>

    {/* Secondary branch — right mid */}
    <path d="M202,296 C244,278 292,266 342,272"
      stroke="#6dab8c" strokeWidth="1.5" fill="none" opacity="0.22"/>

    {/* Secondary branch — upper right */}
    <path d="M248,192 C290,175 338,168 385,176"
      stroke="#6dab8c" strokeWidth="1.3" fill="none" opacity="0.18"/>

    {/* Secondary branch — lower */}
    <path d="M158,392 C200,375 248,368 292,377"
      stroke="#6dab8c" strokeWidth="1.2" fill="none" opacity="0.16"/>

    {/* Branch tip — uppermost */}
    <path d="M332,12 C348,35 358,68 345,98"
      stroke="#6dab8c" strokeWidth="1" fill="none" opacity="0.2"/>

    {/* Large leaves — Mystic Jade tones */}
    <use href="#l-lg" transform="translate(108,510) rotate(-38)" fill="#057569" opacity="0.52"/>
    <use href="#l-lg" transform="translate(175,368) rotate(18)" fill="#057569" opacity="0.46"/>
    <use href="#l-lg" transform="translate(315,268) rotate(-62)" fill="#057569" opacity="0.40"/>

    {/* Frosted Mint leaves */}
    <use href="#l-md" transform="translate(332,12) rotate(6)" fill="#6dab8c" opacity="0.52"/>
    <use href="#l-md" transform="translate(342,272) rotate(60)" fill="#6dab8c" opacity="0.44"/>
    <use href="#l-md" transform="translate(218,182) rotate(-24)" fill="#6dab8c" opacity="0.40"/>
    <use href="#l-md" transform="translate(292,377) rotate(40)" fill="#6dab8c" opacity="0.38"/>
    <use href="#l-md" transform="translate(385,176) rotate(-52)" fill="#6dab8c" opacity="0.34"/>

    {/* Cloud Mint small accent leaves */}
    <use href="#l-sm" transform="translate(398,330) rotate(-46)" fill="#bbd7c8" opacity="0.36"/>
    <use href="#l-sm" transform="translate(52,228) rotate(30)" fill="#bbd7c8" opacity="0.30"/>
    <use href="#l-sm" transform="translate(372,468) rotate(44)" fill="#bbd7c8" opacity="0.26"/>
    <use href="#l-sm" transform="translate(428,108) rotate(-18)" fill="#bbd7c8" opacity="0.24"/>
    <use href="#l-sm" transform="translate(145,148) rotate(10)" fill="#bbd7c8" opacity="0.22"/>

    {/* Midrib lines on two large leaves */}
    <path d="M108,420 L108,600" stroke="#bbd7c8" strokeWidth="0.9" opacity="0.20"/>
    <path d="M188,282 L162,458" stroke="#bbd7c8" strokeWidth="0.9" opacity="0.18"/>

    {/* Small vein lines on large right leaf */}
    <path d="M282,215 C300,226 318,238 330,255" stroke="#bbd7c8" strokeWidth="0.8" opacity="0.15"/>
    <path d="M275,238 C295,248 312,260 322,278" stroke="#bbd7c8" strokeWidth="0.8" opacity="0.12"/>

    {/* Bud circles at branch tips */}
    <circle cx="332" cy="12" r="4.5" fill="#bbd7c8" opacity="0.50"/>
    <circle cx="342" cy="272" r="3.5" fill="#bbd7c8" opacity="0.42"/>
    <circle cx="292" cy="377" r="3" fill="#bbd7c8" opacity="0.36"/>
    <circle cx="385" cy="176" r="3" fill="#bbd7c8" opacity="0.30"/>
    <circle cx="90" cy="610" r="5.5" fill="#6dab8c" opacity="0.28"/>

    {/* Dew-drop light accents */}
    <circle cx="258" cy="132" r="2.2" fill="#bbd7c8" opacity="0.38"/>
    <circle cx="182" cy="448" r="1.8" fill="#bbd7c8" opacity="0.32"/>
    <circle cx="405" cy="248" r="2" fill="#bbd7c8" opacity="0.28"/>
    <circle cx="132" cy="318" r="1.6" fill="#bbd7c8" opacity="0.24"/>
    <circle cx="448" cy="395" r="1.4" fill="#bbd7c8" opacity="0.20"/>
  </svg>
);

const LeafLogo = () => (
  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M16 4 C20 9 22 15 19 21 C17 26 11 28 7 25"
      stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"
    />
    <path
      d="M16 4 C12 9 10 15 13 21 C15 26 21 28 25 25"
      stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55"
    />
    <path
      d="M16 4 L16 28"
      stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4"
    />
    <path
      d="M16 14 C13 17 10 18 8 17 M16 14 C19 17 22 18 24 17"
      stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.35"
    />
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
    <div className="min-h-screen flex rtl">

      {/* ── Form Panel (RIGHT in RTL) ── */}
      <div className="flex-1 lg:max-w-[58%] flex flex-col items-center justify-center p-8 bg-background relative overflow-hidden">

        {/* Mobile-only subtle botanical bg */}
        <div className="lg:hidden absolute top-0 left-0 w-40 h-40 opacity-[0.04] pointer-events-none">
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M80 10 C100 40 105 80 88 110 C72 140 40 150 20 135" stroke="currentColor" strokeWidth="3" className="text-primary" strokeLinecap="round"/>
            <path d="M80 10 C60 40 55 80 72 110 C88 140 120 150 140 135" stroke="currentColor" strokeWidth="3" className="text-primary" strokeLinecap="round" opacity="0.5"/>
            <path d="M80 10 L80 150" stroke="currentColor" strokeWidth="2" className="text-primary" strokeLinecap="round" opacity="0.3"/>
          </svg>
        </div>

        {/* Theme toggle */}
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </Button>
        </div>

        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-primary/25">
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
            <div className="flex p-1 bg-secondary rounded-xl gap-1">
              {(['manager', 'entry'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    type === role
                      ? 'bg-background shadow-sm text-foreground ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setType(role)}
                >
                  {role === 'manager' ? 'مدير النظام' : 'موظف إدخال بيانات'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input
                  id="username" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required className="text-left" dir="ltr" placeholder="admin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required className="text-left" dir="ltr" placeholder="••••••••"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold" size="lg">
              تسجيل الدخول
            </Button>
          </form>

          {/* Botanical divider */}
          <div className="mt-10 flex items-center justify-center gap-3 opacity-35">
            <div className="h-px flex-1 bg-border"/>
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-primary shrink-0" fill="none">
              <path d="M10 2 C12 6 13 10 11 14 C9 18 5 19 3 17 M10 2 C8 6 7 10 9 14 C11 18 15 19 17 17 M10 2 L10 18"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <div className="h-px flex-1 bg-border"/>
          </div>
        </div>
      </div>

      {/* ── Botanical Art Panel (LEFT in RTL) — desktop only ── */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-sidebar flex-col justify-end p-10">
        <BotanicalPanel />

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/60 to-transparent pointer-events-none"/>

        {/* Text content */}
        <div className="relative z-10 text-right">
          <p className="text-sidebar-foreground/45 text-xs uppercase tracking-[0.2em] mb-3 font-medium">
            منصة إنشائية متكاملة
          </p>
          <h2 className="text-sidebar-foreground text-[1.6rem] font-bold leading-snug mb-4">
            إدارة مشاريع المقاولات<br/>باحترافية وكفاءة
          </h2>
          <p className="text-sidebar-foreground/55 text-sm leading-relaxed max-w-[280px] mr-auto ml-0">
            منصة متخصصة لأرشفة وثائق المشاريع الإنشائية وتتبع سير أعمالها بسهولة واحترافية عالية
          </p>

          {/* Feature tags */}
          <div className="flex flex-wrap gap-2 mt-6 justify-end">
            {['أرشفة المستندات', 'إدارة المشاريع', 'تقارير فورية'].map((tag) => (
              <span key={tag} className="text-xs px-3 py-1.5 rounded-full border border-sidebar-foreground/20 text-sidebar-foreground/60">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
