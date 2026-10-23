/**
 * Classificação NEOP: cores e textos usados em toda a aplicação.
 *
 * As cores são semânticas (verde, âmbar, vermelho) e independentes da cor
 * institucional — antes, o 2º NEOP usava o mesmo verde da marca e confundia-se
 * com os botões e cabeçalhos. Os valores vivem em index.css (--color-neop-*).
 */
export const NEOPS = ["2º NEOP", "3º NEOP", "4º NEOP"] as const;
export type Neop = (typeof NEOPS)[number];

const CORES: Record<Neop, { forte: string; claro: string; classe: string; classeSuave: string }> = {
  "2º NEOP": {
    forte: "var(--color-neop-2)",
    claro: "var(--color-neop-2-claro)",
    classe: "bg-neop-2 text-white",
    classeSuave: "bg-neop-2-claro text-neop-2",
  },
  "3º NEOP": {
    forte: "var(--color-neop-3)",
    claro: "var(--color-neop-3-claro)",
    classe: "bg-neop-3 text-white",
    classeSuave: "bg-neop-3-claro text-neop-3",
  },
  "4º NEOP": {
    forte: "var(--color-neop-4)",
    claro: "var(--color-neop-4-claro)",
    classe: "bg-neop-4 text-white",
    classeSuave: "bg-neop-4-claro text-neop-4",
  },
};

/** Valores hexadecimais, para onde as variáveis CSS não chegam (gráficos exportados). */
export const NEOP_HEX: Record<Neop, string> = {
  "2º NEOP": "#2f6b3f",
  "3º NEOP": "#96620a",
  "4º NEOP": "#8e1b1b",
};

export const corNeop = (neop: string | null | undefined) =>
  CORES[(neop ?? "") as Neop] ?? {
    forte: "var(--color-ral-600)",
    claro: "var(--color-ral-100)",
    classe: "bg-ral-600 text-white",
    classeSuave: "bg-ral-100 text-ral-700",
  };

export const COMPLEXIDADE: Record<Neop, { nivel: string; descricao: string; largura: string }> = {
  "2º NEOP": { nivel: "Baixa", descricao: "Operação de rotina — procedimentos padrão", largura: "33%" },
  "3º NEOP": { nivel: "Média", descricao: "Operação com risco moderado — requer coordenação", largura: "66%" },
  "4º NEOP": { nivel: "Alta", descricao: "Necessita de planeamento especializado", largura: "100%" },
};

export function NeopBadge({ neop, className = "" }: { neop: string | null | undefined; className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${corNeop(neop).classe} ${className}`}
    >
      {neop || "—"}
    </span>
  );
}
