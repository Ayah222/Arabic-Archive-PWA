import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCurrentUser, setCurrentUser } from "./controllers/useGlobal";
import { getArchivePermissions } from "./controllers/permissions";
import { supabase } from "./lib/supabase";
import { LanguageProvider } from "./contexts/LanguageContext";
import MainLayout from "./views/layouts/MainLayout";
import Dashboard from "./views/pages/Dashboard";
import Projects from "./views/pages/Projects";
import Agencies from "./views/pages/Agencies";
import ProjectDetail from "./views/pages/ProjectDetail";
import ProjectReport from "./views/pages/ProjectReport";
import AttachmentPreview from "./views/pages/AttachmentPreview";
import AllContractors from "./views/pages/AllContractors";
import AllContracts from "./views/pages/AllContracts";
import AllMeetings from "./views/pages/AllMeetings";
import AllLetters from "./views/pages/AllLetters";
import SearchPage from "./views/pages/Search";
import FinancialArchive from "./views/pages/FinancialArchive";
import Notifications from "./views/pages/Notifications";
import NotFound from "./views/pages/NotFound";
import ReportsPage from "./views/pages/Reports";
import FAQPage from "./views/pages/FAQ";
import LoginPage from "./views/pages/Login";
import ForgotPassword from "./views/pages/ForgotPassword";
import ResetPassword from "./views/pages/ResetPassword";
import UsersPage from "./views/pages/Users";
import AcceptInvite from "./views/pages/AcceptInvite";
import OnboardingTour from "./views/components/shared/OnboardingTour";
import EmailArchive from "./views/pages/EmailArchive";
import HRHome from "./views/pages/hr/HRHome";
import HREmployees from "./views/pages/hr/HREmployees";
import HREmployeeDetail from "./views/pages/hr/HREmployeeDetail";
import HRCandidates from "./views/pages/hr/HRCandidates";
import HRCorporate from "./views/pages/hr/HRCorporate";
import Chat from "./views/pages/Chat";
import PwaInstallPrompt from "./views/components/shared/PwaInstallPrompt";

const BASE = import.meta.env.BASE_URL;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function AppUpdateNotice() {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const checkVersion = async () => {
      try {
        const response = await fetch("/api/sa/app-version", { cache: "no-store" });
        if (!response.ok) return;
        const { version } = (await response.json()) as { version?: string };
        if (!version || stopped) return;
        const knownVersion = localStorage.getItem("sa-app-version");
        if (!knownVersion) localStorage.setItem("sa-app-version", version);
        else if (knownVersion !== version) setAvailableVersion(version);
      } catch {
        // Updating is optional; the app remains usable when offline.
      }
    };
    void checkVersion();
    const interval = window.setInterval(() => { void checkVersion(); }, 120000);
    window.addEventListener("focus", checkVersion);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkVersion);
    };
  }, []);

  if (!availableVersion) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card p-3 shadow-2xl">
      <span className="text-sm font-medium">توجد نسخة أحدث من التطبيق</span>
      <button
        onClick={async () => {
          localStorage.setItem("sa-app-version", availableVersion);
          const registration = await navigator.serviceWorker?.getRegistration();
          await registration?.update();
          window.location.reload();
        }}
        className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
      >
        تحديث الآن
      </button>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  return getCurrentUser() ? <Navigate to="/" replace /> : <LoginPage />;
}

function ScrollPositionRestoration() {
  const location = useLocation();
  const storageKey = `sa-scroll:${location.pathname}${location.search}`;

  useEffect(() => {
    let frame = 0;
    let restoreTimer = 0;
    let lateRestoreTimer = 0;
    const savePosition = () => {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(savePosition);
    };
    const savedPosition = sessionStorage.getItem(storageKey);
    if (savedPosition !== null) {
      const restore = () => window.scrollTo(0, Number(savedPosition));
      frame = requestAnimationFrame(restore);
      restoreTimer = window.setTimeout(restore, 150);
      lateRestoreTimer = window.setTimeout(restore, 800);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", savePosition);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(restoreTimer);
      window.clearTimeout(lateRestoreTimer);
      savePosition();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", savePosition);
    };
  }, [storageKey]);

  return null;
}

