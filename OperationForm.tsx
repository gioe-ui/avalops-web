import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Printer, Save, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIPOS_EMPENHO = [
  "Intervenção Tática",
  "Op. Segurança",
  "Apoio",
  "ITP",
  "SIC UI",
  "Exercício",
  "Plastron",
  "Demonstração",
];

const ENTIDADES = ["CO", "CTer", "PSP", "PJ", "Outra"];

type FormState = {
  refFiledoc: string;
  operacaoNumero: string;
  preenchimentoSecOp: string;
  cmdtOp: string;
  dataOp: string;
  tipoEmpenho: string;
  missao: string;
  entidadeSolicitadora: string;

  local: string;
  obsReuniao: string;
  gdhSaidaUi: string;
  gdhEntradaUi: string;
  cmdtForcaReuniao: string;
  indicativoRadioReuniao: string;
  efetivTotalReuniao: string;
  viaturasCaracterizadasReuniao: number;
  viaturasDescaracterizadasReuniao: number;
  viaturasEspeciaisReuniao: number;
  kmTotaisReuniao: string;

  cterOperacao: string;
  dterOperacao: string;
  pterZaOperacao: string;
  gdhInicioOperacao: string;
  gdhChegadaUiOperacao: string;
  cmdtForcaOperacao: string;
  indicativoRadioOperacao: string;
  efetivTotalOperacao: string;
  viaturasCaracterizadasOperacao: number;
  viaturasDescaracterizadasOperacao: number;
  viaturasEspeciaisOperacao: number;
  kmTotaisOperacao: string;

  itpTipo: string;
  gdhInicioItp: string;
  gdhFimItp: string;

  forcaTitularInqueritos: number;
  custosPortagens: string;
  custosCombustiveis: string;
  obsVisados: string;

  municoesArmasAuto762: number;
  municoesArmasAuto9Mm: number;
  municoesArmasAuto762Mm: number;
  municoesArmasAuto556Mm: number;
  municoesArmasAuto556: number;
  municoesCacadeiraBarracha: number;
  municoesCacadeiraChumbo: number;
  municoesCacadeiraBeamBag: number;
  municoesCacadeiraZagalote: number;
  municoesCacadeiraZinco: number;
  municoesRevolverAsp: number;
  taserCargaX26: number;
  taserGranadaFlashBang1Estalo: number;
  taserGranadaFlashBang1Estalo2Bang: number;
  taserGranadaFlashBang2Estalos2Bangs: number;
  taserGranadaFlashBangMultiplos: number;
  taserAlgemas: string;
  obsConsumos: string;

  obsSecOp: string;
  regSecOp: string;
  excelSecOp: boolean;
  apontamentosNotas: string;
  croquis: string;
};

const DEFAULT_FORM: FormState = {
  refFiledoc: "",
  operacaoNumero: "",
  preenchimentoSecOp: "",
  cmdtOp: "",
  dataOp: "",
  tipoEmpenho: "",
  missao: "",
  entidadeSolicitadora: "",

  local: "",
  obsReuniao: "",
  gdhSaidaUi: "",
  gdhEntradaUi: "",
  cmdtForcaReuniao: "",
  indicativoRadioReuniao: "",
  efetivTotalReuniao: "",
  viaturasCaracterizadasReuniao: 0,
  viaturasDescaracterizadasReuniao: 0,
  viaturasEspeciaisReuniao: 0,
  kmTotaisReuniao: "",

  cterOperacao: "",
  dterOperacao: "",
  pterZaOperacao: "",
  gdhInicioOperacao: "",
  gdhChegadaUiOperacao: "",
  cmdtForcaOperacao: "",
  indicativoRadioOperacao: "",
  efetivTotalOperacao: "",
  viaturasCaracterizadasOperacao: 0,
  viaturasDescaracterizadasOperacao: 0,
  viaturasEspeciaisOperacao: 0,
  kmTotaisOperacao: "",

  itpTipo: "",
  gdhInicioItp: "",
  gdhFimItp: "",

  forcaTitularInqueritos: 0,
  custosPortagens: "",
  custosCombustiveis: "",
  obsVisados: "",

  municoesArmasAuto762: 0,
  municoesArmasAuto9Mm: 0,
  municoesArmasAuto762Mm: 0,
  municoesArmasAuto556Mm: 0,
  municoesArmasAuto556: 0,
  municoesCacadeiraBarracha: 0,
  municoesCacadeiraChumbo: 0,
  municoesCacadeiraBeamBag: 0,
  municoesCacadeiraZagalote: 0,
  municoesCacadeiraZinco: 0,
  municoesRevolverAsp: 0,
  taserCargaX26: 0,
  taserGranadaFlashBang1Estalo: 0,
  taserGranadaFlashBang1Estalo2Bang: 0,
  taserGranadaFlashBang2Estalos2Bangs: 0,
  taserGranadaFlashBangMultiplos: 0,
  taserAlgemas: "",
  obsConsumos: "",

  obsSecOp: "",
  regSecOp: "",
  excelSecOp: false,
  apontamentosNotas: "",
  croquis: "",
};

