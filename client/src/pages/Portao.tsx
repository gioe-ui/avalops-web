import { useEffect, type ReactNode } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import EcraAcesso from "@/components/EcraAcesso";
import Auth from "./Auth";
import MfaRegistar from "./MfaRegistar";
import MfaVerificar from "./MfaVerificar";
import DefinirPassword from "./DefinirPassword";
import PendingApproval from "./PendingApproval";

/**
 * Portão de acesso: tudo o que está dentro só aparece a quem tem sessão,
 * passou o segundo fator, está aprovado e ativo. Envolve todas as rotas, não
 * só a página inicial — antes, abrir diretamente /operation-detail/12 mostrava
 * o ecrã (vazio, porque a base de dados recusava os dados) a quem não tinha
 * sessão.
 *
 * A ordem importa: o código do segundo fator vem antes da nova password (o
 * servidor pode exigi-lo para mudar a password de quem já tem segundo fator).
 */
export default function Portao({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { user, loading, error } = auth;

  const tudoOk = Boolean(user) && auth.isApproved && !auth.recuperacao;

  // Hora da última entrada, uma vez por sessão do separador.
  useEffect(() => {
    if (!tudoOk) return;
    try {
      if (sessionStorage.getItem("gioe-entrada-registada")) return;
      sessionStorage.setItem("gioe-entrada-registada", "1");
    } catch {
      // sem armazenamento: regista na mesma
    }
    void api.auth.registarEntrada().catch(() => undefined);
  }, [tudoOk]);

  if (loading) {
    return (
      <div className="bg-gioe min-h-dvh flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-10 h-10 animate-spin text-white" aria-hidden="true" />
        <span className="sr-only">A carregar…</span>
      </div>
    );
  }

  if (error) {
    return (
      <EcraAcesso icone={<WifiOff className="w-10 h-10" />} titulo="Não foi possível contactar o servidor">
        <p className="text-sm text-ral-700 text-center mb-5">{error.message}</p>
        <Button className="w-full" onClick={() => void auth.refresh()}>
          Tentar de novo
        </Button>
      </EcraAcesso>
    );
  }

  if (!user) return <Auth />;
  if (auth.precisaVerificarMfa) return <MfaVerificar />;
  if (auth.recuperacao) return <DefinirPassword />;
  if (!auth.ativo) return <PendingApproval desativada />;
  if (auth.precisaRegistarMfa) return <MfaRegistar />;
  if (user.approved !== 1) return <PendingApproval />;

  return <>{children}</>;
}
