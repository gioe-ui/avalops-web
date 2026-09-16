import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cterDaAvaliacao } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Trash2, Search, FileText, MessageCircle, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const NEOP_COLORS: Record<string, string> = {
  "2º NEOP": "#1a472a",
  "3º NEOP": "#b8860b",
  "4º NEOP": "#8b0000",
};

const getStatusColor = (evaluation: any): { color: string; label: string } => {
  if (!evaluation.operationId) {
    return { color: "#dc2626", label: "Sem informação" };
  }

  if (
    !evaluation.operacaoPreenchida &&
    !evaluation.consumosPreenchidos &&
    !evaluation.observacoesPreenchidas
  ) {
    return { color: "#dc2626", label: "Não iniciada" };
  }

  if (
    !evaluation.operacaoPreenchida ||
    !evaluation.consumosPreenchidos ||
    !evaluation.observacoesPreenchidas
  ) {
    return { color: "#eab308", label: "Parcialmente preenchida" };
  }

  return { color: "#22c55e", label: "Completa" };
};

const extractCter = (evaluation: any): string => cterDaAvaliacao(evaluation) ?? "—";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [filterNeop, setFilterNeop] = useState("all");
  const [filterAvaliador, setFilterAvaliador] = useState("");
  const [avaliadorInput, setAvaliadorInput] = useState("");
  const [filterCter, setFilterCter] = useState("all");
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null);
  const [notificationSending, setNotificationSending] = useState(false);
  const [selectedEvaluations, setSelectedEvaluations] = useState<Set<number>>(new Set());
  const utils = trpc.useUtils();

  const { data: evaluations, isLoading } = trpc.evaluations.list.useQuery({
    neop: filterNeop === "all" ? undefined : filterNeop,
    avaliador: filterAvaliador || undefined,
    cterRequerente: filterCter === "all" ? undefined : filterCter,
  });

  const { data: cters, isLoading: ctersLoading } = trpc.evaluations.getCters.useQuery();

  const deleteMutation = trpc.evaluations.delete.useMutation({
    onSuccess: () => {
      toast.success("Avaliação eliminada.");
      utils.evaluations.list.invalidate();
      utils.statistics.get.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const sendNotificationMutation = trpc.operations.sendNotification.useMutation({
    onSuccess: (result: any) => {
      toast.success("Notificação registada. Abra o WhatsApp para enviar a mensagem.");
      if (result.whatsappLink) {
        window.open(result.whatsappLink, "_blank", "noopener,noreferrer");
      }
      setShowNotificationModal(false);
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
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEvaluations(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && evaluations) {
      setSelectedEvaluations(new Set(evaluations.map((e: any) => e.id)));
    } else {
      setSelectedEvaluations(new Set());
    }
  };

  const handleDeleteSelected = () => {
    if (selectedEvaluations.size === 0) {
      toast.error("Selecione pelo menos uma avaliação.");
      return;
    }
    if (confirm(`Eliminar ${selectedEvaluations.size} avaliação(ões)?`)) {
      selectedEvaluations.forEach((id) => deleteMutation.mutate({ id }));
      setSelectedEvaluations(new Set());
    }
  };

  const handleSendNotification = (evaluation: any) => {
    setSelectedEvaluation(evaluation);
    setShowNotificationModal(true);
  };

  const confirmSendNotification = async () => {
    if (!selectedEvaluation) return;
    setNotificationSending(true);
    try {
      await sendNotificationMutation.mutateAsync({
        operationId: selectedEvaluation.operationId,
        userId: selectedEvaluation.assignedUserId,
        phoneNumber: selectedEvaluation.assignedUserPhone || "",
        militarName: selectedEvaluation.assignedUserName || "Militar",
        scheduledDate:
          selectedEvaluation.scheduledDate || new Date().toISOString().split("T")[0],
      });
    } finally {
      setNotificationSending(false);
    }
  };

  /**
   * A versão anterior carregava a biblioteca de Excel de um CDN externo em
   * tempo de execução. Agora vem do pacote instalado — o site não depende de
   * mais nada além do Supabase.
   */
  const exportToExcel = async () => {
    if (!evaluations || evaluations.length === 0) {
      toast.error("Nenhuma avaliação para exportar.");
      return;
    }

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(
      evaluations.map((e: any) => ({
        Data: new Date(e.createdAt).toLocaleDateString("pt-PT"),
        NUIPC: e.nuipc,
        POC: e.pocNome,
        Posto: e.pocPosto,
        Pontuação: e.pontuacao,
        NEOP: e.neop,
        Avaliador: e.avaliador,
        CTer: extractCter(e),
        Parecer: e.parecer,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Avaliações");
    XLSX.writeFile(wb, "avaliacoes_GIOE.xlsx");
  };

  const applyFilter = () => setFilterAvaliador(avaliadorInput);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: "#1a472a" }}>
          Histórico de Avaliações
        </h2>
        <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white">
          <Download className="w-4 h-4 mr-2" />
          Exportar para Excel
        </Button>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">
              Filtrar por NEOP
            </Label>
            <Select value={filterNeop} onValueChange={setFilterNeop}>
              <SelectTrigger className="border-2 focus:border-[#1a472a]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="2º NEOP">2º NEOP</SelectItem>
                <SelectItem value="3º NEOP">3º NEOP</SelectItem>
                <SelectItem value="4º NEOP">4º NEOP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">
              Filtrar por CTer
            </Label>
            <Select value={filterCter} onValueChange={setFilterCter}>
              <SelectTrigger className="border-2 focus:border-[#1a472a]">
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
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">
              Filtrar por avaliador
            </Label>
            <Input
              placeholder="Nome do avaliador"
              value={avaliadorInput}
              onChange={(e) => setAvaliadorInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilter} style={{ background: "#1a472a" }}>
              <Search className="w-4 h-4 mr-2" />
              Pesquisar
            </Button>
            {selectedEvaluations.size > 0 && (
              <Button
                onClick={handleDeleteSelected}
                variant="destructive"
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar ({selectedEvaluations.size})
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : !evaluations || evaluations.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-400 text-sm">Nenhuma avaliação encontrada.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#1a472a" }}>
                <th className="text-white text-left px-2 py-3 font-semibold w-8">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas"
                    checked={
                      selectedEvaluations.size > 0 &&
                      selectedEvaluations.size === evaluations.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                {[
                  "Data",
                  "POC",
                  "Pontuação",
                  "NEOP",
                  "Avaliador",
                  "CTer",
                  "Militar atribuído",
                  "Estado",
                  "Ação",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-white text-left px-2 py-3 font-semibold whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e: any, i: number) => (
                <tr
                  key={`eval-${e.id}`}
                  className={`border-b border-gray-100 hover:bg-green-50 transition-colors ${
                    i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  <td className="px-2 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar avaliação ${e.id}`}
                      checked={selectedEvaluations.has(e.id)}
                      onChange={() => handleSelectEvaluation(e.id)}
                    />
                  </td>
                  <td className="px-2 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {new Date(e.createdAt).toLocaleDateString("pt-PT")}
                  </td>
                  <td
                    className="px-2 py-3 font-medium text-gray-800 truncate max-w-[80px]"
                    title={e.pocNome || ""}
                  >
                    {e.pocNome || "—"}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className="font-bold text-xs" style={{ color: "#1a472a" }}>
                      {e.pontuacao}
                    </span>
                    <span className="text-gray-400 text-xs">/100</span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span
                      className="px-2 py-1 rounded-full text-white text-xs font-bold"
                      style={{ background: NEOP_COLORS[e.neop] ?? "#1a472a" }}
                    >
                      {e.neop}
                    </span>
                  </td>
                  <td
                    className="px-2 py-3 text-gray-600 truncate max-w-[100px]"
                    title={e.avaliador || ""}
                  >
                    {e.avaliador || "—"}
                  </td>
                  <td
                    className="px-2 py-3 text-gray-600 truncate max-w-[80px]"
                    title={extractCter(e)}
                  >
                    {extractCter(e)}
                  </td>
                  <td className="px-2 py-3 text-gray-600 truncate max-w-[150px]">
                    {e.assignedUserRank && e.assignedUserName
                      ? `${e.assignedUserRank} ${e.assignedUserName}`
                      : "—"}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    {e.operationId ? (
                      <div className="flex items-center gap-1" title={getStatusColor(e).label}>
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getStatusColor(e).color }}
                        />
                        <span className="text-xs text-gray-600 truncate max-w-[100px]">
                          {getStatusColor(e).label}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 flex gap-1 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/edit-evaluation/${e.id}`)}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs px-2 py-1 h-auto"
                      title="Editar avaliação"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    {e.assignedUserId && e.assignedUserPhone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendNotification(e)}
                        className="border-green-600 text-green-600 hover:bg-green-50 text-xs px-2 py-1 h-auto"
                        title="Notificar militar"
                      >
                        <MessageCircle className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/operation/${e.id}`)}
                      className="border-orange-600 text-orange-600 hover:bg-orange-50 text-xs px-2 py-1 h-auto"
                      title="Relatório de operação"
                    >
                      <FileText className="w-3 h-3" />
                    </Button>
                    {e.operationId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/operation-detail/${e.operationId}`)}
                        className="border-purple-600 text-purple-600 hover:bg-purple-50 text-xs px-2 py-1 h-auto"
                        title="Detalhe da operação"
                      >
                        <FileText className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(e.id)}
                      disabled={deleteMutation.isPending}
                      className="border-red-600 text-red-600 hover:bg-red-50 text-xs px-2 py-1 h-auto"
                      title="Eliminar avaliação"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            {evaluations.length} avaliação(ões) encontrada(s)
          </div>
        </div>
      )}

      <Dialog open={showNotificationModal} onOpenChange={setShowNotificationModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificar militar por WhatsApp</DialogTitle>
            <DialogDescription>
              A mensagem não é enviada automaticamente: é registada e aberta no WhatsApp para
              confirmar o envio.
            </DialogDescription>
          </DialogHeader>
          {selectedEvaluation && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Militar</Label>
                <p className="text-sm text-gray-600">
                  {selectedEvaluation.assignedUserRank} {selectedEvaluation.assignedUserName}
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Telefone</Label>
                <p className="text-sm text-gray-600">{selectedEvaluation.assignedUserPhone}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Data prevista da operação</Label>
                <p className="text-sm text-gray-600">
                  {selectedEvaluation.scheduledDate
                    ? new Date(selectedEvaluation.scheduledDate).toLocaleDateString("pt-PT")
                    : "Não definida"}
                </p>
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
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {notificationSending ? "A registar..." : "Abrir no WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
