import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Eye, EyeOff } from "lucide-react";

type Step = "form" | "pending" | "error";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // Supabase auto-processes the invite hash and sets a session
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setErrorMsg("كلمتا المرور غير متطابقتين"); return; }
    if (password.length < 8) { setErrorMsg("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }

    setLoading(true);
    setErrorMsg("");

    const { data: updateData, error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    const profileResponse = updateData.user
      ? await fetch(`/api/sa/profiles/${updateData.user.id}`)
      : null;
    const profile = profileResponse?.ok ? await profileResponse.json() as { status?: string } : null;

    await supabase.auth.signOut();
    if (profile?.status === "active") {
      navigate("/login", { replace: true });
      return;
    }
    setStep("pending");
    setLoading(false);
  };

  if (step === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl">🧊</div>
          <h1 className="text-2xl font-bold text-foreground">تم إنشاء حسابك بنجاح</h1>
          <p className="text-muted-foreground leading-relaxed">
            حسابك بانتظار موافقة مدير النظام لتفعيل صلاحياتك.
            <br />سيتم إشعارك فور التفعيل.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-600 rounded-xl text-sm font-semibold border border-yellow-500/20">
            ⏳ بانتظار الموافقة
          </div>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-foreground">رابط الدعوة غير صالح أو منتهي الصلاحية</h1>
          <p className="text-muted-foreground text-sm">يرجى التواصل مع المدير للحصول على دعوة جديدة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="text-5xl mb-4">🏛️</div>
          <h1 className="text-2xl font-bold text-foreground">مرحباً بك في منصة الأرشيف</h1>
          <p className="text-muted-foreground mt-2 text-sm">يرجى إعداد كلمة المرور الخاصة بك للمتابعة</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">كلمة المرور الجديدة</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="8 أحرف على الأقل"
                className="w-full px-4 pl-12 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">تأكيد كلمة المرور</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="أعد إدخال كلمة المرور"
                className="w-full px-4 pl-12 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <button type="button" onClick={() => setShowConfirm((value) => !value)}
                aria-label={showConfirm ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-xl px-4 py-2">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 text-sm"
          >
            {loading ? "جاري الحفظ..." : "حفظ ومتابعة"}
          </button>
        </form>
      </div>
    </div>
  );
}
