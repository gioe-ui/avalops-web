import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, AlertCircle, CheckCircle } from "lucide-react";

export default function MilitarDashboard() {
  const [, navigate] = useLocation();

  const { data: operations, isLoading } = trpc.operations.listMilitarOperations.useQuery();

  const getCompletionStatus = (operation: any) => {
    const total = 3;
    const completed =
      (operation.operacaoPreenchida ? 1 : 0) +
      (operation.consumosPreenchidos ? 1 : 0) +
      (operation.observacoesPreenchidas ? 1 : 0);
    return { completed, total };
  };

  const getStatusColor = (operation: any) => {
    const { completed, total } = getCompletionStatus(operation);
    if (completed === total) return "bg-green-50 border-green-200";
    if (completed > 0) return "bg-yellow-50 border-yellow-200";
    if (operation.flaggedForCompletion) return "bg-red-50 border-red-200";
    return "bg-gray-50 border-gray-200";
  };

  const getStatusIcon = (operation: any) => {
    const { completed, total } = getCompletionStatus(operation);
    if (completed === total) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (operation.flaggedForCompletion) return <AlertCircle className="w-5 h-5 text-red-600" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Minhas Operações</h1>
            <p className="text-gray-600 mt-1">
              Operações atribuídas e estado de preenchimento dos relatórios
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">A carregar operações...</p>
          </div>
        ) : !operations || operations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-600">Nenhuma operação atribuída.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {operations.map((operation: any) => {
              const { completed, total } = getCompletionStatus(operation);
              return (
                <Card key={operation.id} className={`border-2 ${getStatusColor(operation)}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(operation)}
                        <div>
                          <CardTitle className="text-lg">
                            Operação {operation.operacaoNumero || `#${operation.id}`}
                          </CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            {operation.preenchimentoSecOp || "Sem descrição"}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/operation-detail/${operation.id}`)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Abrir
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Data da operação</p>
                          <p className="text-sm text-gray-900">
                            {operation.dataOp
                              ? new Date(operation.dataOp).toLocaleDateString("pt-PT")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Data prevista</p>
                          <p className="text-sm text-gray-900">
                            {operation.scheduledDate
                              ? new Date(operation.scheduledDate).toLocaleDateString("pt-PT")
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-3">
                          Estado de preenchimento
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded h-2">
                              <div
                                className="bg-green-600 h-2 rounded"
                                style={{ width: `${(completed / total) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-600">
                              {completed}/{total}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div
                              className={`p-2 rounded text-center ${operation.operacaoPreenchida ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                            >
                              Operação
                            </div>
                            <div
                              className={`p-2 rounded text-center ${operation.consumosPreenchidos ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                            >
                              Consumos
                            </div>
                            <div
                              className={`p-2 rounded text-center ${operation.observacoesPreenchidas ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                            >
                              Observações
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Comandante</p>
                          <p className="text-sm text-gray-900">{operation.cmdtOp || "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Efetivo total</p>
                          <p className="text-sm text-gray-900">
                            {operation.efetivTotalOperacao || "-"}
                          </p>
                        </div>
                      </div>

                      {operation.flaggedForCompletion ? (
                        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded">
                          <p className="text-sm text-red-700">
                            <strong>Atenção:</strong> esta operação foi sinalizada como incompleta.
                            Preencha os separadores em falta.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
