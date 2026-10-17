import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { Eye, EyeOff } from "lucide-react";

type Step = "verify" | "form" | "pending" | "error";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [inviteSupabase] = useState(() => createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "sa-invite-auth-session",
    } },
  ));
  const [step, setStep] = useState<Step>("form");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [pendingOtp, setPendingOtp] = useState<{ tokenHash: string; type: "invite" | "recovery" } | null>(null);

  useEffect(() => {
    // Never let an unrelated session already stored in this browser stand in
    // for an invite that Supabase has explicitly rejected or expired.
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const authError = url.searchParams.get("error_code")
      || url.searchParams.get("error")
      || hashParams.get("error_code")
      || hashParams.get("error");
    if (authError) {
      setInvalidLink(true);
      setHasSession(false);
      setCheckingInvite(false);
      return;
    }

    // The shared URL points to this app, not Supabase's GET /verify endpoint.
    // Wait for an explicit user click before consuming its one-time token so
    // link scanners and previews cannot use it first.
    const tokenHash = url.searchParams.get("token_hash");
    const tokenType = url.searchParams.get("type");
    if (tokenHash && (tokenType === "invite" || tokenType === "recovery")) {
      setPendingOtp({ tokenHash, type: tokenType });
      setStep("verify");
      setCheckingInvite(false);
      return;
    }

    // Supabase auto-processes the invite hash. Listen as well as reading the
    // current session because URL-token exchange may finish after this page mounts.
    let cancelled = false;
    let latestToken = "";
    const validateInviteSession = async (accessToken: string) => {
      if (cancelled || !accessToken || accessToken === latestToken) return;
      latestToken = accessToken;
      setCheckingInvite(true);
      try {
        const response = await fetch("/api/sa/auth/accept-invite", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
        if (cancelled || accessToken !== latestToken) return;
        if (!response.ok || !result?.success) {
          setHasSession(false);
          setInvalidLink(true);
          setErrorMsg(result?.error ?? "رابط الدعوة غير صالح أو منتهي الصلاحية.");
        } else {
          setInvalidLink(false);
          setErrorMsg("");
          setHasSession(true);
        }
      } catch {
        if (!cancelled && accessToken === latestToken) {
          setHasSession(false);
          setInvalidLink(true);
          setErrorMsg("تعذر التحقق من رابط الدعوة. تحققي من اتصال الإنترنت أو اطلبي رابطاً جديداً.");
        }
      } finally {
        if (!cancelled && accessToken === latestToken) setCheckingInvite(false);
      }
    };
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void validateInviteSession(session.access_token);
      } else if (!cancelled) {
        latestToken = "";
        setHasSession(false);
        setCheckingInvite(false);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void validateInviteSession(data.session.access_token);
      } else if (!cancelled) {
        setHasSession(false);
        setCheckingInvite(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setHasSession(false);
        setCheckingInvite(false);
      }
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const verifyInvite = async () => {
    if (!pendingOtp || checkingInvite) return;
    setCheckingInvite(true);
    setErrorMsg("");
    // The token is now kept only in component memory; remove it from address
    // history before verification and before any further page/resource loads.
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      // Keep invitation auth isolated from any signed-in manager/employee
      // session and in-memory auth listeners elsewhere in the application.
      const { data, error } = await inviteSupabase.auth.verifyOtp({
        token_hash: pendingOtp.tokenHash,
        type: pendingOtp.type,
      });
      if (error || !data.session) {
        throw new Error("انتهت صلاحية رابط الدعوة أو سبق استخدامه. اطلبي رابطاً جديداً من المدير.");
      }

      const validationResponse = await fetch("/api/sa/auth/accept-invite", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const validation = await validationResponse.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!validationResponse.ok || !validation?.success) {
        throw new Error(validation?.error ?? "تعذر التحقق من عضوية الدعوة.");
      }

      window.history.replaceState({}, document.title, window.location.pathname);
      setPendingOtp(null);
      setInvalidLink(false);
      setHasSession(true);
      setStep("form");
    } catch (error) {
      await inviteSupabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      setErrorMsg(error instanceof Error ? error.message : "تعذر التحقق من رابط الدعوة.");
      setInvalidLink(true);
      setStep("error");
    } finally {
      setCheckingInvite(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUpdated && password !== confirm) { setErrorMsg("كلمتا المرور غير متطابقتين"); return; }
    if (!passwordUpdated && password.length < 8) { setErrorMsg("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }

    setLoading(true);
    setErrorMsg("");

    try {
      if (!passwordUpdated) {
        const { data: updateData, error } = await inviteSupabase.auth.updateUser({ password });
        if (error || !updateData.user) throw new Error(error?.message ?? "تعذر تحديث الحساب");
        setPasswordUpdated(true);
      }

      const { data: sessionData, error: sessionError } = await inviteSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) throw new Error("انتهت صلاحية رابط الدعوة، اطلب رابطاً جديداً");

      const activationResponse = await fetch("/api/sa/auth/accept-invite", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const activation = await activationResponse.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!activationResponse.ok || !activation?.success) {
        throw new Error(activation?.error
          ? `تم تحديث كلمة المرور، لكن تعذر تفعيل العضوية: ${activation.error}`
          : "تم تحديث كلمة المرور، لكن تعذر تفعيل عضوية المؤسسة");
      }

      await inviteSupabase.auth.signOut({ scope: "local" });
      navigate("/login", { replace: true });
    } catch (submitError: unknown) {
      setErrorMsg(submitError instanceof Error ? submitError.message : "حدث خطأ أثناء تفعيل الدعوة");
      const { data: sessionData } = await inviteSupabase.auth.getSession();
      setStep(sessionData.session ? "form" : "error");
    } finally {
      setLoading(false);
    }
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

  if (step === "verify") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="text-5xl">🏛️</div>
          <h1 className="text-2xl font-bold text-foreground">تم استلام دعوة الانضمام</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            اضغطي على الزر أدناه للتحقق من الدعوة والمتابعة إلى إعداد كلمة المرور.
          </p>
          {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
          <button
            type="button"
            onClick={() => void verifyInvite()}
            disabled={checkingInvite}
            className="w-full max-w-xs py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60"
          >
            {checkingInvite ? "جاري التحقق..." : "متابعة وتعيين كلمة المرور"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-foreground">تعذر إكمال الدعوة</h1>
          <p className="text-muted-foreground text-sm">{errorMsg}</p>
          <p className="text-muted-foreground text-sm">يرجى التواصل مع المدير للحصول على رابط دعوة جديد.</p>
        </div>
      </div>
    );
  }

  if (invalidLink || !hasSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">{checkingInvite ? "⏳" : "⚠️"}</div>
          <h1 className="text-xl font-bold text-foreground">
            {checkingInvite ? "جاري التحقق من رابط الدعوة" : "رابط الدعوة غير صالح أو منتهي الصلاحية"}
          </h1>
          {checkingInvite ? (
            <p className="text-muted-foreground text-sm">لحظة من فضلك...</p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{errorMsg || "قد يكون الرابط منتهي الصلاحية أو سبق استخدامه."}</p>
              <p className="text-muted-foreground text-sm">لا تعيدي إدخال كلمة المرور من هذه الصفحة؛ تواصلي مع المدير لإصدار رابط تفعيل جديد.</p>
            </>
          )}
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
            {loading ? "جاري الحفظ..." : passwordUpdated ? "إعادة محاولة التفعيل" : "حفظ ومتابعة"}
          </button>
        </form>
      </div>
    </div>
  );
}
