import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cterDaAvaliacao } from "@/lib/api";
import { formatarData } from "@/lib/datas";
import { NEOPS, NeopBadge, corNeop } from "@/lib/neop";
import { TrendingUp } from "lucide-react";

export default function OperationAnalysis() {
  const [selectedNeop, setSelectedNeop] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: evaluations = [], isLoading } = trpc.evaluations.list.useQuery({});

  const stats = useMemo(() => {
    const byNeop: Record<string, number> = {};
    const byCter: Record<string, number> = {};
    let totalScore = 0;
    let neop4Count = 0;

    evaluations.forEach((evaluation: any) => {
      byNeop[evaluation.neop] = (byNeop[evaluation.neop] || 0) + 1;
      const cter = cterDaAvaliacao(evaluation);
      if (cter) byCter[cter] = (byCter[cter] || 0) + 1;
      totalScore += evaluation.pontuacao;
      if (evaluation.neop === "4º NEOP") neop4Count++;
    });

    return {
      totalOperations: evaluations.length,
      averageScore:
        evaluations.length > 0 ? Math.round((totalScore / evaluations.length) * 100) / 100 : 0,
      byNeop,
      byCter,
      neop4Percentage:
        evaluations.length > 0 ? Math.round((neop4Count / evaluations.length) * 100) : 0,
    };
  }, [evaluations]);

  const filteredOperations = useMemo(() => {
    if (!selectedNeop) return evaluations;
    return evaluations.filter((evaluation: any) => evaluation.neop === selectedNeop);
  }, [evaluations, selectedNeop]);

  const paginatedOperations = filteredOperations.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredOperations.length / pageSize);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-ral-800">Análise de operações</h2>
        <p className="text-sm text-ral-500">Distribuição e lista das avaliações por classificação</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de avaliações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalOperations}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pontuação média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.averageScore}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">4º NEOP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neop-4">{stats.neop4Percentage}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">CTer distintos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{Object.keys(stats.byCter).length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Distribuição por NEOP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {NEOPS.filter((n) => stats.byNeop[n]).map((neop) => {
              const count = stats.byNeop[neop];
              return (
              <div key={neop} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <NeopBadge neop={neop} className="w-20 justify-center" />
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${stats.totalOperations > 0 ? (count / stats.totalOperations) * 100 : 0}%`,
                        background: corNeop(neop).forte,
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  {count} (
                  {stats.totalOperations > 0
                    ? Math.round((count / stats.totalOperations) * 100)
                    : 0}
                  %)
                </span>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtrar por NEOP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedNeop === null ? "default" : "outline"}
              onClick={() => {
                setSelectedNeop(null);
                setPage(0);
              }}
            >
              Todas
            </Button>
            {NEOPS.filter((n) => stats.byNeop[n]).map((neop) => (
              <Button
                key={neop}
                variant={selectedNeop === neop ? "default" : "outline"}
                onClick={() => {
                  setSelectedNeop(neop);
                  setPage(0);
                }}
              >
                {neop}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avaliações ({filteredOperations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center text-muted-foreground">A carregar...</p>
            ) : paginatedOperations.length === 0 ? (
              <p className="text-center text-muted-foreground">Nenhuma avaliação encontrada.</p>
            ) : (
              paginatedOperations.map((evaluation: any) => (
                <div
                  key={evaluation.id}
                  className="flex items-center justify-between p-3 border border-ral-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-ral-900">{evaluation.nuipc || `#${evaluation.id}`}</p>
                    <p className="text-sm text-muted-foreground">
                      {[evaluation.dataAvaliacao && formatarData(evaluation.dataAvaliacao), cterDaAvaliacao(evaluation)]
                        .filter(Boolean)
                        .join(" • ") || "Sem data"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Pontuação</p>
                      <p className="text-lg font-bold">{evaluation.pontuacao}</p>
                    </div>
                    <NeopBadge neop={evaluation.neop} />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
            >
              Seguinte
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
