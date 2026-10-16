import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Printer, Save, Users, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { MESES, formatarData, gdhValido, hojeLocal } from "@/lib/datas";
import { GdhInput } from "@/components/GdhInput";
import { NeopBadge } from "@/lib/neop";
import { EstadoPreenchimento } from "@/components/EstadoPreenchimento";

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

/** Campos GDH: validados antes de gravar. */
export const CAMPOS_GDH = [
  ["gdhSaidaUi", "GDH saída UI"],
  ["gdhEntradaUi", "GDH entrada UI"],
  ["gdhInicioOperacao", "GDH início da operação"],
  ["gdhChegadaUiOperacao", "GDH chegada UI"],
  ["gdhInicioItp", "GDH início ITP"],
  ["gdhFimItp", "GDH fim ITP"],
] as const;

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

/** Lista os GDH com formato inválido, para impedir a gravação. */
export function gdhInvalidos(form: Record<string, any>) {
  return CAMPOS_GDH.filter(([campo]) => !gdhValido(form[campo])).map(([, rotulo]) => rotulo);
}

export default function OperationForm() {
  const { evaluationId } = useParams();
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const evalId = Number(evaluationId ?? 0);
  const habilitado = Number.isInteger(evalId) && evalId > 0;

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMilitar, setSelectedMilitar] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>(hojeLocal);

  const utils = trpc.useUtils();

  const getOperationQuery = trpc.operations.getByEvaluationId.useQuery(
    { evaluationId: evalId },
    { enabled: habilitado },
  );

  const getEvaluationQuery = trpc.evaluations.getById.useQuery({ id: evalId }, { enabled: habilitado });

  const listMilitaresQuery = trpc.operations.listMilitares.useQuery(undefined, { enabled: isAdmin });

  const createOperationMutation = trpc.operations.create.useMutation();
  const updateOperationMutation = trpc.operations.update.useMutation();

  const operacao = getOperationQuery.data as Record<string, any> | null | undefined;
  const avaliacao = getEvaluationQuery.data;

  // Quem pode fazer o quê (a base de dados impõe o mesmo):
  //  - criar o relatório: o autor da avaliação ou um administrador;
  //  - preencher: o autor, o militar atribuído ou um administrador;
  //  - atribuir: só administradores.
  const eAutor = Boolean(avaliacao && avaliacao.userId === user?.id);
  const eAtribuido = Boolean(operacao && operacao.assignedUserId === user?.id);
  const podeEditar = operacao ? isAdmin || eAutor || eAtribuido : isAdmin || eAutor;

  useEffect(() => {
    if (!operacao) return;

    setForm((prev) => {
      const carregado: FormState = { ...prev };
      for (const chave of Object.keys(DEFAULT_FORM) as Array<keyof FormState>) {
        const valor = operacao[chave];
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
  }, [operacao]);

  const handleInputChange = useCallback((field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const numero = (valor: string) => {
    const n = parseInt(valor, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  /** Grava e devolve o identificador da operação. */
  const gravar = async (): Promise<number | undefined> => {
    const invalidos = gdhInvalidos(form);
    if (invalidos.length > 0) {
      throw new Error(`GDH com formato inválido: ${invalidos.join(", ")}. Use, por exemplo, 151630OUT26.`);
    }

    const payload = { ...form, excelSecOp: form.excelSecOp ? 1 : 0 };

    if (operacao?.id) {
      await updateOperationMutation.mutateAsync({ id: operacao.id, ...payload });
      return operacao.id;
    }

    try {
      const { id } = await createOperationMutation.mutateAsync({ evaluationId: evalId, ...payload });
      return id;
    } catch (erro) {
      // Outro utilizador criou o relatório entretanto: recarrega o existente.
      await getOperationQuery.refetch();
      throw erro;
    }
  };

  const invalidar = () => {
    void utils.evaluations.invalidate();
    void utils.operations.invalidate();
  };

  const handleSave = async () => {
    if (!habilitado) {
      toast.error("Avaliação não identificada.");
      return;
    }

    try {
      await gravar();
      toast.success("Registo de operação guardado.");
      invalidar();
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao guardar o registo de operação.");
    }
  };

  const assignMutation = trpc.operations.assignToMilitar.useMutation({
    onSuccess: () => {
      toast.success("Operação atribuída.");
      setShowAssignModal(false);
      setSelectedMilitar("");
      setScheduledDate(hojeLocal());
      void getOperationQuery.refetch();
      invalidar();
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
      assignMutation.mutate({ operationId, assignedUserId: selectedMilitar, scheduledDate });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao guardar a operação antes de atribuir.");
    }
  };

  const handlePrint = () => {
    if (operacao?.id) navigate(`/print-operation/${operacao.id}`);
    else toast.error("Guarde o registo antes de o imprimir.");
  };

  const aGuardar =
    createOperationMutation.isPending || updateOperationMutation.isPending || assignMutation.isPending;

  const campoTexto = (label: string, campo: keyof FormState, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`op-${campo}`}>{label}</Label>
      <Input
        id={`op-${campo}`}
        value={(form[campo] as string) ?? ""}
        onChange={(e) => handleInputChange(campo, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const campoGdh = (label: string, campo: keyof FormState) => (
    <GdhInput
      id={`op-${campo}`}
      label={label}
      value={(form[campo] as string) ?? ""}
      onChange={(v) => handleInputChange(campo, v)}
      disabled={!podeEditar}
    />
  );

  const campoNumero = (label: string, campo: keyof FormState) => (
    <div className="space-y-1.5">
      <Label htmlFor={`op-${campo}`}>{label}</Label>
      <Input
        id={`op-${campo}`}
        type="number"
        inputMode="numeric"
        min={0}
        value={form[campo] as number}
        onChange={(e) => handleInputChange(campo, numero(e.target.value))}
      />
    </div>
  );

  const campoArea = (label: string, campo: keyof FormState, rows = 3, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`op-${campo}`}>{label}</Label>
      <Textarea
        id={`op-${campo}`}
        value={(form[campo] as string) ?? ""}
        onChange={(e) => handleInputChange(campo, e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );

  const subtitulo = (texto: string) => <h3 className="font-bold text-ral-800 mb-4">{texto}</h3>;

  if (getOperationQuery.isLoading || getEvaluationQuery.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")} aria-label="Voltar">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-ral-800">Registo de dados da operação</h1>
              {avaliacao ? (
                <p className="text-sm text-ral-500 flex items-center gap-2 flex-wrap">
                  Avaliação n.º {avaliacao.id} · {formatarData(avaliacao.createdAt)} <NeopBadge neop={avaliacao.neop} />
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={aGuardar}>
              <Printer className="w-4 h-4" />
              Relatório
            </Button>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setShowAssignModal(true)}>
                <Users className="w-4 h-4" />
                {operacao?.assignedUserId ? "Reatribuir militar" : "Atribuir militar"}
              </Button>
            )}
            {podeEditar && (
              <Button size="sm" onClick={() => void handleSave()} disabled={aGuardar}>
                {aGuardar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {aGuardar ? "A guardar..." : "Guardar"}
              </Button>
            )}
          </div>
        </div>

        {!podeEditar && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-latao-300 bg-latao-100 px-4 py-3 text-sm text-ral-800">
            <Lock className="w-4 h-4 shrink-0 text-latao-700" />
            {operacao
              ? "Só o autor da avaliação, o militar atribuído ou um administrador podem alterar este relatório."
              : "O relatório de operação só pode ser criado pelo autor da avaliação ou por um administrador."}
          </div>
        )}

        {operacao ? (
          <div className="mb-4">
            <EstadoPreenchimento operacao={operacao} />
          </div>
        ) : null}

        <div className="bg-white rounded-lg border border-ral-200 shadow-sm p-4 sm:p-8">
          <Tabs defaultValue="referencia" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-6 h-auto bg-ral-100">
              {[
                ["referencia", "Referência"],
                ["reuniao", "Reunião"],
                ["operacao", "Operação"],
                ["consumos", "Consumos"],
                ["observacoes", "Observações"],
              ].map(([valor, rotulo]) => (
                <TabsTrigger key={valor} value={valor} className="text-xs sm:text-sm data-[state=active]:text-ral-900">
                  {rotulo}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Só o conteúdo fica desativado: os separadores continuam a
                funcionar, para que quem só pode ler veja todo o relatório. */}
            <fieldset disabled={!podeEditar} className="min-w-0">
              <TabsContent value="referencia" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campoTexto("Ref. Filedoc / email / ordem verbal", "refFiledoc", "Referência")}
                  {campoTexto("Operação n.º", "operacaoNumero", "Ex.: 001/2026")}
                  <div className="space-y-1.5">
                    <Label htmlFor="op-preenchimentoSecOp">Mês (preenchimento SEC Op)</Label>
                    <Select
                      value={form.preenchimentoSecOp || undefined}
                      onValueChange={(v) => handleInputChange("preenchimentoSecOp", v)}
                    >
                      <SelectTrigger id="op-preenchimentoSecOp" className="w-full">
                        <SelectValue placeholder="Selecione o mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {(MESES.includes(form.preenchimentoSecOp) || !form.preenchimentoSecOp
                          ? MESES
                          : [form.preenchimentoSecOp, ...MESES]
                        ).map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {campoTexto("Cmdt Op", "cmdtOp")}
                  <div className="space-y-1.5">
                    <Label htmlFor="op-dataOp">Data da operação</Label>
                    <Input
                      id="op-dataOp"
                      type="date"
                      value={form.dataOp}
                      onChange={(e) => handleInputChange("dataOp", e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t border-ral-200 pt-6">
                  {subtitulo("Tipo de empenho")}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {TIPOS_EMPENHO.map((tipo) => (
                      <label key={tipo} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={form.tipoEmpenho === tipo}
                          onCheckedChange={(checked) => handleInputChange("tipoEmpenho", checked ? tipo : "")}
                        />
                        {tipo}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-ral-200 pt-6">{campoArea("Missão", "missao", 4, "Descrição da missão")}</div>

                <div className="border-t border-ral-200 pt-6">
                  {subtitulo("Entidade solicitadora")}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {ENTIDADES.map((entidade) => (
                      <label key={entidade} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={form.entidadeSolicitadora === entidade}
                          onCheckedChange={(checked) =>
                            handleInputChange("entidadeSolicitadora", checked ? entidade : "")
                          }
                        />
                        {entidade}
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="reuniao" className="space-y-6">
                {subtitulo("Reunião de coordenação e reconhecimento")}
                {campoArea("Local", "local", 3, "Local da reunião")}
                {campoArea("Observações", "obsReuniao", 3)}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campoGdh("GDH saída UI", "gdhSaidaUi")}
                  {campoGdh("GDH entrada UI", "gdhEntradaUi")}
                </div>

                {campoTexto("Cmdt força", "cmdtForcaReuniao")}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campoTexto("Indicativo rádio", "indicativoRadioReuniao")}
                  {campoTexto("Efetivo total", "efetivTotalReuniao")}
                </div>

                <div className="border-t border-ral-200 pt-6">
                  {subtitulo("Viaturas")}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {campoNumero("Caracterizadas", "viaturasCaracterizadasReuniao")}
                    {campoNumero("Descaracterizadas", "viaturasDescaracterizadasReuniao")}
                    {campoNumero("Especiais", "viaturasEspeciaisReuniao")}
                    {campoTexto("Km totais", "kmTotaisReuniao")}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="operacao" className="space-y-6">
                {subtitulo("Dados da operação ITP")}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {campoTexto("CTer", "cterOperacao")}
                  {campoTexto("DTer", "dterOperacao")}
                  {campoTexto("PTer/ZA", "pterZaOperacao")}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campoGdh("GDH início", "gdhInicioOperacao")}
                  {campoGdh("GDH chegada UI", "gdhChegadaUiOperacao")}
                </div>

                {campoTexto("Cmdt força", "cmdtForcaOperacao")}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campoTexto("Indicativo rádio", "indicativoRadioOperacao")}
                  {campoTexto("Efetivo total", "efetivTotalOperacao")}
                </div>

                <div className="border-t border-ral-200 pt-6">
                  {subtitulo("Viaturas")}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {campoNumero("Caracterizadas", "viaturasCaracterizadasOperacao")}
                    {campoNumero("Descaracterizadas", "viaturasDescaracterizadasOperacao")}
                    {campoNumero("Especiais", "viaturasEspeciaisOperacao")}
                    {campoTexto("Km totais", "kmTotaisOperacao")}
                  </div>
                </div>

                <div className="border-t border-ral-200 pt-6">
                  {subtitulo("Tempo de resolução ITP")}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {campoTexto("Tipo de ITP", "itpTipo")}
                    {campoGdh("GDH início", "gdhInicioItp")}
                    {campoGdh("GDH fim", "gdhFimItp")}
                  </div>
                </div>

                <div className="border-t border-ral-200 pt-6">
                  {subtitulo("Força titular do inquérito")}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {campoNumero("Número de visados detidos", "forcaTitularInqueritos")}
                    {campoTexto("Custos de portagens", "custosPortagens")}
                    {campoTexto("Custos de combustíveis", "custosCombustiveis")}
                  </div>
                </div>

                {campoArea("Observações sobre visados", "obsVisados", 3)}
              </TabsContent>

              <TabsContent value="consumos" className="space-y-6">
                {subtitulo("Consumos")}
                <p className="text-sm text-ral-600 -mt-2">
                  Sem consumos? Indique-o nas observações: o separador conta como preenchido.
                </p>

                <div className="border-b border-ral-200 pb-6">
                  <h4 className="font-semibold text-ral-700 mb-4">Munições de armas automáticas</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {campoNumero("7,62", "municoesArmasAuto762")}
                    {campoNumero("9 mm", "municoesArmasAuto9Mm")}
                    {campoNumero("7,62 mm", "municoesArmasAuto762Mm")}
                    {campoNumero("5,56 mm", "municoesArmasAuto556Mm")}
                    {campoNumero("5,56", "municoesArmasAuto556")}
                  </div>
                </div>

                <div className="border-b border-ral-200 pb-6">
                  <h4 className="font-semibold text-ral-700 mb-4">Munições de caçadeira</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {campoNumero("Borracha", "municoesCacadeiraBarracha")}
                    {campoNumero("Chumbo", "municoesCacadeiraChumbo")}
                    {campoNumero("Bean bag", "municoesCacadeiraBeamBag")}
                    {campoNumero("Zagalote", "municoesCacadeiraZagalote")}
                    {campoNumero("Zinco", "municoesCacadeiraZinco")}
                  </div>
                </div>

                <div className="border-b border-ral-200 pb-6">
                  <h4 className="font-semibold text-ral-700 mb-4">Revólver e taser</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {campoNumero("Revólver ASP", "municoesRevolverAsp")}
                    {campoNumero("Taser carga X26", "taserCargaX26")}
                  </div>
                </div>

                <div className="border-b border-ral-200 pb-6">
                  <h4 className="font-semibold text-ral-700 mb-4">Granadas flash bang</h4>
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
                {campoArea("Observações SEC Op", "obsSecOp", 4)}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campoTexto("Reg. SEC Op", "regSecOp")}
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={form.excelSecOp}
                        onCheckedChange={(checked) => handleInputChange("excelSecOp", checked === true)}
                      />
                      Excel SEC Op
                    </label>
                  </div>
                </div>

                {campoArea("Apontamentos e notas relevantes", "apontamentosNotas", 6)}
                {campoArea("Croquis", "croquis", 4, "Descrição do croqui")}
              </TabsContent>
            </fieldset>
          </Tabs>
        </div>

        <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir operação a militar</DialogTitle>
              <DialogDescription>
                Escolha o militar e a data prevista. O registo da operação é guardado antes da atribuição.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="militar-select">Militar</Label>
                {listMilitaresQuery.isLoading ? (
                  <div className="p-2 text-sm text-ral-500">A carregar militares...</div>
                ) : listMilitaresQuery.data && listMilitaresQuery.data.length > 0 ? (
                  <Select value={selectedMilitar} onValueChange={setSelectedMilitar}>
                    <SelectTrigger id="militar-select" className="w-full">
                      <SelectValue placeholder="Escolha um militar" />
                    </SelectTrigger>
                    <SelectContent>
                      {listMilitaresQuery.data.map((militar) => (
                        <SelectItem key={militar.id} value={militar.id}>
                          {[militar.rank, militar.name].filter(Boolean).join(" ") || militar.email}
                          {militar.phoneNumber ? "" : " (sem telefone)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 text-sm text-erro">Nenhum militar aprovado e ativo disponível.</div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scheduled-date">Data prevista da operação</Label>
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
              <Button type="button" onClick={() => void handleAssign()} disabled={aGuardar || !selectedMilitar}>
                {assignMutation.isPending ? "A atribuir..." : "Atribuir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
