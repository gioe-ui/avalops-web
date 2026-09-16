import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Save, Printer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Campos que esta página edita. É uma lista explícita para que o registo
 * gravado não leve de volta colunas que não são para escrever (id, createdAt,
 * userId, evaluationId) nem os campos do militar atribuído que vêm da junção.
 */
const CAMPOS_EDITAVEIS = [
  "refFiledoc",
  "operacaoNumero",
  "preenchimentoSecOp",
  "cmdtOp",
  "dataOp",
  "tipoEmpenho",
  "missao",
  "entidadeSolicitadora",
  "local",
  "obsReuniao",
  "gdhSaidaUi",
  "gdhEntradaUi",
  "cmdtForcaReuniao",
  "indicativoRadioReuniao",
  "efetivTotalReuniao",
  "viaturasCaracterizadasReuniao",
  "viaturasDescaracterizadasReuniao",
  "viaturasEspeciaisReuniao",
  "kmTotaisReuniao",
  "cterOperacao",
  "dterOperacao",
  "pterZaOperacao",
  "gdhInicioOperacao",
  "gdhChegadaUiOperacao",
  "cmdtForcaOperacao",
  "indicativoRadioOperacao",
  "efetivTotalOperacao",
  "viaturasCaracterizadasOperacao",
  "viaturasDescaracterizadasOperacao",
  "viaturasEspeciaisOperacao",
  "kmTotaisOperacao",
  "itpTipo",
  "gdhInicioItp",
  "gdhFimItp",
  "forcaTitularInqueritos",
  "custosPortagens",
  "custosCombustiveis",
  "obsVisados",
  "municoesArmasAuto762",
  "municoesArmasAuto9Mm",
  "municoesArmasAuto762Mm",
  "municoesArmasAuto556Mm",
  "municoesArmasAuto556",
  "municoesCacadeiraBarracha",
  "municoesCacadeiraChumbo",
  "municoesCacadeiraBeamBag",
  "municoesCacadeiraZagalote",
  "municoesCacadeiraZinco",
  "municoesRevolverAsp",
  "taserCargaX26",
  "taserGranadaFlashBang1Estalo",
  "taserGranadaFlashBang1Estalo2Bang",
  "taserGranadaFlashBang2Estalos2Bangs",
  "taserGranadaFlashBangMultiplos",
  "taserAlgemas",
  "obsConsumos",
  "obsSecOp",
  "regSecOp",
  "apontamentosNotas",
  "croquis",
] as const;

const CONSUMOS_NUMERICOS = [
  ["municoesArmasAuto762", "Munições armas auto 7,62"],
  ["municoesArmasAuto9Mm", "Munições armas auto 9 mm"],
  ["municoesArmasAuto762Mm", "Munições armas auto 7,62 mm"],
  ["municoesArmasAuto556Mm", "Munições armas auto 5,56 mm"],
  ["municoesArmasAuto556", "Munições armas auto 5,56"],
  ["municoesCacadeiraBarracha", "Munições caçadeira borracha"],
  ["municoesCacadeiraChumbo", "Munições caçadeira chumbo"],
  ["municoesCacadeiraBeamBag", "Munições caçadeira bean bag"],
  ["municoesCacadeiraZagalote", "Munições caçadeira zagalote"],
  ["municoesCacadeiraZinco", "Munições caçadeira zinco"],
  ["municoesRevolverAsp", "Munições revólver ASP"],
  ["taserCargaX26", "Taser carga X26"],
  ["taserGranadaFlashBang1Estalo", "Granada flash bang 1 estalo"],
  ["taserGranadaFlashBang1Estalo2Bang", "Granada flash bang 1 estalo 2 bang"],
  ["taserGranadaFlashBang2Estalos2Bangs", "Granada flash bang 2 estalos 2 bangs"],
  ["taserGranadaFlashBangMultiplos", "Granada flash bang múltiplos"],
] as const;

