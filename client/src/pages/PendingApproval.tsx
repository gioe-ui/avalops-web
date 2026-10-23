import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Clock, LogOut, UserX } from "lucide-react";
import EcraAcesso from "@/components/EcraAcesso";

/**
 * Conta à espera de aprovação, ou desativada por um administrador. Em ambos os
 * casos a base de dados não deixa ler nem escrever nada.
 */
export default function PendingApproval({ desativada = false }: { desativada?: boolean }) {
  const { logout, user } = useAuth();

  return (
    <EcraAcesso
      icone={desativada ? <UserX className="w-12 h-12" /> : <Clock className="w-12 h-12" />}
      titulo={desativada ? "Conta desativada" : "A aguardar aprovação"}
      subtitulo={user?.email}
    >
      <p className="text-sm text-ral-700 text-center mb-5">
        {desativada
          ? "Esta conta foi desativada por um administrador. Os registos que fez continuam no sistema, mas deixou de ter acesso. Se considera que é um engano, contacte um administrador."
          : "A sua conta foi criada. Um administrador irá analisá-la e aprová-la."}
      </p>

      <div className="bg-ral-50 border border-ral-200 rounded-lg p-3 mb-6">
        <p className="text-sm text-ral-700 text-center">
          Enquanto a conta não estiver ativa e aprovada, não tem acesso a nenhum dado do sistema.
        </p>
      </div>

      <Button onClick={() => void logout()} className="w-full">
        <LogOut className="w-4 h-4" />
        Sair
      </Button>
    </EcraAcesso>
  );
}
