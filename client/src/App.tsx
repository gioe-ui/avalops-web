import { Route, Router, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

import { configuracaoEmFalta } from "./lib/supabase";
import ConfigMissing from "./pages/ConfigMissing";
import Home from "./pages/Home";
import NotFound from "@/pages/NotFound";
import PrintEvaluation from "./pages/PrintEvaluation";
import EditEvaluation from "./pages/EditEvaluation";
import OperationForm from "./pages/OperationForm";
import PrintOperation from "./pages/PrintOperation";
import Profile from "./pages/Profile";
import MilitarDashboard from "./pages/MilitarDashboard";
import { OperationDetail } from "./pages/OperationDetail";
import SuspectProfiles from "./pages/SuspectProfiles";
import OperationAnalysis from "./pages/OperationAnalysis";

/**
 * Num site de projeto do GitHub Pages a aplicação não está na raiz do domínio,
 * por isso o wouter precisa de saber o prefixo. BASE_URL vem do `base` do Vite.
 */
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/militar-dashboard" component={MilitarDashboard} />
      <Route path="/print/:id" component={PrintEvaluation} />
      <Route path="/operation/:evaluationId" component={OperationForm} />
      <Route path="/edit-evaluation/:id" component={EditEvaluation} />
      <Route path="/print-operation/:id" component={PrintOperation} />
      <Route path="/operation-detail/:id" component={OperationDetail} />
      <Route path="/suspect-profiles" component={SuspectProfiles} />
      <Route path="/operation-analysis" component={OperationAnalysis} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  if (configuracaoEmFalta) {
    return <ConfigMissing />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router base={basePath}>
            <Routes />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
