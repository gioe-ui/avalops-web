import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { MESES, formatarData, horasEntreGdh, horasEntreGdhNumero, mesDeData } from "@/lib/datas";
import { exportarFolha, numeroSePossivel } from "@/lib/exportar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClipboardList, Download, Flag, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AcaoIcone } from "@/components/AcaoIcone";

const SimNao = ({ valor }: { valor: unknown }) =>
  valor ? (
    <span className="text-ok font-semibold">Sim</span>
  ) : (
    <span className="text-ral-400">Não</span>
  );

export default function OperationsStatistics() {
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<any>(null);
  const utils = trpc.useUtils();

  const { data: months, isLoading: monthsLoading } = trpc.operations.getMonths.useQuery();
  const { data: operations, isLoading: operationsLoading } = trpc.operations.getByMonth.useQuery({
    month: selectedMonth === "all" ? undefined : selectedMonth,
  });

  /** O autor da avaliação ou um administrador (imposto pela base de dados). */
  const podeGerir = (op: any) => isAdmin || op.autorAvaliacaoId === user?.id;

  const invalidar = () => {
    void utils.operations.invalidate();
    void utils.evaluations.invalidate();
  };

  const deleteMany = trpc.operations.deleteMany.useMutation({
    onSuccess: ({ eliminadas, pedidas }) => {
      if (eliminadas === pedidas) toast.success(`${eliminadas} operação(ões) eliminada(s).`);
      else toast.warning(`Eliminadas ${eliminadas} de ${pedidas}. As restantes não pode eliminar.`);
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      invalidar();
    },
    onError: (error) => toast.error(`Erro ao eliminar: ${error.message}`),
  });

  const sinalizar = trpc.operations.flagIncompleteOperations.useMutation({
    onSuccess: ({ flagged }) => {
      toast.success(
        flagged > 0
          ? `${flagged} operação(ões) sinalizada(s) como incompleta(s).`
          : "Não há operações atribuídas por completar.",
      );
      invalidar();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendNotificationMutation = trpc.operations.sendNotification.useMutation({
    onSuccess: (result) => {
      toast.success("Notificação registada. Confirme o envio no WhatsApp.");
      window.open(result.whatsappLink, "_blank", "noopener,noreferrer");
      setSelectedOperation(null);
    },
    onError: (error) => toast.error(`Erro ao registar notificação: ${error.message}`),
  });

  const sortedMonths = useMemo(() => {
    if (!months) return [];
    return [...months].sort((a, b) => {
      const indexA = MESES.indexOf(a);
      const indexB = MESES.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [months]);

  const geriveis = (operations ?? []).filter(podeGerir);
  // Só conta o que está à vista: uma operação selecionada noutro mês nunca é
  // eliminada por engano.
  const selecionadas: number[] = geriveis.filter((op: any) => selectedIds.has(op.id)).map((op: any) => op.id);

  // Mudar de mês começa uma seleção nova.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedMonth]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(geriveis.map((op: any) => op.id)) : new Set());
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const exportToExcel = async () => {
    if (!operations || operations.length === 0) {
      toast.error("Nenhuma operação para exportar.");
      return;
    }

    setIsExporting(true);
    try {
      const headerRow = [
        "ID Op",
        "",
        "LOCALIZAÇÃO TEMPORAL",
        "",
        "",
        "",
        "EFETIVO",
        "",
        "",
        "",
        "",
        "",
        "LOGÍSTICA",
        "",
        "ÁREA OPERAÇÕES",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "RESULTADOS",
        "",
        "",
        "",
        "OBSERVAÇÕES",
      ];

      const subHeaderRow = [
        "Nº Op",
        "Atividade",
        "Mês",
        "Início",
        "Fim",
        "Horas",
        "Destacamento",
        "Cmdt Força GIOE",
        "Of's",
        "Sarg's",
        "Grd's",
        "Total",
        "Viaturas",
        "KM",
        "CTer",
        "DTer",
        "Área Operações",
        "Entidade Requisitante",
        "Força Titular do Inquérito",
        "Custos Combustíveis (€)",
        "Custos Portagens (€)",
        "Observações Visados",
        "Armas",
        "Detidos",
        "Feridos",
        "Mortos",
        "",
      ];

      const linhas = operations.map((op: any) => [
        op.operacaoNumero || op.id,
        op.preenchimentoSecOp || "",
        mesDeData(op.dataOp),
        op.gdhSaidaUi || "",
        op.gdhEntradaUi || "",
        horasEntreGdhNumero(op.gdhSaidaUi, op.gdhEntradaUi),
        op.cmdtForcaReuniao || "",
        op.cmdtOp || "",
        "",
        "",
        "",
        numeroSePossivel(op.efetivTotalOperacao),
        op.viaturasCaracterizadasOperacao ?? "",
        numeroSePossivel(op.kmTotaisOperacao),
        op.cterOperacao || "",
        op.dterOperacao || "",
        op.pterZaOperacao || "",
        op.entidadeSolicitadora || "",
        op.forcaTitularInqueritos ?? "",
        numeroSePossivel(op.custosCombustiveis),
        numeroSePossivel(op.custosPortagens),
        op.obsVisados || "",
        "",
        "",
        "",
        "",
        op.apontamentosNotas || "",
      ]);

      await exportarFolha({
        nomeFicheiro: `operacoes_${selectedMonth === "all" ? "todas" : selectedMonth}_${new Date().getFullYear()}.xlsx`,
        nomeFolha: "Reg. Operações",
        cabecalhos: [headerRow, subHeaderRow],
        linhas,
        larguras: [10, 20, 8, 14, 14, 8, 15, 15, 6, 8, 8, 8, 10, 8, 12, 12, 15, 20, 20, 12, 12, 30, 8, 8, 8, 8, 30],
      });
      void api.audit.registar({
        acao: "EXPORT",
        detalhe: { recurso: "operations", linhas: linhas.length, mes: selectedMonth },
      });
      toast.success("Ficheiro exportado.");
    } catch {
      toast.error("Erro ao exportar o ficheiro.");
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = monthsLoading || operationsLoading;
  const allSelected = geriveis.length > 0 && selecionadas.length === geriveis.length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-ral-800">Operações — estatística</h2>
          <p className="text-sm text-ral-500">Registo mensal para a SEC Op</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <Button variant="outline" onClick={() => sinalizar.mutate(undefined as never)} disabled={sinalizar.isPending}>
              <Flag className="w-4 h-4" />
              Sinalizar incompletas
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => void exportToExcel()}
            disabled={isExporting || !operations || operations.length === 0}
          >
            <Download className="w-4 h-4" />
            {isExporting ? "A exportar..." : "Exportar para Excel"}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex gap-4 items-center flex-wrap">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48 bg-white" aria-label="Mês">
            <SelectValue placeholder="Selecione um mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {sortedMonths.map((month) => (
              <SelectItem key={month} value={month}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selecionadas.length > 0 && (
          <Button onClick={() => setShowDeleteDialog(true)} variant="destructive" size="sm">
            <Trash2 className="w-4 h-4" />
            Eliminar selecionadas ({selecionadas.length})
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-ral-400" />
        </div>
      ) : !operations || operations.length === 0 ? (
        <div className="text-center py-12 text-ral-500 bg-white rounded-lg border border-dashed border-ral-300">
          Nenhuma operação encontrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <caption className="sr-only">Operações</caption>
            <thead>
              <tr className="bg-ral-700 text-white">
                <th scope="col" className="p-2 text-left">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas as operações que pode eliminar"
                    checked={allSelected}
                    disabled={geriveis.length === 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                {[
                  "Nº Op",
                  "Atividade",
                  "Data",
                  "Mês",
                  "Início",
                  "Fim",
                  "Horas",
                  "Cmdt Op",
                  "Efetivo",
                  "Viaturas",
                  "KM",
                  "CTer",
                  "DTer",
                  "Entidade",
                  "Operação",
                  "Consumos",
                  "Obs.",
                  "Ações",
                ].map((h) => (
                  <th key={h} scope="col" className="p-2 text-left whitespace-nowrap font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operations.map((op: any) => {
                const gerivel = podeGerir(op);
                return (
                  <tr
                    key={op.id}
                    className={`border-b border-ral-100 ${selectedIds.has(op.id) ? "bg-latao-100" : "even:bg-ral-50/60 hover:bg-latao-100/50"}`}
                  >
                    <td className="p-2">
                      {gerivel ? (
                        <input
                          type="checkbox"
                          aria-label={`Selecionar operação ${op.operacaoNumero || op.id}`}
                          checked={selectedIds.has(op.id)}
                          onChange={(e) => handleSelectOne(op.id, e.target.checked)}
                        />
                      ) : null}
                    </td>
                    <td className="p-2 whitespace-nowrap font-medium text-ral-900">{op.operacaoNumero || `#${op.id}`}</td>
                    <td className="p-2">{op.preenchimentoSecOp || "—"}</td>
                    <td className="p-2 whitespace-nowrap">{op.dataOp ? formatarData(op.dataOp) : "—"}</td>
                    <td className="p-2">{mesDeData(op.dataOp) || "—"}</td>
                    <td className="p-2 font-mono text-xs">{op.gdhSaidaUi || "—"}</td>
                    <td className="p-2 font-mono text-xs">{op.gdhEntradaUi || "—"}</td>
                    <td className="p-2">{horasEntreGdh(op.gdhSaidaUi, op.gdhEntradaUi) || "—"}</td>
                    <td className="p-2">{op.cmdtOp || "—"}</td>
                    <td className="p-2">{op.efetivTotalOperacao || "—"}</td>
                    <td className="p-2">{op.viaturasCaracterizadasOperacao || "—"}</td>
                    <td className="p-2">{op.kmTotaisOperacao || "—"}</td>
                    <td className="p-2">{op.cterOperacao || "—"}</td>
                    <td className="p-2">{op.dterOperacao || "—"}</td>
                    <td className="p-2">{op.entidadeSolicitadora || "—"}</td>
                    <td className="p-2">
                      <SimNao valor={op.operacaoPreenchida} />
                    </td>
                    <td className="p-2">
                      <SimNao valor={op.consumosPreenchidos} />
                    </td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1">
                        <SimNao valor={op.observacoesPreenchidas} />
                        {op.flaggedForCompletion ? (
                          <Flag className="w-3 h-3 text-erro" aria-label="Sinalizada como incompleta" />
                        ) : null}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <AcaoIcone rotulo="Abrir relatório" onClick={() => navigate(`/operation/${op.evaluationId}`)}>
                          <ClipboardList />
                        </AcaoIcone>
                        {gerivel && op.assignedUserId && op.assignedUserPhone && (
                          <AcaoIcone
                            rotulo="Notificar militar por WhatsApp"
                            variante={op.flaggedForCompletion ? "destaque" : "normal"}
                            onClick={() => setSelectedOperation(op)}
                          >
                            <MessageCircle />
                          </AcaoIcone>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminação</AlertDialogTitle>
            <AlertDialogDescription>
              Eliminar {selecionadas.length} operação(ões)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMany.mutate({ ids: selecionadas })}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(selectedOperation)} onOpenChange={(aberto) => !aberto && setSelectedOperation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificar militar por WhatsApp</DialogTitle>
            <DialogDescription>A mensagem é registada e aberta no WhatsApp; o envio é confirmado por si.</DialogDescription>
          </DialogHeader>
          {selectedOperation && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-semibold text-ral-700">Militar</dt>
              <dd>
                {[selectedOperation.assignedUserRank, selectedOperation.assignedUserName].filter(Boolean).join(" ") || "—"}
              </dd>
              <dt className="font-semibold text-ral-700">Telefone</dt>
              <dd>{selectedOperation.assignedUserPhone || "—"}</dd>
              <dt className="font-semibold text-ral-700">Data prevista</dt>
              <dd>{selectedOperation.scheduledDate ? formatarData(selectedOperation.scheduledDate) : "—"}</dd>
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOperation(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => sendNotificationMutation.mutate({ operationId: selectedOperation.id })}
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
