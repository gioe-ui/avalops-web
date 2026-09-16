import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Printer } from "lucide-react";
import { FormHeader } from "@/components/FormHeader";

export default function PrintOperation() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const operationId = Number(id ?? 0);

  const { data: operation, isLoading } = trpc.operations.getById.useQuery(
    { id: operationId },
    { enabled: Number.isFinite(operationId) && operationId > 0 },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">Registo de operação não encontrado.</p>
        <Button onClick={() => navigate("/")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const op = operation as Record<string, any>;

  const temValor = (value: unknown) =>
    value !== null && value !== undefined && value !== "" && value !== 0;

  const renderField = (label: string, value: any) => (
    <div key={label} className="mb-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800 mt-1">{String(value)}</p>
    </div>
  );

  const renderSection = (title: string, fields: Array<[string, any]>) => {
    const visibleFields = fields.filter(([, value]) => temValor(value));
    if (visibleFields.length === 0) return null;

    return (
      <div className="mb-6 pb-6 border-b border-gray-300">
        <h3
          className="text-sm font-bold text-white px-3 py-2 mb-4 rounded"
          style={{ background: "#1a472a" }}
        >
          {title}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {visibleFields.map(([label, value]) => renderField(label, value))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto mb-6 no-print">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button size="sm" onClick={() => window.print()} style={{ background: "#1a472a" }}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white p-8 print:p-0 rounded-lg shadow-lg print:shadow-none">
        <FormHeader subtitulo="Registo de Dados da Operação" />

        <p className="text-xs text-gray-500 text-center -mt-4 mb-8">
          Gerado em {new Date().toLocaleDateString("pt-PT")} às{" "}
          {new Date().toLocaleTimeString("pt-PT")}
        </p>

        {renderSection("Referência", [
          ["Ref. Filedoc / email / ordem verbal", op.refFiledoc],
          ["Operação n.º", op.operacaoNumero],
          ["Preenchimento SECOp", op.preenchimentoSecOp],
          ["Cmdt Op", op.cmdtOp],
          ["Data Op", op.dataOp],
          ["Tipo de empenho", op.tipoEmpenho],
          ["Entidade solicitadora", op.entidadeSolicitadora],
        ])}

        {op.missao && (
          <div className="mb-6 pb-6 border-b border-gray-300">
            <h3
              className="text-sm font-bold text-white px-3 py-2 mb-4 rounded"
              style={{ background: "#1a472a" }}
            >
              Missão
            </h3>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{op.missao}</p>
          </div>
        )}

        {renderSection("Dados da reunião de coordenação", [
          ["Local", op.local],
          ["Observações", op.obsReuniao],
          ["GDH saída UI", op.gdhSaidaUi],
          ["GDH entrada UI", op.gdhEntradaUi],
          ["Cmdt força", op.cmdtForcaReuniao],
          ["Indicativo rádio", op.indicativoRadioReuniao],
          ["Efetivo total", op.efetivTotalReuniao],
          ["Viaturas caracterizadas", op.viaturasCaracterizadasReuniao],
          ["Viaturas descaracterizadas", op.viaturasDescaracterizadasReuniao],
          ["Viaturas especiais", op.viaturasEspeciaisReuniao],
          ["Km totais", op.kmTotaisReuniao],
        ])}

        {renderSection("Dados da operação ITP", [
          ["CTer", op.cterOperacao],
          ["DTer", op.dterOperacao],
          ["PTer/ZA", op.pterZaOperacao],
          ["GDH início", op.gdhInicioOperacao],
          ["GDH chegada UI", op.gdhChegadaUiOperacao],
          ["Cmdt força", op.cmdtForcaOperacao],
          ["Indicativo rádio", op.indicativoRadioOperacao],
          ["Efetivo total", op.efetivTotalOperacao],
          ["Viaturas caracterizadas", op.viaturasCaracterizadasOperacao],
          ["Viaturas descaracterizadas", op.viaturasDescaracterizadasOperacao],
          ["Viaturas especiais", op.viaturasEspeciaisOperacao],
          ["Km totais", op.kmTotaisOperacao],
        ])}

        {renderSection("Tempo de resolução ITP", [
          ["Tipo de ITP", op.itpTipo],
          ["GDH início", op.gdhInicioItp],
          ["GDH fim", op.gdhFimItp],
        ])}

        {renderSection("Força titular do inquérito", [
          ["Número de visados detidos", op.forcaTitularInqueritos],
          ["Custos de portagens", op.custosPortagens],
          ["Custos de combustíveis", op.custosCombustiveis],
          ["Observações", op.obsVisados],
        ])}

        {renderSection("Consumos — munições de armas automáticas", [
          ["7,62", op.municoesArmasAuto762],
          ["9 mm", op.municoesArmasAuto9Mm],
          ["7,62 mm", op.municoesArmasAuto762Mm],
          ["5,56 mm", op.municoesArmasAuto556Mm],
          ["5,56", op.municoesArmasAuto556],
        ])}

        {renderSection("Consumos — munições de caçadeira", [
          ["Borracha", op.municoesCacadeiraBarracha],
          ["Chumbo", op.municoesCacadeiraChumbo],
          ["Bean bag", op.municoesCacadeiraBeamBag],
          ["Zagalote", op.municoesCacadeiraZagalote],
          ["Zinco", op.municoesCacadeiraZinco],
        ])}

        {renderSection("Consumos — revólver, taser e granadas", [
          ["Revólver ASP", op.municoesRevolverAsp],
          ["Taser carga X26", op.taserCargaX26],
          ["Granada flash bang 1 estalo", op.taserGranadaFlashBang1Estalo],
          ["Granada flash bang 1 estalo 2 bang", op.taserGranadaFlashBang1Estalo2Bang],
          ["Granada flash bang 2 estalos 2 bangs", op.taserGranadaFlashBang2Estalos2Bangs],
          ["Granada flash bang múltiplos", op.taserGranadaFlashBangMultiplos],
          ["Algemas", op.taserAlgemas],
          ["Observações", op.obsConsumos],
        ])}

        {renderSection("Observações", [
          ["Observações SECOp", op.obsSecOp],
          ["Reg. SECOp", op.regSecOp],
          ["Excel SECOp", op.excelSecOp ? "Sim" : ""],
          ["Apontamentos e notas", op.apontamentosNotas],
          ["Croquis", op.croquis],
        ])}

        <div className="mt-8 pt-6 border-t-2 border-gray-300 text-center text-xs text-gray-500">
          <p>GIOE — Sistema de Avaliação de Pedidos de Apoio</p>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .max-w-4xl { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
