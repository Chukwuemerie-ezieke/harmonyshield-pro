import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { BRAND } from "@/lib/brand";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Compliance from "@/pages/compliance";
import ThreatMonitor from "@/pages/threat-monitor";
import Training from "@/pages/training";
import IncidentResponse from "@/pages/incident-response";
import Reports from "@/pages/reports";
import SettingsPage from "@/pages/settings";

function AppLayout() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-6 pt-14 md:pt-6">
        {user?.isDemo && (
          <div className="mb-4 rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200" role="status">
            You're viewing a <strong>read-only demo</strong> with sample data. Items marked "Sample" are illustrative only.{" "}
            <a className="underline font-medium" href={`mailto:${BRAND.contactEmail}?subject=HavonaShield%20for%20our%20school`}>
              Get HavonaShield for your school
            </a>
          </div>
        )}
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/compliance" component={Compliance} />
          <Route path="/threats" component={ThreatMonitor} />
          <Route path="/training" component={Training} />
          <Route path="/training/:id" component={Training} />
          <Route path="/incidents" component={IncidentResponse} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <Router hook={useHashLocation}>
            <AppLayout />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
