import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Loader2, Trash2, MessageCircle, Flag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export default function OperationsStatistics() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<any>(null);
  const [notificationSending, setNotificationSending] = useState(false);

  const { data: months, isLoading: monthsLoading } = trpc.operations.getMonths.useQuery();
  const {
    data: operations,
    isLoading: operationsLoading,
    refetch,
  } = trpc.operations.getByMonth.useQuery({
    month: selectedMonth === "all" ? undefined : selectedMonth,
  });

  const deleteMany = trpc.operations.deleteMany.useMutation({
    onSuccess: () => {
      toast.success("Operações eliminadas.");
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      refetch();
    },
    onError: (error) => toast.error(`Erro ao eliminar: ${error.message}`),
  });

  const sendNotificationMutation = trpc.operations.sendNotification.useMutation({
    onSuccess: (result: any) => {
      toast.success("Notificação registada. Abra o WhatsApp para enviar a mensagem.");
      if (result.whatsappLink) {
        window.open(result.whatsappLink, "_blank", "noopener,noreferrer");
      }
      setShowNotificationModal(false);
      setSelectedOperation(null);
    },
    onError: (error) => toast.error(`Erro ao registar notificação: ${error.message}`),
  });

  const handleSendNotification = (operation: any) => {
    setSelectedOperation(operation);
    setShowNotificationModal(true);
  };

  const confirmSendNotification = async () => {
    if (!selectedOperation) return;
    setNotificationSending(true);
    try {
      await sendNotificationMutation.mutateAsync({
        operationId: selectedOperation.id,
        userId: selectedOperation.assignedUserId,
        phoneNumber: selectedOperation.assignedUserPhone || "",
        militarName: selectedOperation.assignedUserName || "Militar",
        scheduledDate: selectedOperation.scheduledDate || new Date().toISOString().split("T")[0],
      });
    } finally {
      setNotificationSending(false);
    }
  };

  const sortedMonths = useMemo(() => {
    if (!months) return [];
    return [...months].sort((a, b) => {
      const indexA = MESES.indexOf(a);
      const indexB = MESES.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [months]);

  const handleSelectAll = (checked: boolean) => {
    if (checked && operations) {
      setSelectedIds(new Set(operations.map((op: any) => op.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const confirmDelete = async () => {
    await deleteMany.mutateAsync({ ids: Array.from(selectedIds) });
  };

  const exportToExcel = async () => {
    if (!operations || operations.length === 0) {
      toast.error("Nenhuma operação para exportar.");
      return;
    }

    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");

      const headerRow = [
        "ID Op ",
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

      const data = operations.map((op: any, idx: number) => {
        let mes = "";
        if (op.dataOp) {
          const mesNum = parseInt(op.dataOp.substring(2, 4), 10);
          mes = MESES[mesNum - 1] || "";
        }

        return [
          idx,
          op.preenchimentoSecOp || "",
          mes,
          op.gdhSaidaUi || "",
          op.gdhEntradaUi || "",
          op.efetivTotalReuniao || "",
          op.cmdtForcaReuniao || "",
          op.cmdtOp || "",
          "",
          "",
          "",
          op.efetivTotalOperacao || "",
          op.viaturasCaracterizadasOperacao || "",
          op.kmTotaisOperacao || "",
          op.cterOperacao || "",
          op.dterOperacao || "",
          op.pterZaOperacao || "",
          op.entidadeSolicitadora || "",
          op.forcaTitularInqueritos || "",
          op.custosCombustiveis || "",
          op.custosPortagens || "",
          op.obsVisados || "",
          "",
          "",
          "",
          "",
          op.apontamentosNotas || "",
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headerRow, subHeaderRow, ...data]);

      ws["!cols"] = [
        { wch: 8 },
        { wch: 20 },
        { wch: 8 },
        { wch: 12 },
        { wch: 12 },
        { wch: 8 },
        { wch: 15 },
        { wch: 15 },
        { wch: 6 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 8 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
        { wch: 30 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reg. Operações");
      XLSX.writeFile(
        wb,
        `operacoes_${selectedMonth === "all" ? "todas" : selectedMonth}_${new Date().getFullYear()}.xlsx`,
      );
      toast.success("Ficheiro exportado.");
    } catch (error) {
      toast.error("Erro ao exportar o ficheiro.");
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = monthsLoading || operationsLoading;
  const allSelected = !!operations && operations.length > 0 && selectedIds.size === operations.length;
  const someSelected = selectedIds.size > 0;

  const estado = (preenchido: unknown) => (preenchido ? "Sim" : "Não");

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: "#1a472a" }}>
          Operações — Estatística
        </h2>
        <Button
          onClick={exportToExcel}
          disabled={isExporting || !operations || operations.length === 0}
          style={{ background: "#1a472a" }}
        >
          <Download className="w-4 h-4 mr-2" />
          {isExporting ? "A exportar..." : "Exportar para Excel"}
        </Button>
      </div>

      <div className="mb-6 flex gap-4 items-center">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
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

        {someSelected && (
          <Button onClick={() => setShowDeleteDialog(true)} variant="destructive" size="sm">
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar selecionadas ({selectedIds.size})
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : !operations || operations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Nenhuma operação encontrada.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr style={{ background: "#1a472a", color: "white" }}>
                <th className="border border-gray-300 p-2 text-left">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                {[
                  "Nº Op",
                  "Atividade",
                  "Mês",
                  "Início",
                  "Fim",
                  "Horas",
                  "Cmdt Força",
                  "Total",
                  "Viaturas",
                  "KM",
                  "CTer",
                  "DTer",
                  "Entidade",
                  "Custos comb.",
                  "Custos port.",
                  "Observações",
                  "Operação",
                  "Consumos",
                  "Obs.",
                  "Ações",
                ].map((h) => (
                  <th key={h} className="border border-gray-300 p-2 text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operations.map((op: any) => (
                <tr key={op.id} className={selectedIds.has(op.id) ? "bg-blue-50" : "hover:bg-gray-50"}>
                  <td className="border border-gray-300 p-2">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar operação ${op.id}`}
                      checked={selectedIds.has(op.id)}
                      onChange={(e) => handleSelectOne(op.id, e.target.checked)}
                    />
                  </td>
                  <td className="border border-gray-300 p-2">{op.operacaoNumero || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.preenchimentoSecOp || "-"}</td>
                  <td className="border border-gray-300 p-2">
                    {op.dataOp ? op.dataOp.substring(2, 5) : "-"}
                  </td>
                  <td className="border border-gray-300 p-2">{op.gdhSaidaUi || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.gdhEntradaUi || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.efetivTotalReuniao || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.cmdtOp || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.efetivTotalOperacao || "-"}</td>
                  <td className="border border-gray-300 p-2">
                    {op.viaturasCaracterizadasOperacao || "-"}
                  </td>
                  <td className="border border-gray-300 p-2">{op.kmTotaisOperacao || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.cterOperacao || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.dterOperacao || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.entidadeSolicitadora || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.custosCombustiveis || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.custosPortagens || "-"}</td>
                  <td className="border border-gray-300 p-2">{op.apontamentosNotas || "-"}</td>
                  <td className="border border-gray-300 p-2">{estado(op.operacaoPreenchida)}</td>
                  <td className="border border-gray-300 p-2">{estado(op.consumosPreenchidos)}</td>
                  <td className="border border-gray-300 p-2">
                    <div className="flex items-center gap-1">
                      {estado(op.observacoesPreenchidas)}
                      {op.flaggedForCompletion ? (
                        <Flag className="w-3 h-3 text-red-600" aria-label="Sinalizada" />
                      ) : null}
                    </div>
                  </td>
                  <td className="border border-gray-300 p-2">
                    {op.flaggedForCompletion && op.assignedUserId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendNotification(op)}
                        className="text-xs"
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Notificar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminação</AlertDialogTitle>
            <AlertDialogDescription>
              Eliminar {selectedIds.size} operação(ões)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} style={{ background: "#dc2626" }}>
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showNotificationModal} onOpenChange={setShowNotificationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificar militar por WhatsApp</DialogTitle>
            <DialogDescription>
              A mensagem é registada e aberta no WhatsApp; o envio é confirmado por si.
            </DialogDescription>
          </DialogHeader>
          {selectedOperation && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Militar</p>
                <p className="text-sm text-gray-600">
                  {[selectedOperation.assignedUserRank, selectedOperation.assignedUserName]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Telefone</p>
                <p className="text-sm text-gray-600">{selectedOperation.assignedUserPhone || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Data prevista</p>
                <p className="text-sm text-gray-600">{selectedOperation.scheduledDate || "—"}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotificationModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmSendNotification}
              disabled={notificationSending}
              style={{ background: "#1a472a" }}
            >
              {notificationSending ? "A registar..." : "Abrir no WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
