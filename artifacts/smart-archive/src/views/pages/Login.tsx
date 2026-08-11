// Prompt 7 + 8: Login / Register with role-based access
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthActions } from "../../controllers/useGlobal";

type Mode = "login" | "register";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuthActions();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({ username: "", password: "", name: "" });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!form.username.trim() || !form.password.trim()) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    if (mode === "register" && !form.name.trim()) {
      setError("يرجى إدخال الاسم الكامل");
      return;
    }
    try {
      if (mode === "login") {
        await login.mutateAsync({ username: form.username, password: form.password });
      } else {
        await register.mutateAsync({ username: form.username, password: form.password, name: form.name });
      }
      navigate("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "حدث خطأ، يرجى المحاولة مجدداً";
      try {
        const parsed = JSON.parse(msg);
        setError(parsed.error ?? msg);
      } catch {
        setError(msg);
      }
    }
  };

  const isPending = login.isPending || register.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight mb-1" style={{ background: "linear-gradient(90deg,#00f0ff,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            أرشيف ذكي
          </h1>
          <p className="text-sm text-muted-foreground">نظام إدارة الأرشيف الهندسي</p>
        </div>

        {/* Card */}
        <div className="liquid-glass-card rounded-2xl p-6 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-secondary rounded-xl">
            <button
              onClick={() => { setMode("login"); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === "login" ? "bg-primary text-primary-foreground shadow-sm" : "text-secondary-foreground hover:bg-muted"}`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => { setMode("register"); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === "register" ? "bg-primary text-primary-foreground shadow-sm" : "text-secondary-foreground hover:bg-muted"}`}
            >
              حساب جديد
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">الاسم الكامل *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="محمد أحمد"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  dir="rtl"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">اسم المستخدم *</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">كلمة المرور *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                dir="ltr"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.2) 0%, rgba(112,0,255,0.2) 100%)", border: "1px solid rgba(0,240,255,0.3)", color: "#00f0ff" }}
          >
            {isPending ? "جاري..." : mode === "login" ? "دخول" : "إنشاء الحساب"}
          </button>

          {/* Demo accounts hint */}
          {mode === "login" && (
            <div className="rounded-xl p-3 bg-secondary/50 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">حسابات تجريبية:</p>
              <p>مدير: <span className="font-mono text-foreground">admin</span> / <span className="font-mono text-foreground">admin123</span></p>
              <p>موظف: <span className="font-mono text-foreground">entry</span> / <span className="font-mono text-foreground">entry123</span></p>
              <p>عرض: <span className="font-mono text-foreground">viewer</span> / <span className="font-mono text-foreground">viewer123</span></p>
            </div>
          )}

          {mode === "register" && (
            <p className="text-xs text-muted-foreground text-center">
              سيتم إنشاء حسابك بصلاحية «موظف إدخال» ويمكن للمدير ترقيته لاحقاً.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
