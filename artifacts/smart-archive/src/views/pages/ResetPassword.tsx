import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const verifyRecovery = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      const { data } = await supabase.auth.getSession();
      if (active) {
        setValid(Boolean(data.session));
        setChecking(false);
      }
    };

    void verifyRecovery();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && active) {
        setValid(Boolean(session));
        setChecking(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.");
      return;
    }
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("تعذر تغيير كلمة المرور. قد يكون الرابط منتهياً أو سبق استخدامه.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    navigate("/login?reset=success", { replace: true });
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
          <h1 className="text-2xl font-black text-white">تعيين كلمة مرور جديدة</h1>
        </div>

        <div className="rounded-2xl p-5 space-y-4"
          style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.10)", backdropFilter:"blur(24px)" }}>
          {checking ? (
            <p className="text-center text-sm text-white/60 py-6">جاري التحقق من صلاحية الرابط...</p>
          ) : !valid ? (
            <div className="space-y-4 text-center">
              <div className="rounded-xl p-4 text-sm" style={{ background:"rgba(255,60,60,0.10)", border:"1px solid rgba(255,60,60,0.25)", color:"#ff8080" }}>
                الرابط غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً لإعادة تعيين كلمة المرور.
              </div>
              <Link to="/forgot-password" className="inline-block text-sm font-semibold hover:underline" style={{ color:"#00f0ff" }}>
                طلب رابط جديد
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="كلمة المرور الجديدة"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(0,240,255,0.25)" }}
              />
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="تأكيد كلمة المرور الجديدة"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)" }}
              />
              {error && (
                <div className="rounded-xl p-3 text-sm" style={{ background:"rgba(255,60,60,0.10)", border:"1px solid rgba(255,60,60,0.25)", color:"#ff8080" }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl font-black text-white disabled:opacity-50"
                style={{ background:"linear-gradient(135deg,#00f0ff 0%,#7000ff 100%)" }}>
                {loading ? "جاري الحفظ..." : "حفظ كلمة المرور الجديدة"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}