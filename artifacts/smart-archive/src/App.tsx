import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const BASE = import.meta.env.BASE_URL;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={BASE}>
        <MainLayout>
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
            <Route path="*"              element={<NotFound />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
