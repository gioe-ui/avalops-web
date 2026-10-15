import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";

/**
 * Estado de preenchimento do relatório de operação. Os três indicadores são
 * calculados pela base de dados (05_seguranca.sql, operations_guard), o mesmo
 * critério em todas as páginas.
 */
export function EstadoPreenchimento({
  operacao,
  compacto = false,
}: {
  operacao: {
    operacaoPreenchida?: number | null;
    consumosPreenchidos?: number | null;
    observacoesPreenchidas?: number | null;
    flaggedForCompletion?: number | null;
  };
  compacto?: boolean;
}) {
  const partes = [
    ["Operação", operacao.operacaoPreenchida],
    ["Consumos", operacao.consumosPreenchidos],
    ["Observações", operacao.observacoesPreenchidas],
  ] as const;
  const feitos = partes.filter(([, v]) => Boolean(v)).length;

  return (
    <div className={compacto ? "" : "rounded-lg border border-ral-200 bg-white p-3"}>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex-1 bg-ral-100 rounded-full h-2 overflow-hidden"
          role="progressbar"
          aria-label="Separadores do relatório preenchidos"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={feitos}
        >
          <div
            className={`h-full rounded-full ${feitos === 3 ? "bg-ok" : feitos > 0 ? "bg-aviso" : "bg-ral-300"}`}
            style={{ width: `${(feitos / 3) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-ral-700">{feitos}/3</span>
      </div>
      <ul className="grid grid-cols-3 gap-2 text-xs">
        {partes.map(([rotulo, valor]) => (
          <li
            key={rotulo}
            className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 ${
              valor ? "bg-ok-claro text-ok font-semibold" : "bg-ral-100 text-ral-600"
            }`}
          >
            {valor ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Circle className="w-3.5 h-3.5" aria-hidden="true" />}
            {rotulo}
            <span className="sr-only">{valor ? "preenchido" : "por preencher"}</span>
          </li>
        ))}
      </ul>
      {operacao.flaggedForCompletion ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-erro">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          Sinalizada como incompleta por um administrador.
        </p>
      ) : null}
    </div>
  );
}
