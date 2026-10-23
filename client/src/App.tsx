import type { ComponentType } from "react";
import { Route, Router, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import VigilanciaSessao from "./components/VigilanciaSessao";
import { ThemeProvider } from "./contexts/ThemeContext";

import { configuracaoEmFalta } from "./lib/supabase";
import ConfigMissing from "./pages/ConfigMissing";
import Home from "./pages/Home";
import Portao from "./pages/Portao";
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

/** Todas as páginas, exceto a inicial (que já o faz), passam pelo portão de acesso. */
const protegida = (Pagina: ComponentType<any>) =>
  function PaginaProtegida(props: any) {
    return (
      <Portao>
        <Pagina {...props} />
      </Portao>
    );
  };

const ProfileP = protegida(Profile);
const MilitarDashboardP = protegida(MilitarDashboard);
const PrintEvaluationP = protegida(PrintEvaluation);
const OperationFormP = protegida(OperationForm);
const EditEvaluationP = protegida(EditEvaluation);
const PrintOperationP = protegida(PrintOperation);
const OperationDetailP = protegida(OperationDetail);
const SuspectProfilesP = protegida(SuspectProfiles);
const OperationAnalysisP = protegida(OperationAnalysis);

function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={ProfileP} />
      <Route path="/militar-dashboard" component={MilitarDashboardP} />
      <Route path="/print/:id" component={PrintEvaluationP} />
      <Route path="/operation/:evaluationId" component={OperationFormP} />
      <Route path="/edit-evaluation/:id" component={EditEvaluationP} />
      <Route path="/print-operation/:id" component={PrintOperationP} />
      <Route path="/operation-detail/:id" component={OperationDetailP} />
      <Route path="/suspect-profiles" component={SuspectProfilesP} />
      <Route path="/operation-analysis" component={OperationAnalysisP} />
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
          <Toaster richColors closeButton />
          <VigilanciaSessao />
          <Router base={basePath}>
            <Routes />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
