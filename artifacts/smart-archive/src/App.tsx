import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./lib/supabase";
import { getCurrentUser, setCurrentUser } from "./controllers/useGlobal";
import MainLayout from "./views/layouts/MainLayout";
import Dashboard from "./views/pages/Dashboard";
import Projects from "./views/pages/Projects";
import ProjectDetail from "./views/pages/ProjectDetail";
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
import UsersPage from "./views/pages/Users";
import AuthCallback from "./views/pages/AuthCallback";
import OnboardingTour from "./views/components/shared/OnboardingTour";

const BASE = import.meta.env.BASE_URL;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

/**
 * Route guard — redirects unauthenticated / inactive / expired users to /login.
 * Checks: (1) localStorage demo token, (2) localStorage cached user, (3) live Supabase session.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      // 1. Demo token in localStorage → user already set, allow in
      const demoToken = localStorage.getItem("sa_demo_token");
      if (demoToken && getCurrentUser()) {
        if (!cancelled) setChecking(false);
        return;
      }

      // 2. Supabase session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // If we already have a cached profile, allow in
          if (getCurrentUser()) {
            if (!cancelled) setChecking(false);
            return;
          }
          // Try to refresh profile from API
          const res = await fetch("/api/sa/auth/me", {
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
            if (!cancelled) setChecking(false);
            return;
          }
          // Profile fetch failed — sign out and redirect
          await supabase.auth.signOut();
        }
      } catch { /* network error */ }

      // 3. No valid session → redirect to login
      if (!cancelled) navigate("/login", { replace: true });
    };

    void verify();
    return () => { cancelled = true; };
  }, [navigate]);

  if (checking) {
    const isDark = document.documentElement.classList.contains("dark");
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: isDark ? "#080612" : "#f5f7ff" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: isDark ? "#00f0ff" : "#6366f1", borderTopColor: "transparent" }} />
          <p className="text-sm font-medium" style={{ color: isDark ? "rgba(255,255,255,0.50)" : "#9ca3af" }}>
            جاري التحقق...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={BASE}>
        <Routes>
          {/* Auth pages — no layout, no guard */}
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected pages — wrapped in RequireAuth + MainLayout */}
          <Route path="/*" element={
            <RequireAuth>
              <MainLayout>
                <OnboardingTour />
                <Routes>
                  <Route path="/"               element={<Dashboard />} />
                  <Route path="/projects"       element={<Projects />} />
                  <Route path="/projects/:id"   element={<ProjectDetail />} />
                  <Route path="/contractors"    element={<AllContractors />} />
                  <Route path="/contracts"      element={<AllContracts />} />
                  <Route path="/meetings"       element={<AllMeetings />} />
                  <Route path="/letters"        element={<AllLetters />} />
                  <Route path="/finance"        element={<FinancialArchive />} />
                  <Route path="/search"         element={<SearchPage />} />
                  <Route path="/notifications"  element={<Notifications />} />
                  <Route path="/reports"        element={<ReportsPage />} />
                  <Route path="/faq"            element={<FAQPage />} />
                  <Route path="/users"          element={<UsersPage />} />
                  <Route path="*"               element={<NotFound />} />
                </Routes>
              </MainLayout>
            </RequireAuth>
          } />

          {/* Catch-all: redirect to dashboard (protected) */}
          <Route path="" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
