import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { getCurrentUser } from "./controllers/useGlobal";
import { ErrorBoundary } from "./views/components/shared/ErrorBoundary";
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

/**
 * Route guard — fully synchronous.
 * getCurrentUser() reads from localStorage, so no async restore needed.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const hasSession = !!localStorage.getItem("sa_demo_token") || !!getCurrentUser();

  if (!hasSession) {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    window.location.replace(`${base}/login`);
    return null;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
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

            {/* Catch-all */}
            <Route path="" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
