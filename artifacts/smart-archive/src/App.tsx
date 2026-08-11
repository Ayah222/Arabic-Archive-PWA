import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "./views/components/shared/ErrorBoundary";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "./lib/supabase";
import { getCurrentUser, setCurrentUser, type CurrentUser } from "./controllers/useGlobal";
import { setAuthTokenGetter } from "@workspace/api-client-react";
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

// React Router basename must NOT have a trailing slash
const BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "") || "/";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

// Configure the generated API client to attach auth tokens to every request.
setAuthTokenGetter(async () => {
  const demo = localStorage.getItem("sa_demo_token");
  if (demo) return demo;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
});

/**
 * Route guard — checks localStorage cache first (fast path) and the live Supabase
 * session as a fallback, fetching the user profile from the API when the cache
 * has been cleared so that notification hooks can resolve the current user.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const demoToken = localStorage.getItem("sa_demo_token");

    if (demoToken) {
      if (!getCurrentUser()) {
        try {
          const cached = localStorage.getItem("sa_user");
          if (cached) setCurrentUser(JSON.parse(cached) as CurrentUser);
        } catch { /* ignore */ }
      }
      setAuthed(true);
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setAuthed(false);
        setReady(true);
        return;
      }

      if (!getCurrentUser()) {
        try {
          const apiBase = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
          const resp = await fetch(`${apiBase}/api/sa/auth/me`, {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          if (resp.ok) {
            const profile = await resp.json() as CurrentUser;
            if (!profile.isActive) {
              setAuthed(false);
              setReady(true);
              return;
            }
            setCurrentUser(profile);
          } else if (resp.status === 401 || resp.status === 403) {
            setAuthed(false);
            setReady(true);
            return;
          }
        } catch { /* network error — continue with session */ }
      }

      setAuthed(true);
      setReady(true);
    }).catch(() => {
      setAuthed(false);
      setReady(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null;
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={BASE}>
          <Routes>
            {/* Auth pages */}
            <Route path="/login"         element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected pages */}
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

            <Route path="" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
