import { lazy, Suspense, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  FileText,
  BarChart2,
  PieChart,
  Users,
  CheckCircle,
  User,
  TrendingUp,
  UserSearch,
  ClipboardList,
  ScrollText,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { Logotipo } from "@/components/EcraAcesso";
import EvaluationForm from "./EvaluationForm";
import Dashboard from "./Dashboard";
import UsersPage from "./UsersPage";
import UserApprovals from "./UserApprovals";
import SuspectProfiles from "./SuspectProfiles";
import OperationAnalysis from "./OperationAnalysis";
import Auditoria from "./Auditoria";

// Gráficos e mapa são as bibliotecas mais pesadas: só se carregam quando se
// abre o separador de estatísticas.
const StatisticsPage = lazy(() => import("./Statistics").then((m) => ({ default: m.StatisticsPage })));

type Tab = "form" | "dashboard" | "statistics" | "users" | "approvals" | "suspects" | "analysis" | "audit";

const TABS: { id: Tab; label: string; curto: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { id: "dashboard", label: "Histórico", curto: "Histórico", icon: <BarChart2 className="w-4 h-4" /> },
  { id: "form", label: "Nova avaliação", curto: "Nova", icon: <FileText className="w-4 h-4" /> },
  { id: "statistics", label: "Estatísticas", curto: "Estatíst.", icon: <PieChart className="w-4 h-4" /> },
  { id: "suspects", label: "Perfis de suspeitos", curto: "Suspeitos", icon: <UserSearch className="w-4 h-4" /> },
  { id: "analysis", label: "Análise", curto: "Análise", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "users", label: "Utilizadores", curto: "Utiliz.", icon: <Users className="w-4 h-4" />, adminOnly: true },
  { id: "approvals", label: "Aprovações", curto: "Aprov.", icon: <CheckCircle className="w-4 h-4" />, adminOnly: true },
  { id: "audit", label: "Auditoria", curto: "Audit.", icon: <ScrollText className="w-4 h-4" />, adminOnly: true },
];

const botaoCabecalho = "border-white/40 text-white bg-white/5 hover:bg-white/15 hover:text-white";

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="bg-gioe text-white shadow-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-7xl mx-auto flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Logotipo className="w-11 h-11 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-wide leading-tight">
                GIOE — Avaliação de Pedidos de Apoio
              </h1>
              {user && (
                <p className="text-xs text-ral-100/85 truncate">
                  {[user.rank, user.name].filter(Boolean).join(" ") || user.email}
                  {isAdmin ? " · Administrador" : ""}
                </p>
              )}
            </div>
          </div>
          <nav aria-label="Conta" className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className={botaoCabecalho}>
              <Link href="/militar-dashboard">
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">As minhas operações</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className={botaoCabecalho}>
              <Link href="/profile">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Perfil</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void logout()} className={botaoCabecalho}>
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </nav>
        </div>
        <div className="h-0.5 bg-latao-500/80" aria-hidden="true" />
      </header>

      <nav className="bg-white border-b border-ral-200 shadow-sm" aria-label="Secções">
        <div role="tablist" className="max-w-7xl mx-auto flex overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-[3px] transition-colors ${
                activeTab === tab.id
                  ? "border-latao-500 text-ral-900 bg-ral-50"
                  : "border-transparent text-ral-500 hover:text-ral-900 hover:bg-ral-50"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.curto}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {activeTab === "form" && <EvaluationForm />}
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "statistics" && (
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-ral-400" aria-label="A carregar" />
              </div>
            }
          >
            <StatisticsPage />
          </Suspense>
        )}
        {activeTab === "suspects" && <SuspectProfiles />}
        {activeTab === "analysis" && <OperationAnalysis />}
        {activeTab === "users" && isAdmin && <UsersPage />}
        {activeTab === "approvals" && isAdmin && <UserApprovals />}
        {activeTab === "audit" && isAdmin && <Auditoria />}
      </main>

      <footer className="border-t border-ral-200 bg-white text-center text-xs text-ral-500 py-3 no-print">
        Informação classificada <strong className="text-erro tracking-wider">RESERVADO</strong> · As
        alterações, exportações e impressões ficam registadas
      </footer>
    </div>
  );
}
