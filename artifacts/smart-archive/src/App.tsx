import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCurrentUser } from "./controllers/useGlobal";
import { getArchivePermissions } from "./controllers/permissions";
import { LanguageProvider } from "./contexts/LanguageContext";
import MainLayout from "./views/layouts/MainLayout";
import Dashboard from "./views/pages/Dashboard";
import Projects from "./views/pages/Projects";
import ProjectDetail from "./views/pages/ProjectDetail";
import ProjectReport from "./views/pages/ProjectReport";
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
import AcceptInvite from "./views/pages/AcceptInvite";
import OnboardingTour from "./views/components/shared/OnboardingTour";
import EmailArchive from "./views/pages/EmailArchive";
import HRHome from "./views/pages/hr/HRHome";
import HREmployees from "./views/pages/hr/HREmployees";
import HREmployeeDetail from "./views/pages/hr/HREmployeeDetail";
import HRCandidates from "./views/pages/hr/HRCandidates";
import HRCorporate from "./views/pages/hr/HRCorporate";

const BASE = import.meta.env.BASE_URL;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <LanguageProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={BASE}>
        <Routes>
          {/* Public pages — no layout, no auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          {/* All other pages — protected */}
          <Route path="/*" element={
            <RequireAuth>
            <MainLayout>
              <OnboardingTour />
              <Routes>
                <Route path="/"               element={<Dashboard />} />
                <Route path="/projects"       element={<Projects />} />
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
