import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { api, cterDaAvaliacao } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatarData } from "@/lib/datas";
import { NEOPS, NeopBadge } from "@/lib/neop";
import { exportarFolha } from "@/lib/exportar";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList,
  Download,
  MessageCircle,
  Pencil,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AcaoIcone } from "@/components/AcaoIcone";

const estadoOperacao = (evaluation: any): { classe: string; label: string } => {
  if (!evaluation.operationId) return { classe: "bg-ral-300", label: "Sem relatório" };

  const feitos =
    (evaluation.operacaoPreenchida ? 1 : 0) +
    (evaluation.consumosPreenchidos ? 1 : 0) +
    (evaluation.observacoesPreenchidas ? 1 : 0);

  if (feitos === 0) return { classe: "bg-erro", label: "Não iniciado" };
  if (feitos < 3) return { classe: "bg-aviso", label: "Parcial" };
  return { classe: "bg-ok", label: "Completo" };
};

const extractCter = (evaluation: any): string => cterDaAvaliacao(evaluation) ?? "—";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const [filterNeop, setFilterNeop] = useState("all");
  const [filterAvaliador, setFilterAvaliador] = useState("");
  const [avaliadorInput, setAvaliadorInput] = useState("");
  const [filterCter, setFilterCter] = useState("all");
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null);
  const [selectedEvaluations, setSelectedEvaluations] = useState<Set<number>>(new Set());
  const [aExportar, setAExportar] = useState(false);
  const utils = trpc.useUtils();

  const { data: evaluations, isLoading } = trpc.evaluations.list.useQuery({
    neop: filterNeop === "all" ? undefined : filterNeop,
    avaliador: filterAvaliador || undefined,
    cterRequerente: filterCter === "all" ? undefined : filterCter,
  });

  const { data: cters, isLoading: ctersLoading } = trpc.evaluations.getCters.useQuery();

  /** Só o autor ou um administrador alteram ou eliminam (imposto pela base de dados). */
  const podeAlterar = (e: any) => isAdmin || e.userId === user?.id;

  const invalidar = () => {
    void utils.evaluations.invalidate();
    void utils.statistics.invalidate();
    void utils.operations.invalidate();
    void utils.suspectProfiles.invalidate();
  };

  const deleteMutation = trpc.evaluations.delete.useMutation({
    onSuccess: () => {
      toast.success("Avaliação eliminada.");
      invalidar();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteManyMutation = trpc.evaluations.deleteMany.useMutation({
    onSuccess: ({ eliminadas, pedidas }) => {
      if (eliminadas === pedidas) toast.success(`${eliminadas} avaliação(ões) eliminada(s).`);
      else toast.warning(`Eliminadas ${eliminadas} de ${pedidas}. As restantes não são suas.`);
      setSelectedEvaluations(new Set());
      invalidar();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendNotificationMutation = trpc.operations.sendNotification.useMutation({
    onSuccess: (result) => {
      toast.success("Notificação registada. Confirme o envio no WhatsApp.");
      window.open(result.whatsappLink, "_blank", "noopener,noreferrer");
      setSelectedEvaluation(null);
    },
    onError: (error) => toast.error(`Erro ao registar notificação: ${error.message}`),
  });

  const handleDelete = (id: number) => {
    if (confirm("Eliminar esta avaliação? A operação e os suspeitos associados são eliminados também.")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSelectEvaluation = (id: number) => {
    const newSelected = new Set(selectedEvaluations);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedEvaluations(newSelected);
  };

  const selecionaveis = (evaluations ?? []).filter(podeAlterar);
  // Só conta o que está à vista: uma avaliação selecionada que deixou de
  // aparecer (por mudança de filtro ou nova leitura) nunca é eliminada.
  const selecionadas: number[] = selecionaveis
    .filter((e: any) => selectedEvaluations.has(e.id))
    .map((e: any) => e.id);

  // Mudar os filtros começa uma seleção nova.
  useEffect(() => {
    setSelectedEvaluations(new Set());
  }, [filterNeop, filterAvaliador, filterCter]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedEvaluations(checked ? new Set(selecionaveis.map((e: any) => e.id)) : new Set());
  };

  const handleDeleteSelected = () => {
    if (selecionadas.length === 0) return;
    if (
      confirm(
        `Eliminar ${selecionadas.length} avaliação(ões)? As operações e os suspeitos associados são eliminados também.`,
      )
    ) {
      deleteManyMutation.mutate({ ids: selecionadas });
    }
  };

  const exportToExcel = async () => {
    if (!evaluations || evaluations.length === 0) {
      toast.error("Nenhuma avaliação para exportar.");
      return;
    }
    setAExportar(true);
    try {
      const cabecalho = ["Data", "NUIPC", "POC", "Posto", "Pontuação", "NEOP", "Avaliador", "CTer", "Parecer"];
      const linhas = evaluations.map((e: any) => [
        formatarData(e.createdAt),
        e.nuipc ?? "",
        e.pocNome ?? "",
        e.pocPosto ?? "",
        e.pontuacao,
        e.neop,
        e.avaliador ?? "",
        extractCter(e),
        e.parecer ?? "",
      ]);
      await exportarFolha({
        nomeFicheiro: "avaliacoes_GIOE.xlsx",
        nomeFolha: "Avaliações",
        cabecalhos: [cabecalho],
        linhas,
        larguras: [12, 18, 22, 16, 10, 10, 22, 18, 60],
      });
      void api.audit.registar({
        acao: "EXPORT",
        detalhe: {
          recurso: "evaluations",
          linhas: linhas.length,
          filtros: { neop: filterNeop, cter: filterCter, avaliador: filterAvaliador },
        },
      });
    } catch {
      toast.error("Erro ao exportar o ficheiro.");
    } finally {
      setAExportar(false);
    }
  };

  const applyFilter = () => setFilterAvaliador(avaliadorInput.trim());

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-ral-800">Histórico de avaliações</h2>
          <p className="text-sm text-ral-500">Avaliações registadas e estado do relatório de operação</p>
        </div>
        <Button variant="outline" onClick={() => void exportToExcel()} disabled={aExportar}>
          <Download className="w-4 h-4" />
          {aExportar ? "A exportar..." : "Exportar para Excel"}
        </Button>
      </div>

      <div className="bg-white rounded-lg p-4 mb-5 border border-ral-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-neop" className="text-ral-700 font-semibold">
              NEOP
            </Label>
            <Select value={filterNeop} onValueChange={setFilterNeop}>
              <SelectTrigger id="filtro-neop" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {NEOPS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-cter" className="text-ral-700 font-semibold">
              CTer
            </Label>
            <Select value={filterCter} onValueChange={setFilterCter}>
              <SelectTrigger id="filtro-cter" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ctersLoading ? (
                  <SelectItem value="loading" disabled>
                    A carregar...
                  </SelectItem>
                ) : cters && cters.length > 0 ? (
                  cters.map((cter) => (
                    <SelectItem key={cter} value={cter}>
                      {cter}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    Nenhum CTer encontrado
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-avaliador" className="text-ral-700 font-semibold">
              Avaliador
            </Label>
            <Input
              id="filtro-avaliador"
              placeholder="Nome do avaliador"
              value={avaliadorInput}
              onChange={(e) => setAvaliadorInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={applyFilter}>
              <Search className="w-4 h-4" />
              Pesquisar
            </Button>
            {selecionadas.length > 0 && (
              <Button onClick={handleDeleteSelected} variant="destructive" disabled={deleteManyMutation.isPending}>
                <Trash2 className="w-4 h-4" />
                Eliminar ({selecionadas.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-ral-400">A carregar...</div>
      ) : !evaluations || evaluations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-ral-300">
          <p className="text-ral-500 text-sm">Nenhuma avaliação encontrada.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <caption className="sr-only">Histórico de avaliações</caption>
            <thead>
              <tr className="bg-ral-700 text-white">
                <th scope="col" className="text-left px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas as avaliações que pode eliminar"
                    checked={selecionaveis.length > 0 && selecionadas.length === selecionaveis.length}
                    disabled={selecionaveis.length === 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                {["Data", "POC", "Pontuação", "NEOP", "Avaliador", "CTer", "Militar atribuído", "Relatório", "Ações"].map(
                  (h) => (
                    <th key={h} scope="col" className="text-left px-3 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e: any) => {
                const estado = estadoOperacao(e);
                const alteravel = podeAlterar(e);
                return (
                  <tr key={`eval-${e.id}`} className="border-b border-ral-100 even:bg-ral-50/60 hover:bg-latao-100/50">
                    <td className="px-3 py-2.5 w-8">
                      {alteravel ? (
                        <input
                          type="checkbox"
                          aria-label={`Selecionar avaliação ${e.id}`}
                          checked={selectedEvaluations.has(e.id)}
                          onChange={() => handleSelectEvaluation(e.id)}
                        />
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-ral-600 whitespace-nowrap text-xs">{formatarData(e.createdAt)}</td>
                    <td className="px-3 py-2.5 font-medium text-ral-900 truncate max-w-[10rem]" title={e.pocNome || ""}>
                      {e.pocNome || "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-bold text-ral-800">{e.pontuacao}</span>
                      <span className="text-ral-400 text-xs">/100</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <NeopBadge neop={e.neop} />
                    </td>
                    <td className="px-3 py-2.5 text-ral-700 truncate max-w-[10rem]" title={e.avaliador || ""}>
                      {e.avaliador || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-ral-700 whitespace-nowrap">{extractCter(e)}</td>
                    <td className="px-3 py-2.5 text-ral-700 truncate max-w-[12rem]">
                      {e.assignedUserName ? [e.assignedUserRank, e.assignedUserName].filter(Boolean).join(" ") : "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs text-ral-700">
                        <span className={`w-2.5 h-2.5 rounded-full ${estado.classe}`} aria-hidden="true" />
                        {estado.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <AcaoIcone
                          rotulo={alteravel ? "Editar avaliação" : "Consultar avaliação"}
                          onClick={() => navigate(`/edit-evaluation/${e.id}`)}
                        >
                          <Pencil />
                        </AcaoIcone>
                        <AcaoIcone rotulo="Imprimir avaliação" onClick={() => navigate(`/print/${e.id}`)}>
                          <Printer />
                        </AcaoIcone>
                        {(alteravel || e.operationId) && (
                          <AcaoIcone
                            rotulo={e.operationId ? "Relatório de operação" : "Criar relatório de operação"}
                            onClick={() => navigate(`/operation/${e.id}`)}
                          >
                            <ClipboardList />
                          </AcaoIcone>
                        )}
                        {alteravel && e.assignedUserId && e.assignedUserPhone && (
                          <AcaoIcone
                            rotulo="Notificar militar por WhatsApp"
                            variante="destaque"
                            onClick={() => setSelectedEvaluation(e)}
                          >
                            <MessageCircle />
                          </AcaoIcone>
                        )}
                        {alteravel && (
                          <AcaoIcone
                            rotulo="Eliminar avaliação"
                            variante="perigo"
                            onClick={() => handleDelete(e.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 />
                          </AcaoIcone>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-ral-50 border-t border-ral-200 text-xs text-ral-500">
            {evaluations.length} avaliação(ões) encontrada(s)
          </div>
        </div>
      )}

      <Dialog open={Boolean(selectedEvaluation)} onOpenChange={(aberto) => !aberto && setSelectedEvaluation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificar militar por WhatsApp</DialogTitle>
            <DialogDescription>
              A mensagem não é enviada automaticamente: é registada e aberta no WhatsApp para confirmar o
              envio.
            </DialogDescription>
          </DialogHeader>
          {selectedEvaluation && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-semibold text-ral-700">Militar</dt>
              <dd>
                {[selectedEvaluation.assignedUserRank, selectedEvaluation.assignedUserName].filter(Boolean).join(" ")}
              </dd>
              <dt className="font-semibold text-ral-700">Telefone</dt>
              <dd>{selectedEvaluation.assignedUserPhone}</dd>
              <dt className="font-semibold text-ral-700">Data prevista</dt>
              <dd>{selectedEvaluation.scheduledDate ? formatarData(selectedEvaluation.scheduledDate) : "Não definida"}</dd>
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEvaluation(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => sendNotificationMutation.mutate({ operationId: selectedEvaluation.operationId })}
              disabled={sendNotificationMutation.isPending}
            >
              <MessageCircle className="w-4 h-4" />
              {sendNotificationMutation.isPending ? "A registar..." : "Abrir no WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
