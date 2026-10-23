import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

/**
 * Esta página era uma segunda cópia do editor do relatório de operação, com as
 * suas próprias regras (por exemplo, "consumos preenchidos" contava 16 campos
 * aqui e 3 no outro editor). Passou a haver um só editor, em OperationForm; o
 * endereço antigo continua a funcionar e reencaminha para lá.
 */
export function OperationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const operationId = Number(id ?? 0);
  const valido = Number.isInteger(operationId) && operationId > 0;

  const { data: operation, isLoading } = trpc.operations.getById.useQuery(
    { id: operationId },
    { enabled: valido },
  );

  useEffect(() => {
    if (operation?.evaluationId) navigate(`/operation/${operation.evaluationId}`, { replace: true });
  }, [operation, navigate]);

  if (valido && (isLoading || operation)) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <Loader2 className="w-8 h-8 animate-spin text-ral-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
      <p className="text-ral-700">Operação não encontrada.</p>
      <Button variant="outline" onClick={() => navigate("/")}>
        Voltar ao início
      </Button>
    </div>
  );
}
