// Auth page — Demo admin credentials + Google OAuth + Email/Password
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { setCurrentUser, getAppLang } from "../../controllers/useGlobal";

const T = {
  ar: {
    title: "مرحباً بك",
    subtitle: "نظام الأرشيف الذكي",
    demoCard: "بيانات الدخول التجريبية",
    demoUser: "اسم المستخدم",
    demoPass: "كلمة المرور",
    demoHint: "اضغط للدخول الفوري بصلاحيات المدير الرئيسي",
    usernameTab: "مدير / موظف",
    googleTab: "Google OAuth",
    usernamePlaceholder: "اسم المستخدم أو البريد الإلكتروني",
    passwordPlaceholder: "كلمة المرور",
    loginBtn: "تسجيل الدخول",
    googleBtn: "متابعة باستخدام Google",
    googleHint: "للموظفين المدعوين عبر Gmail",
    loggingIn: "جاري الدخول...",
    redirect: "جاري التوجيه...",
  },
  en: {
    title: "Welcome",
    subtitle: "Smart Archive System",
    demoCard: "Demo Credentials",
    demoUser: "Username",
    demoPass: "Password",
    demoHint: "Click to sign in instantly as Super Admin",
    usernameTab: "Admin / Staff",
    googleTab: "Google OAuth",
    usernamePlaceholder: "Username or email address",
    passwordPlaceholder: "Password",
    loginBtn: "Sign In",
    googleBtn: "Continue with Google",
    googleHint: "For employees invited via Gmail",
    loggingIn: "Signing in...",
    redirect: "Redirecting...",
  },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lang = getAppLang();
  const t = T[lang];

  const [tab, setTab] = useState<"username" | "google">("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show error from OAuth redirect
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError(decodeURIComponent(err));
  }, [searchParams]);

  // If user already has a valid session, auto-redirect
  useEffect(() => {
    const demoToken = localStorage.getItem("sa_demo_token");
    if (demoToken) {
      const cached = localStorage.getItem("sa_user");
      if (cached) { navigate("/"); return; }
    }
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const res = await fetch(`/api/sa/auth/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const profile = await res.json() as {
              id: string; email: string; name: string; role: string;
              canUpload: boolean; isActive: boolean; jobTitle: string | null; accessExpiresAt: string | null;
            };
            setCurrentUser({
              id: profile.id, email: profile.email, name: profile.name,
              role: profile.role as "super_admin" | "admin" | "employee",
              canUpload: profile.canUpload, isActive: profile.isActive,
              jobTitle: profile.jobTitle, accessExpiresAt: profile.accessExpiresAt,
            });
            navigate("/");
          }
        } catch { /* not logged in */ }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** One-click demo login with admin / admin123 */
  const handleDemoLogin = async () => {
    setUsername("admin");
    setPassword("admin123");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sa/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" }),
      });
      if (!res.ok) throw new Error("فشل الدخول التجريبي");
      const data = await res.json() as { token: string; user: { id: string; email: string; name: string; role: string; canUpload: boolean; isActive: boolean; jobTitle: string | null; accessExpiresAt: string | null } };
      localStorage.setItem("sa_demo_token", data.token);
      setCurrentUser({
        id: data.user.id, email: data.user.email, name: data.user.name,
        role: data.user.role as "super_admin" | "admin" | "employee",
        canUpload: data.user.canUpload, isActive: data.user.isActive,
        jobTitle: data.user.jobTitle, accessExpiresAt: data.user.accessExpiresAt,
      });
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
      setLoading(false);
    }
  };

  /** Manual username/password login */
  const handleUsernameLogin = async () => {
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError(lang === "ar" ? "يرجى إدخال اسم المستخدم وكلمة المرور" : "Please enter username and password");
      return;
    }
    setLoading(true);
    try {
      // Try demo credentials first
      const res = await fetch("/api/sa/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (res.ok) {
        const data = await res.json() as { token: string; user: { id: string; email: string; name: string; role: string; canUpload: boolean; isActive: boolean; jobTitle: string | null; accessExpiresAt: string | null } };
        localStorage.setItem("sa_demo_token", data.token);
        setCurrentUser({
          id: data.user.id, email: data.user.email, name: data.user.name,
          role: data.user.role as "super_admin" | "admin" | "employee",
          canUpload: data.user.canUpload, isActive: data.user.isActive,
          jobTitle: data.user.jobTitle, accessExpiresAt: data.user.accessExpiresAt,
        });
        navigate("/");
        return;
      }

      // Fallback: try as Supabase email/password (for real invited users)
      const emailToTry = username.includes("@") ? username.trim() : null;
      if (emailToTry) {
        const { data: supaData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: emailToTry,
          password,
        });
        if (signInErr) throw signInErr;
        const session = supaData.session;
        if (!session) throw new Error(lang === "ar" ? "لم يتم إنشاء جلسة" : "No session created");

        const profileRes = await fetch(`/api/sa/auth/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!profileRes.ok) {
          const body = await profileRes.json() as { error?: string };
          await supabase.auth.signOut();
          throw new Error(body.error ?? (lang === "ar" ? "غير مصرح لك بالدخول" : "Unauthorized"));
        }
        const profile = await profileRes.json() as {
          id: string; email: string; name: string; role: string;
          canUpload: boolean; isActive: boolean; jobTitle: string | null; accessExpiresAt: string | null;
        };
        setCurrentUser({
          id: profile.id, email: profile.email, name: profile.name,
          role: profile.role as "super_admin" | "admin" | "employee",
          canUpload: profile.canUpload, isActive: profile.isActive,
          jobTitle: profile.jobTitle, accessExpiresAt: profile.accessExpiresAt,
        });
        navigate("/");
        return;
      }

      throw new Error(lang === "ar" ? "اسم المستخدم أو كلمة المرور غير صحيحة" : "Invalid username or password");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (lang === "ar" ? "حدث خطأ" : "An error occurred"));
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/smart-archive/auth/callback`;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (oauthErr) throw oauthErr;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (lang === "ar" ? "حدث خطأ" : "Error"));
      setLoading(false);
    }
  };

  const isDark = document.documentElement.classList.contains("dark");
  const cyBorder = isDark ? "1px solid rgba(0,240,255,0.15)" : "1px solid rgba(99,102,241,0.18)";
  const cyText = isDark ? "#00f0ff" : "#6366f1";
  const panelBg = isDark ? "rgba(10,8,24,0.95)" : "rgba(248,250,255,0.98)";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ background: isDark ? "linear-gradient(135deg, #080612 0%, #0d0a22 60%, #0a0618 100%)" : "linear-gradient(135deg, #f5f7ff 0%, #eef0ff 100%)" }}
    >
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", width: 700, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,240,255,0.12) 0%, transparent 70%)", filter: "blur(80px)", top: -200, right: -100 }} />
        <div style={{ position: "absolute", width: 600, height: 500, background: "radial-gradient(ellipse, rgba(112,0,255,0.15) 0%, transparent 70%)", filter: "blur(100px)", bottom: -150, left: -80 }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: isDark ? "linear-gradient(135deg, #00f0ff, #7000ff)" : "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: isDark ? "0 0 40px rgba(0,240,255,0.35)" : "0 4px 24px rgba(99,102,241,0.35)" }}>
            <span className="text-2xl">🗂️</span>
          </div>
          <h1 className="text-2xl font-black mb-1" style={{ color: isDark ? "#ffffff" : "#1e1b4b" }}>{t.title}</h1>
          <p className="text-sm font-medium" style={{ color: isDark ? "rgba(0,240,255,0.6)" : "rgba(99,102,241,0.7)" }}>{t.subtitle}</p>
        </div>

        {/* ── Demo credentials card ── */}
        <button
          onClick={handleDemoLogin}
          disabled={loading}
          className="w-full mb-5 rounded-2xl p-4 text-right transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group"
          style={{
            background: isDark ? "linear-gradient(135deg, rgba(0,240,255,0.07) 0%, rgba(112,0,255,0.07) 100%)" : "linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(168,85,247,0.07) 100%)",
            border: isDark ? "1px solid rgba(0,240,255,0.25)" : "1px solid rgba(99,102,241,0.25)",
            boxShadow: isDark ? "0 0 0 1px rgba(0,240,255,0.06), 0 4px 20px rgba(0,0,0,0.4)" : "0 4px 16px rgba(99,102,241,0.10)",
          }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
            style={{ background: isDark ? "rgba(0,240,255,0.04)" : "rgba(99,102,241,0.04)" }} />
          <div className="flex items-center justify-between mb-2 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <span className="text-xs font-bold" style={{ color: cyText }}>{t.demoCard}</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: isDark ? "rgba(0,240,255,0.10)" : "rgba(99,102,241,0.10)", color: cyText, border: `1px solid ${cyText}30` }}>
              Super Admin
            </span>
          </div>
          <div className="flex gap-6 relative z-10">
            <div>
              <p className="text-[10px] mb-0.5" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "#9ca3af" }}>{t.demoUser}</p>
              <code className="text-sm font-black" style={{ color: isDark ? "#ffffff" : "#1e1b4b" }}>admin</code>
            </div>
            <div>
              <p className="text-[10px] mb-0.5" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "#9ca3af" }}>{t.demoPass}</p>
              <code className="text-sm font-black" style={{ color: isDark ? "#ffffff" : "#1e1b4b" }}>admin123</code>
            </div>
          </div>
          <p className="text-[11px] mt-2 relative z-10" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "#9ca3af" }}>
            {t.demoHint}
          </p>
        </button>

        {/* ── Main login panel ── */}
        <div className="rounded-2xl p-6"
          style={{ background: panelBg, border: cyBorder, backdropFilter: "blur(24px)", boxShadow: isDark ? "0 24px 60px rgba(0,0,0,0.7)" : "0 20px 50px rgba(31,38,135,0.12)" }}>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 p-1 rounded-xl"
            style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
            {(["username", "google"] as const).map(t2 => (
              <button
                key={t2}
                onClick={() => { setTab(t2); setError(null); }}
                className="flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200"
                style={tab === t2
                  ? { background: isDark ? "rgba(0,240,255,0.10)" : "rgba(99,102,241,0.12)", color: cyText, border: `1px solid ${cyText}30` }
                  : { color: isDark ? "rgba(255,255,255,0.45)" : "#9ca3af", border: "1px solid transparent" }
                }>
                {t2 === "username" ? t.usernameTab : t.googleTab}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171" }}>
              {error}
            </div>
          )}

          {tab === "username" && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder={t.usernamePlaceholder}
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && void handleUsernameLogin()}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                style={{
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                  border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.10)",
                  color: isDark ? "#fff" : "#1e1b4b",
                }}
              />
              <input
                type="password"
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && void handleUsernameLogin()}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                style={{
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                  border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.10)",
                  color: isDark ? "#fff" : "#1e1b4b",
                }}
              />
              <button
                onClick={() => void handleUsernameLogin()}
                disabled={loading}
                className="w-full py-3 rounded-xl font-black text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: isDark ? "linear-gradient(135deg, #00f0ff, #7000ff)" : "linear-gradient(135deg, #6366f1, #a855f7)",
                  color: "#fff",
                  boxShadow: isDark ? "0 4px 20px rgba(0,240,255,0.30)" : "0 4px 16px rgba(99,102,241,0.30)",
                }}>
                {loading ? t.loggingIn : t.loginBtn}
              </button>
            </div>
          )}

          {tab === "google" && (
            <div className="space-y-3">
              <p className="text-sm text-center" style={{ color: isDark ? "rgba(255,255,255,0.50)" : "#9ca3af" }}>
                {t.googleHint}
              </p>
              <button
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: isDark ? "rgba(255,255,255,0.07)" : "#fff",
                  border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(0,0,0,0.14)",
                  color: isDark ? "#fff" : "#1f2937",
                  boxShadow: isDark ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
                }}>
                {/* Google Icon */}
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                {loading ? t.loggingIn : t.googleBtn}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
