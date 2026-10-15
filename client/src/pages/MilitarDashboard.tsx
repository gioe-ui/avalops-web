import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatarData } from "@/lib/datas";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { EstadoPreenchimento } from "@/components/EstadoPreenchimento";

export default function MilitarDashboard() {
  const [, navigate] = useLocation();
  const { data: operations, isLoading } = trpc.operations.listMilitarOperations.useQuery();

  const completa = (op: any) => op.operacaoPreenchida && op.consumosPreenchidos && op.observacoesPreenchidas;

  return (
    <div className="min-h-dvh bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" onClick={() => navigate("/")} aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ral-800">As minhas operações</h1>
            <p className="text-ral-500 mt-1">Operações atribuídas e estado de preenchimento dos relatórios</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-ral-400" />
          </div>
        ) : !operations || operations.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed border-ral-300 text-ral-500">
            Nenhuma operação atribuída.
          </div>
        ) : (
          <ul className="grid gap-4">
            {operations.map((operation: any) => (
              <li
                key={operation.id}
                className={`bg-white rounded-lg border shadow-sm border-l-4 ${
                  completa(operation)
                    ? "border-ral-200 border-l-ok"
                    : operation.flaggedForCompletion
                      ? "border-ral-200 border-l-erro"
                      : "border-ral-200 border-l-aviso"
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {completa(operation) ? (
                        <CheckCircle2 className="w-5 h-5 text-ok" aria-label="Relatório completo" />
                      ) : operation.flaggedForCompletion ? (
                        <AlertTriangle className="w-5 h-5 text-erro" aria-label="Sinalizada como incompleta" />
                      ) : null}
                      <div>
                        <h2 className="text-lg font-semibold text-ral-900">
                          Operação {operation.operacaoNumero || `#${operation.id}`}
                        </h2>
                        <p className="text-sm text-ral-500">{operation.preenchimentoSecOp || "Mês por indicar"}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => navigate(`/operation-detail/${operation.id}`)}>
                      <ClipboardList className="w-4 h-4" />
                      Preencher
                    </Button>
                  </div>

                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <dt className="text-ral-500">Data da operação</dt>
                      <dd className="text-ral-900">{formatarData(operation.dataOp)}</dd>
                    </div>
                    <div>
                      <dt className="text-ral-500">Data prevista</dt>
                      <dd className="text-ral-900">{formatarData(operation.scheduledDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-ral-500">Comandante</dt>
                      <dd className="text-ral-900">{operation.cmdtOp || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-ral-500">Efetivo total</dt>
                      <dd className="text-ral-900">{operation.efetivTotalOperacao || "—"}</dd>
                    </div>
                  </dl>

                  <EstadoPreenchimento operacao={operation} compacto />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