export default function OperationForm() {
  const { evaluationId } = useParams();
  const [, navigate] = useLocation();
  const evalId = Number(evaluationId ?? 0);
  const habilitado = Number.isFinite(evalId) && evalId > 0;

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMilitar, setSelectedMilitar] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  const utils = trpc.useUtils();

  const getOperationQuery = trpc.operations.getByEvaluationId.useQuery(
    { evaluationId: evalId },
    { enabled: habilitado },
  );

  const getEvaluationQuery = trpc.evaluations.getById.useQuery(
    { id: evalId },
    { enabled: habilitado },
  );

  const listMilitaresQuery = trpc.operations.listMilitares.useQuery();

  const createOperationMutation = trpc.operations.create.useMutation();
  const updateOperationMutation = trpc.operations.update.useMutation();

  useEffect(() => {
    const data = getOperationQuery.data as Record<string, any> | null | undefined;
    if (!data) return;

    setForm((prev) => {
      const carregado: FormState = { ...prev };
      for (const chave of Object.keys(DEFAULT_FORM) as Array<keyof FormState>) {
        const valor = data[chave];
        if (valor === null || valor === undefined) continue;
        if (chave === "excelSecOp") {
          carregado.excelSecOp = Boolean(valor) && valor !== 0;
        } else if (typeof DEFAULT_FORM[chave] === "number") {
          (carregado[chave] as number) = Number(valor) || 0;
        } else {
          (carregado[chave] as string) = String(valor);
        }
      }
      return carregado;
    });
  }, [getOperationQuery.data]);

  const handleInputChange = useCallback((field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const numero = (valor: string) => {
    const n = parseInt(valor, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const estadoDePreenchimento = () => ({
    operacaoPreenchida:
      form.cterOperacao || form.dterOperacao || form.pterZaOperacao || form.gdhInicioOperacao
        ? 1
        : 0,
    consumosPreenchidos:
      form.municoesArmasAuto762 > 0 || form.municoesArmasAuto9Mm > 0 || form.taserCargaX26 > 0
        ? 1
        : 0,
    observacoesPreenchidas: form.obsSecOp || form.apontamentosNotas ? 1 : 0,
  });

  const gravar = async () => {
    const payload = {
      ...form,
      excelSecOp: form.excelSecOp ? 1 : 0,
      ...estadoDePreenchimento(),
    };

    const existente = getOperationQuery.data;

    if (existente?.id) {
      await updateOperationMutation.mutateAsync({ id: existente.id, ...payload });
      return existente.id;
    }

    await createOperationMutation.mutateAsync({ evaluationId: evalId, ...payload });
    const { data } = await getOperationQuery.refetch();
    return data?.id;
  };

  const handleSave = async () => {
    if (!habilitado) {
      toast.error("Avaliação não identificada.");
      return;
    }

    try {
      await gravar();
      toast.success("Registo de operação guardado.");
      utils.evaluations.list.invalidate();
      utils.operations.getByMonth.invalidate();
      navigate("/");
    } catch (error) {
      toast.error(
        "Erro ao guardar o registo de operação: " +
          (error instanceof Error ? error.message : "erro desconhecido"),
      );
    }
  };

  const assignMutation = trpc.operations.assignToMilitar.useMutation({
    onSuccess: () => {
      toast.success("Operação atribuída.");
      setShowAssignModal(false);
      setSelectedMilitar("");
      setScheduledDate(new Date().toISOString().split("T")[0]);
      getOperationQuery.refetch();
      utils.evaluations.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAssign = async () => {
    if (!selectedMilitar) {
      toast.error("Selecione um militar.");
      return;
    }

    try {
      // Se a operação ainda não existe, é gravada primeiro: a atribuição
      // precisa de um registo ao qual se ligar.
      const operationId = await gravar();

      if (!operationId) {
        toast.error("Não foi possível obter o registo da operação.");
        return;
      }

      assignMutation.mutate({
        operationId,
        assignedUserId: selectedMilitar,
        scheduledDate,
      });
    } catch (error) {
      toast.error(
        "Erro ao guardar a operação antes de atribuir: " +
          (error instanceof Error ? error.message : "erro desconhecido"),
      );
    }
  };

  const handlePrint = () => {
    if (getOperationQuery.data?.id) {
      navigate(`/print-operation/${getOperationQuery.data.id}`);
    } else {
      toast.error("Guarde o registo antes de o imprimir.");
    }
  };

  const aGuardar =
    createOperationMutation.isPending ||
    updateOperationMutation.isPending ||
    assignMutation.isPending;

  const campoTexto = (label: string, campo: keyof FormState, placeholder?: string) => (
    <div>
      <Label className="mb-3 block">{label}</Label>
      <Input
        value={(form[campo] as string) ?? ""}
        onChange={(e) => handleInputChange(campo, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const campoHora = (label: string, campo: keyof FormState) => (
    <div>
      <Label className="mb-3 block">{label}</Label>
      <Input
        type="time"
        value={(form[campo] as string) ?? ""}
        onChange={(e) => handleInputChange(campo, e.target.value)}
      />
    </div>
  );

  const campoNumero = (label: string, campo: keyof FormState) => (
    <div>
      <Label className="mb-3 block">{label}</Label>
      <Input
        type="number"
        min={0}
        value={form[campo] as number}
        onChange={(e) => handleInputChange(campo, numero(e.target.value))}
      />
    </div>
  );

  const campoArea = (label: string, campo: keyof FormState, rows = 3, placeholder?: string) => (
    <div>
      <Label className="mb-3 block">{label}</Label>
      <Textarea
        value={(form[campo] as string) ?? ""}
        onChange={(e) => handleInputChange(campo, e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold" style={{ color: "#1a472a" }}>
              Registo de Dados da Operação
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={aGuardar}>
              <Printer className="w-4 h-4 mr-2" />
              Relatório
            </Button>
            {["2º NEOP", "3º NEOP", "4º NEOP"].includes(getEvaluationQuery.data?.neop || "") && (
              <Button size="sm" variant="outline" onClick={() => setShowAssignModal(true)}>
                <Users className="w-4 h-4 mr-2" />
                Atribuir militar
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={aGuardar} style={{ background: "#1a472a" }}>
              {aGuardar ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <Tabs defaultValue="referencia" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6 h-auto">
              <TabsTrigger value="referencia" className="text-xs sm:text-sm">
                Referência
              </TabsTrigger>
              <TabsTrigger value="reuniao" className="text-xs sm:text-sm">
                Reunião
              </TabsTrigger>
              <TabsTrigger value="operacao" className="text-xs sm:text-sm">
                Operação
              </TabsTrigger>
              <TabsTrigger value="consumos" className="text-xs sm:text-sm">
                Consumos
              </TabsTrigger>
              <TabsTrigger value="observacoes" className="text-xs sm:text-sm">
                Observações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="referencia" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campoTexto("Ref. Filedoc / email / ordem verbal", "refFiledoc", "Referência")}
                {campoTexto("Operação n.º", "operacaoNumero", "Ex.: 001/2026")}
                {campoTexto("Preenchimento SECOp", "preenchimentoSecOp", "Mês (ex.: JAN)")}
                {campoTexto("Cmdt Op", "cmdtOp")}
                <div>
                  <Label className="mb-3 block">Data Op</Label>
                  <Input
                    type="date"
                    value={form.dataOp}
                    onChange={(e) => handleInputChange("dataOp", e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Tipo de empenho</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {TIPOS_EMPENHO.map((tipo) => (
                    <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={form.tipoEmpenho === tipo}
                        onCheckedChange={(checked) =>
                          handleInputChange("tipoEmpenho", checked ? tipo : "")
                        }
                      />
                      <span className="text-sm">{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Missão</h3>
                <Textarea
                  value={form.missao}
                  onChange={(e) => handleInputChange("missao", e.target.value)}
                  placeholder="Descrição da missão"
                  rows={4}
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Entidade solicitadora</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {ENTIDADES.map((entidade) => (
                    <label key={entidade} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={form.entidadeSolicitadora === entidade}
                        onCheckedChange={(checked) =>
                          handleInputChange("entidadeSolicitadora", checked ? entidade : "")
                        }
                      />
                      <span className="text-sm">{entidade}</span>
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="reuniao" className="space-y-6">
              <h3 className="font-bold text-lg">Reunião de coordenação e reconhecimento</h3>

              {campoArea("Local", "local", 3, "Local da reunião")}
              {campoArea("Observações", "obsReuniao", 3)}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campoHora("GDH saída UI", "gdhSaidaUi")}
                {campoHora("GDH entrada UI", "gdhEntradaUi")}
              </div>

              {campoTexto("Cmdt força", "cmdtForcaReuniao")}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campoTexto("Indicativo rádio", "indicativoRadioReuniao")}
                {campoTexto("Efetivo total", "efetivTotalReuniao")}
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Viaturas</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {campoNumero("Caracterizadas", "viaturasCaracterizadasReuniao")}
                  {campoNumero("Descaracterizadas", "viaturasDescaracterizadasReuniao")}
                  {campoNumero("Especiais", "viaturasEspeciaisReuniao")}
                  {campoTexto("Km totais", "kmTotaisReuniao")}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="operacao" className="space-y-6">
              <h3 className="font-bold text-lg">Dados da operação ITP</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {campoTexto("CTer", "cterOperacao")}
                {campoTexto("DTer", "dterOperacao")}
                {campoTexto("PTer/ZA", "pterZaOperacao")}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campoHora("GDH início", "gdhInicioOperacao")}
                {campoHora("GDH chegada UI", "gdhChegadaUiOperacao")}
              </div>

              {campoTexto("Cmdt força", "cmdtForcaOperacao")}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campoTexto("Indicativo rádio", "indicativoRadioOperacao")}
                {campoTexto("Efetivo total", "efetivTotalOperacao")}
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Viaturas</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {campoNumero("Caracterizadas", "viaturasCaracterizadasOperacao")}
                  {campoNumero("Descaracterizadas", "viaturasDescaracterizadasOperacao")}
                  {campoNumero("Especiais", "viaturasEspeciaisOperacao")}
                  {campoTexto("Km totais", "kmTotaisOperacao")}
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Tempo de resolução ITP</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {campoTexto("Tipo de ITP", "itpTipo")}
                  {campoHora("GDH início", "gdhInicioItp")}
                  {campoHora("GDH fim", "gdhFimItp")}
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Força titular do inquérito</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {campoNumero("Número de visados detidos", "forcaTitularInqueritos")}
                  {campoTexto("Custos de portagens", "custosPortagens")}
                  {campoTexto("Custos de combustíveis", "custosCombustiveis")}
                </div>
              </div>

              {campoArea("Observações sobre visados", "obsVisados", 3)}
            </TabsContent>

            <TabsContent value="consumos" className="space-y-6">
              <h3 className="font-bold text-lg">Consumos</h3>

              <div className="border-b pb-6">
                <h4 className="font-semibold mb-4">Munições de armas automáticas</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {campoNumero("7,62", "municoesArmasAuto762")}
                  {campoNumero("9 mm", "municoesArmasAuto9Mm")}
                  {campoNumero("7,62 mm", "municoesArmasAuto762Mm")}
                  {campoNumero("5,56 mm", "municoesArmasAuto556Mm")}
                  {campoNumero("5,56", "municoesArmasAuto556")}
                </div>
              </div>

              <div className="border-b pb-6">
                <h4 className="font-semibold mb-4">Munições de caçadeira</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {campoNumero("Borracha", "municoesCacadeiraBarracha")}
                  {campoNumero("Chumbo", "municoesCacadeiraChumbo")}
                  {campoNumero("Bean bag", "municoesCacadeiraBeamBag")}
                  {campoNumero("Zagalote", "municoesCacadeiraZagalote")}
                  {campoNumero("Zinco", "municoesCacadeiraZinco")}
                </div>
              </div>

              <div className="border-b pb-6">
                <h4 className="font-semibold mb-4">Revólver e taser</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {campoNumero("Revólver ASP", "municoesRevolverAsp")}
                  {campoNumero("Taser carga X26", "taserCargaX26")}
                </div>
              </div>

              <div className="border-b pb-6">
                <h4 className="font-semibold mb-4">Granadas flash bang</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {campoNumero("1 estalo 1 bang", "taserGranadaFlashBang1Estalo")}
                  {campoNumero("1 estalo 2 bang", "taserGranadaFlashBang1Estalo2Bang")}
                  {campoNumero("2 estalos 2 bangs", "taserGranadaFlashBang2Estalos2Bangs")}
                  {campoNumero("Múltiplos bangs", "taserGranadaFlashBangMultiplos")}
                </div>
              </div>

              {campoTexto("Algemas", "taserAlgemas")}
              {campoArea("Observações sobre consumos", "obsConsumos", 3)}
            </TabsContent>

            <TabsContent value="observacoes" className="space-y-6">
              {campoArea("Observações SECOp", "obsSecOp", 4)}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campoTexto("Reg. SECOp", "regSecOp")}
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.excelSecOp}
                      onCheckedChange={(checked) => handleInputChange("excelSecOp", checked === true)}
                    />
                    <span className="text-sm">Excel SECOp</span>
                  </label>
                </div>
              </div>

              {campoArea("Apontamentos e notas relevantes", "apontamentosNotas", 6)}
              {campoArea("Croquis", "croquis", 4, "Descrição do croqui")}
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir operação a militar</DialogTitle>
              <DialogDescription>
                Escolha o militar e a data prevista. O registo da operação é guardado antes da
                atribuição.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="militar-select" className="mb-2 block">
                  Militar
                </Label>
                {listMilitaresQuery.isLoading ? (
                  <div className="p-2 text-sm text-gray-500">A carregar militares...</div>
                ) : listMilitaresQuery.data && listMilitaresQuery.data.length > 0 ? (
                  <Select value={selectedMilitar} onValueChange={setSelectedMilitar}>
                    <SelectTrigger id="militar-select" className="w-full">
                      <SelectValue placeholder="Escolha um militar" />
                    </SelectTrigger>
                    <SelectContent>
                      {listMilitaresQuery.data.map((militar) => (
                        <SelectItem key={militar.id} value={militar.id}>
                          {[militar.rank, militar.name].filter(Boolean).join(" ") || militar.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 text-sm text-red-600">
                    Nenhum militar disponível. Confirme se há utilizadores aprovados.
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="scheduled-date" className="mb-2 block">
                  Data prevista da operação
                </Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignModal(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleAssign}
                disabled={aGuardar || !selectedMilitar}
                style={{ background: "#1a472a" }}
              >
                {assignMutation.isPending ? "A atribuir..." : "Atribuir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
