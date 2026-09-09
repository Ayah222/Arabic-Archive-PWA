import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    const base = import.meta.env.BASE_URL || "/";
    const redirectTo = new URL(`${base.replace(/\/?$/, "/")}reset-password`, window.location.origin).toString();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    if (resetError) {
      setError("تعذر إرسال رابط إعادة التعيين حالياً. حاول مرة أخرى لاحقاً.");
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl"
      style={{ background:"radial-gradient(ellipse at 50% 0%, rgba(18,10,40,1) 0%, rgba(5,4,18,1) 60%)" }}>
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
            style={{ background:"linear-gradient(135deg,#00f0ff 0%,#7000ff 100%)", boxShadow:"0 0 40px rgba(0,240,255,0.35)" }}>
            <FolderOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">إعادة ضبط كلمة المرور</h1>
          <p className="text-sm text-white/55">أدخل البريد الإلكتروني المرتبط بحساب الموظف.</p>
        </div>

        <div className="rounded-2xl p-5 space-y-4"
          style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.10)", backdropFilter:"blur(24px)" }}>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-xl p-4 text-sm leading-7"
                style={{ background:"rgba(0,220,139,0.10)", border:"1px solid rgba(0,220,139,0.25)", color:"#7cf1bf" }}>
                إذا كان البريد مسجلاً، فستصله رسالة تحتوي على رابط آمن ومؤقت لإعادة تعيين كلمة المرور.
                الرابط صالح للاستخدام مرة واحدة فقط.
              </div>
              <Link to="/login" className="inline-block text-sm font-semibold hover:underline" style={{ color:"#00f0ff" }}>
                العودة إلى تسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="البريد الإلكتروني"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(0,240,255,0.25)" }}
              />
              {error && (
                <div className="rounded-xl p-3 text-sm" style={{ background:"rgba(255,60,60,0.10)", border:"1px solid rgba(255,60,60,0.25)", color:"#ff8080" }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl font-black text-white disabled:opacity-50"
                style={{ background:"linear-gradient(135deg,#00f0ff 0%,#7000ff 100%)" }}>
                {loading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
              </button>
              <Link to="/login" className="block text-center text-sm text-white/55 hover:text-white">
                العودة إلى تسجيل الدخول
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}