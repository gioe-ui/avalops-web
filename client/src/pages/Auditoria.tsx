import { useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatarDataHora } from "@/lib/datas";
import type { RegistoAuditoria } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TABELAS: Record<string, string> = {
  evaluations: "Avaliações",
  suspects: "Suspeitos",
  operations: "Operações",
  notifications: "Notificações",
  profiles: "Utilizadores",
  "formulario-avaliacao": "Formulário",
};

const ACOES: Record<string, { rotulo: string; classe: string }> = {
  INSERT: { rotulo: "Criação", classe: "bg-ok-claro text-ok" },
  UPDATE: { rotulo: "Alteração", classe: "bg-ral-100 text-ral-700" },
  DELETE: { rotulo: "Eliminação", classe: "bg-erro-claro text-erro" },
  EXPORT: { rotulo: "Exportação", classe: "bg-latao-100 text-latao-700" },
  PRINT: { rotulo: "Impressão", classe: "bg-latao-100 text-latao-700" },
};

/** Campos alterados, de forma legível: "campo: antes → depois". */
function resumo(r: RegistoAuditoria) {
  const dados = r.action === "DELETE" ? r.oldData : r.newData;
  if (!dados) return "";
  if (r.action === "EXPORT" || r.action === "PRINT") {
    return Object.entries(dados)
      .filter(([k]) => k !== "recurso")
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(" · ");
  }
  if (r.action === "UPDATE") {
    return Object.keys(dados)
      .filter((k) => k !== "updatedAt")
      .map((k) => `${k}: ${String(r.oldData?.[k] ?? "∅")} → ${String(dados[k] ?? "∅")}`)
      .join(" · ");
  }
  return Object.keys(dados).length + " campos";
}

/**
 * Registo de auditoria (só administradores). Mostra quem criou, alterou,
 * eliminou, exportou ou imprimiu, e quando. Não pode ser alterado nem apagado
 * a partir da aplicação.
 */
export default function Auditoria() {
  const [tabela, setTabela] = useState("todas");
  const [acao, setAcao] = useState("todas");

  const { data, isLoading, error } = trpc.audit.list.useQuery({
    tabela: tabela === "todas" ? undefined : tabela,
    acao: acao === "todas" ? undefined : acao,
    limite: 300,
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <ScrollText className="w-6 h-6 text-ral-700" />
        <h2 className="text-xl font-bold text-ral-800">Registo de auditoria</h2>
      </div>
      <p className="text-sm text-ral-500 mb-6">
        Últimos 300 registos. As consultas (leituras) não são registadas; as exportações e
        impressões feitas pela aplicação são.
      </p>

      <div className="flex gap-3 mb-4 flex-wrap">
        <Select value={tabela} onValueChange={setTabela}>
          <SelectTrigger className="w-48 bg-white" aria-label="Filtrar por tipo de registo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os registos</SelectItem>
            {Object.entries(TABELAS).map(([valor, rotulo]) => (
              <SelectItem key={valor} value={valor}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={acao} onValueChange={setAcao}>
          <SelectTrigger className="w-48 bg-white" aria-label="Filtrar por ação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            {Object.entries(ACOES).map(([valor, { rotulo }]) => (
              <SelectItem key={valor} value={valor}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-ral-400" />
        </div>
      ) : error ? (
        <p className="text-erro">{error.message}</p>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-ral-300 text-ral-500">
          Sem registos.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <caption className="sr-only">Registo de auditoria</caption>
            <thead>
              <tr className="bg-ral-700 text-white">
                {["Data e hora", "Quem", "Ação", "Registo", "Detalhe"].map((h) => (
                  <th key={h} scope="col" className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const a = ACOES[r.action] ?? { rotulo: r.action, classe: "bg-ral-100 text-ral-700" };
                return (
                  <tr key={r.id} className="border-b border-ral-100 even:bg-ral-50/60 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-ral-700">{formatarDataHora(r.occurredAt)}</td>
                    <td className="px-3 py-2 text-ral-800">{r.actorEmail ?? (r.actorId ? r.actorId : "Servidor")}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${a.classe}`}>{a.rotulo}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ral-700">
                      {TABELAS[r.tableName] ?? r.tableName}
                      {r.recordId ? ` n.º ${r.recordId.length > 12 ? r.recordId.slice(0, 8) + "…" : r.recordId}` : ""}
                    </td>
                    <td className="px-3 py-2 text-xs text-ral-600 max-w-[36rem] break-words">{resumo(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
