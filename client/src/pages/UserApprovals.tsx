import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatarData } from "@/lib/datas";
import { Check, X, Loader2, Inbox } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function UserApprovals() {
  const { data: pendingUsers, isLoading } = trpc.users.getPending.useQuery();
  const approveMutation = trpc.users.approve.useMutation();
  const rejectMutation = trpc.users.reject.useMutation();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const processar = async (userId: string, acao: "aprovar" | "rejeitar") => {
    if (acao === "rejeitar" && !confirm("Rejeitar este registo? O pedido é eliminado.")) return;

    setProcessingId(userId);
    try {
      if (acao === "aprovar") await approveMutation.mutateAsync({ id: userId });
      else await rejectMutation.mutateAsync({ id: userId });
      toast.success(acao === "aprovar" ? "Utilizador aprovado." : "Registo rejeitado.");
      await utils.users.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao processar o pedido.");
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-ral-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-ral-800 mb-1">Aprovação de utilizadores</h2>
      <p className="text-sm text-ral-500 mb-6">
        Confirme a identidade de cada militar (nome, posto, n.º mecanográfico) antes de aprovar: a
        aprovação dá acesso a dados reservados.
      </p>

      {!pendingUsers || pendingUsers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-ral-300">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-ral-300" />
          <p className="font-semibold text-ral-700">Nenhuma aprovação pendente</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {pendingUsers.map((user) => (
            <li key={user.id} className="bg-white rounded-lg border border-ral-200 shadow-sm p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[16rem]">
                  <h3 className="text-lg font-semibold text-ral-900">{user.name || "—"}</h3>
                  <p className="text-ral-700">{user.email}</p>
                  <p className="text-sm text-ral-500 mt-2">
                    {[user.rank, user.mecanographicNumber && `N.º ${user.mecanographicNumber}`, user.phoneNumber]
                      .filter(Boolean)
                      .join(" · ") || "Sem dados adicionais"}
                  </p>
                  <p className="text-sm text-ral-500">Registado em {formatarData(user.createdAt)}</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => void processar(user.id, "aprovar")} disabled={processingId === user.id}>
                    {processingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Aprovar
                  </Button>
                  <Button
                    onClick={() => void processar(user.id, "rejeitar")}
                    disabled={processingId === user.id}
                    variant="outline"
                    className="text-erro border-erro/40 hover:bg-erro-claro"
                  >
                    <X className="w-4 h-4" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
