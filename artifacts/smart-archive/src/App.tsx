import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCurrentUser } from "./controllers/useGlobal";
import { LanguageProvider } from "./contexts/LanguageContext";
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
import OnboardingTour from "./views/components/shared/OnboardingTour";

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
          {/* Login page — no layout */}
          <Route path="/login" element={<LoginPage />} />

          {/* All other pages — protected */}
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