export default function App() {
  const [, setAuthRevision] = useState(0);

  useEffect(() => {
    const handleAuthUpdate = () => setAuthRevision((value) => value + 1);
    window.addEventListener("sa-auth-updated", handleAuthUpdate);

    const refreshAccount = async () => {
      if (window.location.pathname.replace(/\/+$/, "").endsWith("/accept-invite")) return;
      const storedUser = getCurrentUser();
      if (storedUser?.authProvider === "local") return;

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        if (storedUser) setCurrentUser(null);
        return;
      }

      try {
        const profileResponse = await fetch(`/api/sa/profiles/${session.user.id}`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!profileResponse.ok) {
          if (profileResponse.status >= 500) return;
          await supabase.auth.signOut();
          await fetch("/api/sa/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
          setCurrentUser(null);
          return;
        }
        const profile = await profileResponse.json() as {
          id: string;
          email: string;
          name?: string | null;
          role: "admin" | "data_entry" | "viewer";
          status: string;
          hr_access?: boolean;
        };
        if (profile.status !== "active") {
          await supabase.auth.signOut();
          await fetch("/api/sa/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
          setCurrentUser(null);
          return;
        }

        const archiveResponse = await fetch("/api/sa/auth/supabase-email-archive-session", {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!archiveResponse.ok) {
          await supabase.auth.signOut();
          await fetch("/api/sa/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
          setCurrentUser(null);
          return;
        }

        await fetch("/api/sa/auth/supabase-hr-session", {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        setCurrentUser({
          id: profile.id,
          username: profile.email,
          name: profile.name || profile.email.split("@")[0],
          role: profile.role,
          hrAccess: profile.role === "admin" || profile.hr_access === true,
          authProvider: "supabase",
        });
      } catch {
        // Keep the current UI state during a transient network failure.
      }
    };

    const validateAdminSession = async () => {
      const storedUser = getCurrentUser();
      if (!storedUser || storedUser.role !== "admin") return;
      if (storedUser.authProvider === "supabase") {
        await refreshAccount();
        return;
      }
      try {
        const response = await fetch("/api/sa/auth/session", {
          credentials: "include",
        });
        if (response.ok) {
          if (!storedUser.authProvider) setCurrentUser({ ...storedUser, authProvider: "local" });
          return;
        }
        if (!storedUser.authProvider) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user.id === storedUser.id) {
            await refreshAccount();
            return;
          }
        }
        setCurrentUser(null);
      } catch {
        // A temporary network failure must not log the user out.
      }
    };

    const storedUser = getCurrentUser();
    const adminCheck = storedUser?.role === "admin"
      ? window.setInterval(() => void validateAdminSession(), 30000)
      : null;
    if (storedUser?.role === "admin") void validateAdminSession();
    else void refreshAccount();
    return () => {
      window.removeEventListener("sa-auth-updated", handleAuthUpdate);
      if (adminCheck !== null) window.clearInterval(adminCheck);
    };
  }, []);

  return (
    <LanguageProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={BASE}>
        <ScrollPositionRestoration />
        <PwaInstallPrompt />
        <AppUpdateNotice />
        <Routes>
          <Route
            path="/attachment-preview"
            element={<RequireAuth><AttachmentPreview /></RequireAuth>}
          />
          {/* Public pages — no layout, no auth */}
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          {/* All other pages — protected */}
          <Route path="/*" element={
            <RequireAuth>
            <MainLayout>
              <OnboardingTour />
              <Routes>
                <Route path="/"               element={<Dashboard />} />
                <Route path="/projects"       element={<Projects />} />
                <Route path="/agencies"        element={<Agencies />} />
                <Route path="/projects/:id/report" element={<ProjectReport />} />
                <Route path="/projects/:id"   element={<ProjectDetail />} />
                <Route path="/contractors"    element={<AllContractors />} />
                <Route path="/contracts"      element={<AllContracts />} />
                <Route path="/meetings"       element={<AllMeetings />} />
                <Route path="/letters"        element={<AllLetters />} />
                <Route path="/finance"        element={<FinancialArchive />} />
                <Route path="/email-archive"  element={<EmailArchive />} />
                <Route path="/search"         element={<SearchPage />} />
                <Route path="/notifications"  element={<Notifications />} />
                <Route path="/chat"           element={<Chat />} />
                <Route path="/reports"        element={<ReportsPage />} />
                <Route path="/faq"            element={<FAQPage />} />
                <Route path="/hr"             element={getArchivePermissions().canAccessHR ? <HRHome /> : <Navigate to="/" replace />} />
                <Route path="/hr/employees"   element={getArchivePermissions().canAccessHR ? <HREmployees /> : <Navigate to="/" replace />} />
                <Route path="/hr/employees/:id" element={getArchivePermissions().canAccessHR ? <HREmployeeDetail /> : <Navigate to="/" replace />} />
                <Route path="/hr/candidates"  element={getArchivePermissions().canAccessHR ? <HRCandidates /> : <Navigate to="/" replace />} />
                <Route path="/hr/corporate"   element={getArchivePermissions().canAccessHR ? <HRCorporate /> : <Navigate to="/" replace />} />
                <Route path="/users"          element={getCurrentUser()?.role === "admin" ? <UsersPage /> : <Navigate to="/" replace />} />
                <Route path="*"              element={<NotFound />} />
              </Routes>
            </MainLayout>
            </RequireAuth>
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </LanguageProvider>
  );
}