export function OperationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [form, setForm] = useState<Record<string, any>>({});
  const operationId = Number(id ?? 0);
  const utils = trpc.useUtils();

  const { data: operation, isLoading } = trpc.operations.getById.useQuery(
    { id: operationId },
    { enabled: Number.isFinite(operationId) && operationId > 0 },
  );

  const updateMutation = trpc.operations.update.useMutation();

  useEffect(() => {
    if (operation) setForm(operation as Record<string, any>);
  }, [operation]);

  const handleInputChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const numero = (valor: string) => {
    const n = parseInt(valor, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const handleSave = async () => {
    const temDadosOperacao = Boolean(
      form.cterOperacao || form.dterOperacao || form.pterZaOperacao || form.gdhInicioOperacao,
    );
    const temConsumos = CONSUMOS_NUMERICOS.some(([campo]) => Number(form[campo]) > 0);
    const temObservacoes = Boolean(form.obsSecOp || form.apontamentosNotas);

    const payload: Record<string, any> & { id: number } = { id: operationId };
    for (const campo of CAMPOS_EDITAVEIS) {
      if (form[campo] !== undefined) payload[campo] = form[campo];
    }

    payload.operacaoPreenchida = temDadosOperacao ? 1 : 0;
    payload.consumosPreenchidos = temConsumos ? 1 : 0;
    payload.observacoesPreenchidas = temObservacoes ? 1 : 0;

    try {
      await updateMutation.mutateAsync(payload);
      toast.success("Operação guardada.");
      utils.operations.getById.invalidate({ id: operationId });
      utils.operations.getByMonth.invalidate();
      utils.evaluations.list.invalidate();
    } catch (error) {
      toast.error(
        "Erro ao guardar a operação: " +
          (error instanceof Error ? error.message : "erro desconhecido"),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1a472a" }} />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-600">Operação não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  const campoTexto = (label: string, campo: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={form[campo] ?? ""}
        onChange={(e) => handleInputChange(campo, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const campoNumero = (label: string, campo: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={form[campo] ?? 0}
        onChange={(e) => handleInputChange(campo, numero(e.target.value))}
      />
    </div>
  );

  const campoArea = (label: string, campo: string, placeholder?: string, rows = 4) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={form[campo] ?? ""}
        onChange={(e) => handleInputChange(campo, e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">
              Operação {operation.operacaoNumero || `#${operation.id}`}
            </h1>
          </div>
          <div className="flex gap-2">
            {/* O relatório imprimível é a página dedicada; a versão anterior
                tentava gerar um PDF a partir de um elemento que não existia
                nesta página, pelo que o botão nunca funcionava. */}
            <Button
              variant="outline"
              onClick={() => navigate(`/print-operation/${operation.id}`)}
              className="border-2"
              style={{ borderColor: "#1a472a", color: "#1a472a" }}
            >
              <Printer className="w-4 h-4 mr-2" />
              Relatório
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              style={{ background: "#1a472a" }}
            >
              {updateMutation.isPending ? (
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

        <Tabs defaultValue="referencia" className="bg-white rounded-lg shadow">
          <TabsList className="w-full justify-start border-b rounded-none bg-gray-50 p-0 h-auto flex-wrap">
            {[
              ["referencia", "Referência"],
              ["reuniao", "Reunião de coordenação"],
              ["operacao", "Dados da operação"],
              ["consumos", "Consumos"],
              ["observacoes", "Observações"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#1a472a] data-[state=active]:text-[#1a472a]"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="referencia" className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campoTexto("Ref. Filedoc", "refFiledoc", "Referência do Filedoc")}
              {campoTexto("Número da operação", "operacaoNumero", "Número da operação")}
              {campoTexto("Preenchimento SEC Op", "preenchimentoSecOp", "Mês (ex.: JAN)")}
              {campoTexto("Cmdt Op", "cmdtOp", "Comandante da operação")}
              <div className="space-y-2">
                <Label>Data da operação</Label>
                <Input
                  type="date"
                  value={form.dataOp ?? ""}
                  onChange={(e) => handleInputChange("dataOp", e.target.value)}
                />
              </div>
              {campoTexto("Tipo de empenho", "tipoEmpenho", "Tipo de empenho")}
            </div>
            {campoArea("Missão", "missao", "Descrição da missão")}
            {campoTexto("Entidade solicitadora", "entidadeSolicitadora", "Entidade solicitadora")}
          </TabsContent>

          <TabsContent value="reuniao" className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campoTexto("Local", "local", "Local da reunião")}
              {campoTexto("GDH saída UI", "gdhSaidaUi")}
              {campoTexto("GDH entrada UI", "gdhEntradaUi")}
              {campoTexto("Cmdt força", "cmdtForcaReuniao", "Comandante da força")}
              {campoTexto("Indicativo rádio", "indicativoRadioReuniao")}
              {campoTexto("Efetivo total", "efetivTotalReuniao")}
              {campoNumero("Viaturas caracterizadas", "viaturasCaracterizadasReuniao")}
              {campoNumero("Viaturas descaracterizadas", "viaturasDescaracterizadasReuniao")}
              {campoNumero("Viaturas especiais", "viaturasEspeciaisReuniao")}
              {campoTexto("Km totais", "kmTotaisReuniao")}
            </div>
            {campoArea("Observações da reunião", "obsReuniao")}
          </TabsContent>

          <TabsContent value="operacao" className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campoTexto("CTer", "cterOperacao")}
              {campoTexto("DTer", "dterOperacao")}
              {campoTexto("PTer/ZA", "pterZaOperacao")}
              {campoTexto("GDH início", "gdhInicioOperacao")}
              {campoTexto("GDH chegada UI", "gdhChegadaUiOperacao")}
              {campoTexto("Cmdt força", "cmdtForcaOperacao")}
              {campoTexto("Indicativo rádio", "indicativoRadioOperacao")}
              {campoTexto("Efetivo total", "efetivTotalOperacao")}
              {campoTexto("Tipo de ITP", "itpTipo")}
              {campoTexto("GDH início ITP", "gdhInicioItp")}
              {campoTexto("GDH fim ITP", "gdhFimItp")}
              {campoNumero("Número de visados detidos", "forcaTitularInqueritos")}
              {campoNumero("Viaturas caracterizadas", "viaturasCaracterizadasOperacao")}
              {campoNumero("Viaturas descaracterizadas", "viaturasDescaracterizadasOperacao")}
              {campoNumero("Viaturas especiais", "viaturasEspeciaisOperacao")}
              {campoTexto("Km totais", "kmTotaisOperacao")}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campoArea("Custos de portagens", "custosPortagens", undefined, 3)}
              {campoArea("Custos de combustíveis", "custosCombustiveis", undefined, 3)}
            </div>
            {campoArea("Observações sobre visados", "obsVisados", undefined, 3)}
          </TabsContent>

          <TabsContent value="consumos" className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CONSUMOS_NUMERICOS.map(([campo, label]) => (
                <div key={campo}>{campoNumero(label, campo)}</div>
              ))}
              {campoTexto("Algemas", "taserAlgemas")}
            </div>
            {campoArea("Observações sobre consumos", "obsConsumos")}
          </TabsContent>

          <TabsContent value="observacoes" className="p-6 space-y-4">
            {campoArea("Observações SEC Op", "obsSecOp")}
            {campoTexto("Reg. SEC Op", "regSecOp", "Registo SEC Op")}
            {campoArea("Apontamentos e notas", "apontamentosNotas")}
            {campoArea("Croquis", "croquis", "Descrição do croqui")}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
