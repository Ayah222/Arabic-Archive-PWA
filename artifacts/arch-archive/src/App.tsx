import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Projects from "./pages/projects";
import ProjectDetails from "./pages/project-details";
import Documents from "./pages/documents";
import Contractors from "./pages/contractors";
import ContractorDetails from "./pages/contractor-details";
import Correspondence from "./pages/correspondence";
import Meetings from "./pages/meetings";
import UsersPage from "./pages/users";
import NotificationsPage from "./pages/notifications";

const queryClient = new QueryClient();

const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const { userType } = useAppContext();
  if (!userType) return <Redirect to="/login" />;
  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
};

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/projects/:id">
        {(params) => (
          <ProtectedRoute component={ProjectDetails} id={params.id} />
        )}
      </Route>
      <Route path="/projects">
        <ProtectedRoute component={Projects} />
      </Route>
      <Route path="/documents">
        <ProtectedRoute component={Documents} />
      </Route>
      <Route path="/contractors/:id">
        {(params) => (
          <ProtectedRoute component={ContractorDetails} id={params.id} />
        )}
      </Route>
      <Route path="/contractors">
        <ProtectedRoute component={Contractors} />
      </Route>
      <Route path="/correspondence">
        <ProtectedRoute component={Correspondence} />
      </Route>
      <Route path="/meetings">
        <ProtectedRoute component={Meetings} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={UsersPage} />
      </Route>
      <Route path="/notifications">
        <ProtectedRoute component={NotificationsPage} />
      </Route>
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <NotificationsProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </NotificationsProvider>
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
