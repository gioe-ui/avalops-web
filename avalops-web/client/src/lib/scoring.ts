/**
 * Cálculo da pontuação de risco e classificação NEOP.
 *
 * Esta é a versão usada para pré-visualização em tempo real no formulário.
 * A versão autoritativa corre na base de dados (supabase/03_scoring.sql) por
 * trigger, para que o valor gravado não dependa do cliente.
 *
 * As duas implementações têm de dar sempre o mesmo resultado — ver
 * scripts/verify-scoring.mjs, que compara as duas com 5000 casos aleatórios.
 */

export type NeopClass = "2º NEOP" | "3º NEOP" | "4º NEOP";

export interface ScoringInput {
  mandadoDetencao?: number | null;
  mandadoBusca?: number | null;
  quantidadeSuspeitos?: string | null;
  modalidadeIsolado?: number | null;
  modalidadeAssociacao?: number | null;
  tipoCriminal?: string | null;
  antecedentesContraPessoas?: number | null;
  antecedentesContraPatrimonio?: number | null;
  antecedentesOutros?: number | null;
  antecedentesFss?: string | null;
  posseArma?: string | null;
  usoArma?: string | null;
  tipologiaApartamento?: number | null;
  tipologiaMoradia?: number | null;
  tipologiaOutro?: number | null;
  contextoIsolado?: number | null;
  contextoBairroSocial?: number | null;
  contextoMeioUrbano?: number | null;
  contextoMeioRural?: number | null;
  segurancaCaes?: number | null;
  segurancaPortaBlindada?: number | null;
  segurancaOutrasMedidas?: number | null;
}

const TIPO_SCORES: Record<string, number> = {
  trafico: 7,
  assalto: 6,
  homicidio: 10,
  sequestro: 9,
  violencia: 8,
  outro: 4,
};

const POSSE_SCORES: Record<string, number> = {
  registada: 8,
  provavel: 6,
  improvavel: 2,
};

const USO_SCORES: Record<string, number> = {
  haRegisto: 10,
  naoHaRegisto: 3,
};

const QTD_SCORES: Record<string, number> = { "1": 1, "2": 2, "3": 4, "4+": 6 };

const CRIMES_GRAVES = ["homicidio", "sequestro", "violencia"];

/** Separa a lista de tipos de crime, que pode vir separada por vírgulas. */
function parseTiposCriminais(tipoCriminal?: string | null): string[] {
  const raw = (tipoCriminal ?? "").trim();
  if (!raw) return ["outro"];
  const tipos = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tipos.length > 0 ? tipos : ["outro"];
}

export function calcScore(d: ScoringInput): { pontuacao: number; neop: NeopClass } {
  let s = 0;

  // Mandados
  if (d.mandadoDetencao) s += 5;
  if (d.mandadoBusca) s += 3;

  // Quantidade de suspeitos
  s += QTD_SCORES[d.quantidadeSuspeitos ?? "1"] ?? 1;

  // Modalidade
  if (d.modalidadeIsolado) s += 2;
  if (d.modalidadeAssociacao) s += 8;

  // Tipo(s) de crime — cada um soma
  const tiposCriminais = parseTiposCriminais(d.tipoCriminal);
  s += tiposCriminais.reduce((acc, tipo) => acc + (TIPO_SCORES[tipo] ?? 4), 0);

  // Antecedentes
  if (d.antecedentesContraPessoas) s += 8;
  if (d.antecedentesContraPatrimonio) s += 5;
  if (d.antecedentesOutros) s += 3;
  if (d.antecedentesFss === "sim") s += 9;

  // Armas
  s += POSSE_SCORES[d.posseArma ?? "improvavel"] ?? 2;
  s += USO_SCORES[d.usoArma ?? "naoHaRegisto"] ?? 3;

  // Tipologia do local: conta apenas o máximo
  const tipScores: number[] = [];
  if (d.tipologiaApartamento) tipScores.push(3);
  if (d.tipologiaMoradia) tipScores.push(4);
  if (d.tipologiaOutro) tipScores.push(5);
  if (tipScores.length > 0) s += Math.max(...tipScores);

  // Contexto: conta apenas o máximo
  const ctxScores: number[] = [];
  if (d.contextoIsolado) ctxScores.push(2);
  if (d.contextoBairroSocial) ctxScores.push(7);
  if (d.contextoMeioUrbano) ctxScores.push(5);
  if (d.contextoMeioRural) ctxScores.push(3);
  if (ctxScores.length > 0) s += Math.max(...ctxScores);

  // Medidas de segurança
  if (d.segurancaCaes) s += 4;
  if (d.segurancaPortaBlindada) s += 6;
  if (d.segurancaOutrasMedidas) s += 5;

  const pontuacao = Math.min(s, 100);

  let neop: NeopClass = pontuacao <= 25 ? "2º NEOP" : pontuacao <= 75 ? "3º NEOP" : "4º NEOP";

  // ─── Elevação automática para 4º NEOP ──────────────────────────────────────
  const temArmaRegistada = d.posseArma === "registada";
  const temArmaProvavel = d.posseArma === "provavel";
  const temUsoArma = d.usoArma === "haRegisto";
  const temAntecedentesContraFss = d.antecedentesFss === "sim";
  const temCrimeGrave = tiposCriminais.some((tipo) => CRIMES_GRAVES.includes(tipo));

  // 1: associação criminosa + posse ou probabilidade de arma de fogo
  if (d.modalidadeAssociacao && (temArmaRegistada || temArmaProvavel)) neop = "4º NEOP";

  // 2: histórico de uso de arma de fogo + antecedentes de confronto com FSS
  if (temUsoArma && temAntecedentesContraFss) neop = "4º NEOP";

  // 3: arma registada + crime grave
  if (temArmaRegistada && temCrimeGrave) neop = "4º NEOP";

  // 4: arma provável + uso com registo
  if (temArmaProvavel && temUsoArma) neop = "4º NEOP";

  return { pontuacao, neop };
}
