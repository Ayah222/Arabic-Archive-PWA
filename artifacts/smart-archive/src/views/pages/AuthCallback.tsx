// OAuth callback page — handles redirect from Supabase/Google
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { setCurrentUser } from "../../controllers/useGlobal";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("جاري التحقق من هويتك...");

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      // Wait briefly for Supabase to parse the URL hash / search params
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        setMessage("فشل التحقق من الهوية، جاري إعادة التوجيه...");
        setTimeout(() => navigate("/login?error=auth_failed"), 1500);
        return;
      }

      try {
        // Root-relative so it resolves to the API artifact, same as useGlobal.ts
        const res = await fetch(`/api/sa/auth/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          await supabase.auth.signOut();
          const msg = encodeURIComponent(
            body.error ?? "غير مصرح لك بالدخول",
          );
          setMessage(body.error ?? "غير مصرح...");
          setTimeout(() => navigate(`/login?error=${msg}`), 1800);
          return;
        }

        const profile = (await res.json()) as {
          id: string;
          email: string;
          name: string;
          role: string;
          canUpload: boolean;
          isActive: boolean;
          jobTitle: string | null;
          accessExpiresAt: string | null;
        };

        setCurrentUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role as "super_admin" | "admin" | "employee",
          canUpload: profile.canUpload,
          isActive: profile.isActive,
          jobTitle: profile.jobTitle,
          accessExpiresAt: profile.accessExpiresAt,
        });

        setMessage("تم التحقق بنجاح! جاري التوجيه...");
        setTimeout(() => navigate("/"), 300);
      } catch {
        setMessage("خطأ في الاتصال، يرجى المحاولة مجدداً");
        setTimeout(() => navigate("/login?error=network"), 2000);
      }
    };

    void handleCallback();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      dir="rtl"
      style={{ background: "var(--background, #080612)" }}
    >
      <div className="text-center space-y-5">
        <div
          className="w-14 h-14 border-4 border-t-transparent rounded-full animate-spin mx-auto"
          style={{ borderColor: "#00f0ff", borderTopColor: "transparent" }}
        />
        <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
          {message}
        </p>
      </div>
    </div>
  );
}
