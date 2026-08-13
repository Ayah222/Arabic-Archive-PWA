import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthActions } from "../../controllers/useGlobal";
import { FolderOpen, Zap } from "lucide-react";

const Aurora = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    <div style={{ position:"absolute", width:900, height:750, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(0,240,255,0.18) 0%, rgba(0,240,255,0.06) 40%, transparent 70%)", filter:"blur(90px)", top:-320, right:-120 }} />
    <div style={{ position:"absolute", width:750, height:600, background:"radial-gradient(ellipse, rgba(112,0,255,0.22) 0%, rgba(112,0,255,0.06) 45%, transparent 72%)", filter:"blur(110px)", top:-80, left:"12%" }} />
    <div style={{ position:"absolute", width:620, height:520, background:"radial-gradient(ellipse, rgba(255,0,128,0.14) 0%, rgba(112,0,255,0.04) 50%, transparent 74%)", filter:"blur(100px)", bottom:-200, left:-60 }} />
    <div style={{ position:"absolute", width:400, height:320, background:"radial-gradient(ellipse, rgba(0,240,255,0.09) 0%, transparent 70%)", filter:"blur(80px)", top:"48%", right:"5%" }} />
  </div>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthActions();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!form.username.trim() || !form.password.trim()) {
      setError("يرجى ملء جميع الحقول");
      return;
    }
    try {
      await login.mutateAsync({ username: form.username, password: form.password });
      navigate("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "حدث خطأ، يرجى المحاولة مجدداً";
      try { setError(JSON.parse(msg).error ?? msg); } catch { setError(msg); }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" dir="rtl"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(18,10,40,1) 0%, rgba(5,4,18,1) 60%)" }}>
      <Aurora />

      <div className="w-full max-w-sm relative z-10 space-y-5">

        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center relative"
            style={{ background:"linear-gradient(135deg,#00f0ff 0%,#7000ff 100%)", boxShadow:"0 0 40px rgba(0,240,255,0.45), inset 0 1px 1px rgba(255,255,255,0.25)", border:"1px solid rgba(0,240,255,0.35)" }}>
            <FolderOpen className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">مرحباً بك</h1>
            <p className="text-sm mt-0.5" style={{ color:"rgba(0,240,255,0.65)" }}>نظام الأرشيف الذكي</p>
          </div>
        </div>

        {/* Demo credentials card */}
        <div className="rounded-2xl p-4"
          style={{ background:"rgba(0,240,255,0.04)", border:"1px solid rgba(0,240,255,0.15)", backdropFilter:"blur(20px)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color:"#fbbf24" }} />
              <span className="text-sm font-bold text-white">بيانات الدخول التجريبية</span>
            </div>
            <span className="text-[10px] font-black px-2 py-1 rounded-full"
              style={{ background:"rgba(0,240,255,0.12)", color:"#00f0ff", border:"1px solid rgba(0,240,255,0.25)" }}>
              Super Admin
            </span>
          </div>
          <div className="flex items-center justify-between text-xs" style={{ color:"rgba(255,255,255,0.50)" }}>
            <span>اسم المستخدم</span>
            <span>كلمة المرور</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="font-mono text-sm font-bold text-white">admin</span>
            <span className="font-mono text-sm font-bold text-white">admin123</span>
          </div>
          <button
            onClick={() => setForm({ username:"admin", password:"admin123" })}
            className="w-full mt-3 text-xs py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
            style={{ background:"rgba(0,240,255,0.10)", color:"#00f0ff", border:"1px solid rgba(0,240,255,0.20)" }}>
            اضغط للدخول الفوري بصلاحيات الأدمن الرئيسي
          </button>
        </div>

        {/* Login card */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.10)", backdropFilter:"blur(24px) saturate(180%)", boxShadow:"0 20px 60px rgba(0,0,0,0.50)" }}>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background:"rgba(255,255,255,0.06)" }}>
            <button className="flex-1 py-2 rounded-lg text-sm font-bold"
              style={{ background:"linear-gradient(135deg,rgba(0,240,255,0.18),rgba(112,0,255,0.18))", color:"#00f0ff", border:"1px solid rgba(0,240,255,0.30)", boxShadow:"0 0 16px rgba(0,240,255,0.15)" }}>
              تسجيل الدخول
            </button>
            <button className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ color:"rgba(255,255,255,0.35)" }} disabled>
              مدير / موظف
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="اسم المستخدم أو البريد الإلكتروني"
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none transition-all"
              style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(0,240,255,0.30)", boxShadow:"0 0 0 0 transparent" }}
              dir="rtl"
              onFocus={e => e.currentTarget.style.boxShadow="0 0 16px rgba(0,240,255,0.20)"}
              onBlur={e => e.currentTarget.style.boxShadow="none"}
            />
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="كلمة المرور"
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none transition-all"
              style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)" }}
              dir="rtl"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              onFocus={e => { e.currentTarget.style.border="1px solid rgba(0,240,255,0.30)"; e.currentTarget.style.boxShadow="0 0 16px rgba(0,240,255,0.15)"; }}
              onBlur={e => { e.currentTarget.style.border="1px solid rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow="none"; }}
            />
          </div>

          {error && (
            <div className="rounded-xl p-3 text-sm" style={{ background:"rgba(255,60,60,0.10)", border:"1px solid rgba(255,60,60,0.25)", color:"#ff8080" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={login.isPending}
            className="w-full py-3.5 rounded-xl font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{ background:"linear-gradient(135deg,#00f0ff 0%,#7000ff 100%)", color:"#fff", boxShadow:"0 0 30px rgba(0,240,255,0.35), inset 0 1px 1px rgba(255,255,255,0.20)" }}>
            {login.isPending ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>
        </div>
      </div>
    </div>
  );
}
