import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthActions, setCurrentUser } from "../../controllers/useGlobal";
import { useLanguage } from "../../contexts/LanguageContext";
import { supabase } from "../../lib/supabase";
import { Eye, EyeOff, FolderOpen } from "lucide-react";

const Aurora = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    <div style={{ position:"absolute", width:900, height:750, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(0,240,255,0.18) 0%, rgba(0,240,255,0.06) 40%, transparent 70%)", filter:"blur(90px)", top:-320, right:-120 }} />
    <div style={{ position:"absolute", width:750, height:600, background:"radial-gradient(ellipse, rgba(112,0,255,0.22) 0%, rgba(112,0,255,0.06) 45%, transparent 72%)", filter:"blur(110px)", top:-80, left:"12%" }} />
    <div style={{ position:"absolute", width:620, height:520, background:"radial-gradient(ellipse, rgba(255,0,128,0.14) 0%, rgba(112,0,255,0.04) 50%, transparent 74%)", filter:"blur(100px)", bottom:-200, left:-60 }} />
  </div>
);

type Tab = "user" | "admin";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthActions();
  const { lang, dir, t, toggle } = useLanguage();
  const [tab, setTab] = useState<Tab>("user");
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingBlocked, setPendingBlocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    setError(null);
    setPendingBlocked(false);
    setShowPassword(false);
    setForm({ username: "", password: "" });
  };

  const handleSubmit = async () => {
    setError(null);
    setPendingBlocked(false);
    if (!form.username.trim() || !form.password.trim()) { setError(t("fillFields")); return; }

    // ── Admin side: local API ──
    if (tab === "admin") {
      try {
        await login.mutateAsync({ username: form.username, password: form.password });
        navigate("/", { replace: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t("errorOccurred");
        try { setError(JSON.parse(msg).error ?? msg); } catch { setError(msg); }
      }
      return;
    }

    // ── Employee side: Supabase Auth ──
    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: form.username.trim(),
        password: form.password,
      });
      if (authErr) throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");

      // Fetch profile to check status & role
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, email, role, status, hr_access")
        .eq("id", data.user.id)
        .single();

      let accountProfile = profile;
      if (profileErr || !profile) {
        const fallbackResponse = await fetch(`/api/sa/profiles/${data.user.id}`);
        accountProfile = fallbackResponse.ok ? await fallbackResponse.json() : null;
      }
      if (!accountProfile) throw new Error("تعذّر تحميل بيانات الحساب");

      if (accountProfile.status === "pending") {
        await supabase.auth.signOut();
        setPendingBlocked(true);
        setLoading(false);
        return;
      }

      const archiveSession = await fetch("/api/sa/auth/supabase-email-archive-session", {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!archiveSession.ok) {
        await supabase.auth.signOut();
        throw new Error("تعذر تأكيد صلاحية الأرشيف");
      }

      // Best-effort: grants the HR session cookie only if this profile is an
      // admin or has the `hr_access` flag. A non-OK response here is expected
      // (and harmless) for employees without HR access.
      await fetch("/api/sa/auth/supabase-hr-session", {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      }).catch(() => undefined);

      // Store user in session and navigate
      setCurrentUser({
        id: accountProfile.id,
        username: accountProfile.email,
        name: accountProfile.email.split("@")[0],
        role: accountProfile.role as any,
        hrAccess: accountProfile.hr_access === true,
      });
      navigate("/", { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("errorOccurred"));
    } finally {
      setLoading(false);
    }
  };

  const isLoading = tab === "admin" ? login.isPending : loading;

  const activeTabStyle: React.CSSProperties = {
    background: "linear-gradient(135deg,rgba(0,240,255,0.18),rgba(112,0,255,0.18))",
    color: "#00f0ff", border: "1px solid rgba(0,240,255,0.30)", boxShadow: "0 0 16px rgba(0,240,255,0.15)",
  };
  const inactiveTabStyle: React.CSSProperties = { color: "rgba(255,255,255,0.40)", border: "1px solid transparent" };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" dir={dir}
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(18,10,40,1) 0%, rgba(5,4,18,1) 60%)" }}>
      <Aurora />

      {/* Language toggle */}
      <button onClick={toggle}
        className="fixed top-4 left-4 z-50 rounded-xl px-3 h-9 text-xs font-black tracking-wide transition-all hover:scale-105"
        style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.70)" }}>
        {lang === "ar" ? "EN" : "العربية"}
      </button>

      <div className="w-full max-w-sm relative z-10 space-y-5">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
            style={{ background:"linear-gradient(135deg,#00f0ff 0%,#7000ff 100%)", boxShadow:"0 0 40px rgba(0,240,255,0.45), inset 0 1px 1px rgba(255,255,255,0.25)", border:"1px solid rgba(0,240,255,0.35)" }}>
            <FolderOpen className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{t("welcome")}</h1>
            <p className="text-sm mt-0.5" style={{ color:"rgba(0,240,255,0.65)" }}>{t("smartSystem")}</p>
            <p className="text-base font-bold mt-1 text-white/80">{t("loginTitle")}</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.10)", backdropFilter:"blur(24px) saturate(180%)", boxShadow:"0 20px 60px rgba(0,0,0,0.50)" }}>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background:"rgba(255,255,255,0.06)" }}>
            <button onClick={() => switchTab("user")}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200"
              style={tab === "user" ? activeTabStyle : inactiveTabStyle}>
              {t("employee")}
            </button>
            <button onClick={() => switchTab("admin")}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200"
              style={tab === "admin" ? activeTabStyle : inactiveTabStyle}>
              {t("admin")}
            </button>
          </div>

          {/* Pending blocked */}
          {pendingBlocked && (
            <div className="rounded-xl px-4 py-4 text-center space-y-1"
              style={{ background:"rgba(255,200,0,0.07)", border:"1px solid rgba(255,200,0,0.25)" }}>
              <p className="text-2xl">🧊</p>
              <p className="text-sm font-bold" style={{ color:"#f5c518" }}>حسابك بانتظار موافقة المدير</p>
              <p className="text-xs" style={{ color:"rgba(255,255,255,0.45)" }}>سيتم إشعارك فور التفعيل</p>
            </div>
          )}

          {/* Fields */}
          <div className="space-y-3">
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder={tab === "admin" ? "admin" : t("emailField")}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none transition-all"
              style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(0,240,255,0.25)" }}
              dir="ltr"
              onFocus={e => e.currentTarget.style.boxShadow="0 0 16px rgba(0,240,255,0.20)"}
              onBlur={e => e.currentTarget.style.boxShadow="none"} />
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                placeholder={t("passwordField")}
                className="w-full px-4 pl-12 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none transition-all"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)" }}
                dir="ltr"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                onFocus={e => { e.currentTarget.style.border="1px solid rgba(0,240,255,0.30)"; e.currentTarget.style.boxShadow="0 0 16px rgba(0,240,255,0.15)"; }}
                onBlur={e => { e.currentTarget.style.border="1px solid rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow="none"; }} />
              <button type="button" onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {tab === "user" && (
            <div className="text-start">
              <Link to="/forgot-password" className="text-sm font-semibold hover:underline" style={{ color:"#00f0ff" }}>
                هل نسيت كلمة المرور؟
              </Link>
            </div>
          )}

          {searchParams.get("reset") === "success" && (
            <div className="rounded-xl p-3 text-sm" style={{ background:"rgba(0,220,139,0.10)", border:"1px solid rgba(0,220,139,0.25)", color:"#58e8ae" }}>
              تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
            </div>
          )}

          {error && (
            <div className="rounded-xl p-3 text-sm" style={{ background:"rgba(255,60,60,0.10)", border:"1px solid rgba(255,60,60,0.25)", color:"#ff8080" }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={isLoading}
            className="w-full py-3.5 rounded-xl font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{ background:"linear-gradient(135deg,#00f0ff 0%,#7000ff 100%)", color:"#fff", boxShadow:"0 0 30px rgba(0,240,255,0.35), inset 0 1px 1px rgba(255,255,255,0.20)" }}>
            {isLoading ? t("loggingIn") : t("loginBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
