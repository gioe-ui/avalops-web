import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Check, X, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function UserApprovals() {
  const { data: pendingUsers, isLoading, refetch } = trpc.users.getPending.useQuery();
  const approveMutation = trpc.users.approve.useMutation();
  const rejectMutation = trpc.users.reject.useMutation();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const handleApprove = async (userId: string) => {
    setProcessingId(userId);
    try {
      await approveMutation.mutateAsync({ id: userId });
      toast.success("Utilizador aprovado.");
      await refetch();
      utils.users.list.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao aprovar utilizador.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm("Rejeitar este registo? O perfil é eliminado.")) return;

    setProcessingId(userId);
    try {
      await rejectMutation.mutateAsync({ id: userId });
      toast.success("Registo rejeitado.");
      await refetch();
      utils.users.list.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao rejeitar utilizador.");
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!pendingUsers || pendingUsers.length === 0) {
    return (
      <div className="p-8">
        <Card className="p-6 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma aprovação pendente</h3>
          <p className="text-gray-600">Todos os utilizadores registados estão aprovados.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6" style={{ color: "#1a472a" }}>
        Aprovação de Utilizadores
      </h1>

      <div className="grid gap-4">
        {pendingUsers.map((user) => (
          <Card key={user.id} className="p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[16rem]">
                <h3 className="text-lg font-semibold">{user.name || "—"}</h3>
                <p className="text-gray-600">{user.email}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {[user.rank, user.mecanographicNumber, user.phoneNumber]
                    .filter(Boolean)
                    .join(" · ") || "Sem dados adicionais"}
                </p>
                <p className="text-sm text-gray-500">
                  Registado em: {new Date(user.createdAt).toLocaleDateString("pt-PT")}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleApprove(user.id)}
                  disabled={processingId === user.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processingId === user.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Aprovar
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleReject(user.id)}
                  disabled={processingId === user.id}
                  variant="destructive"
                >
                  {processingId === user.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Rejeitar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
