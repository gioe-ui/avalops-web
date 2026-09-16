/**
 * Estado, valores por omissão e conversões do formulário de avaliação.
 *
 * Existe em separado porque o formulário de criação e o de edição partilham
 * tudo isto. Na versão anterior, as duas páginas tinham cópias próprias — e
 * também cópias próprias do cálculo NEOP, que podiam divergir uma da outra e
 * do servidor.
 */
import { calcScore } from "@/lib/scoring";

export const CTERS = [
  "CT Aveiro",
  "CT Beja",
  "CT Braga",
  "CT Bragança",
  "CT Castelo Branco",
  "CT Coimbra",
  "CT Évora",
  "CT Faro",
  "CT Guarda",
  "CT Leiria",
  "CT Lisboa",
  "CT Portalegre",
  "CT Porto",
  "CT Santarém",
  "CT Setúbal",
  "CT Viana do Castelo",
  "CT Vila Real",
  "CT Viseu",
];

export type FormState = {
  nuipc: string;
  entidadeSolicitadora: string;
  refFiledoc: string;
  email: string;
  ordemVerbal: string;
  pocPosto: string;
  pocNome: string;
  pocContacto: string;
  despacho: string;
  cterRequerente: string;

  mandadoDetencao: boolean;
  mandadoBusca: boolean;
  quantidadeSuspeitos: string;
  modalidadeIsolado: boolean;
  modalidadeAssociacao: boolean;

  tipoCriminal: string[];
  antecedentesContraPessoas: boolean;
  antecedentesContraPatrimonio: boolean;
  antecedentesOutros: boolean;
  antecedentesFss: string;

  posseArma: string;
  usoArma: string;

  tipologiaApartamento: boolean;
  tipologiaMoradia: boolean;
  tipologiaOutro: boolean;

  contextoIsolado: boolean;
  contextoBairroSocial: boolean;
  contextoMeioUrbano: boolean;
  contextoMeioRural: boolean;

  segurancaCaes: boolean;
  segurancaPortaBlindada: boolean;
  segurancaOutrasMedidas: boolean;

  avaliador: string;
  dataAvaliacao: string;
  parecer: string;
  neopManual: string;
  observacoes: string;
  outrasObservacoes: string;
};

export const DEFAULT_FORM: FormState = {
  nuipc: "",
  entidadeSolicitadora: "",
  refFiledoc: "",
  email: "",
  ordemVerbal: "",
  pocPosto: "",
  pocNome: "",
  pocContacto: "",
  despacho: "",
  cterRequerente: "",

  mandadoDetencao: false,
  mandadoBusca: false,
  quantidadeSuspeitos: "1",
  modalidadeIsolado: false,
  modalidadeAssociacao: false,

  tipoCriminal: ["outro"],
  antecedentesContraPessoas: false,
  antecedentesContraPatrimonio: false,
  antecedentesOutros: false,
  antecedentesFss: "nao",

  posseArma: "improvavel",
  usoArma: "naoHaRegisto",

  tipologiaApartamento: false,
  tipologiaMoradia: false,
  tipologiaOutro: false,

  contextoIsolado: false,
  contextoBairroSocial: false,
  contextoMeioUrbano: false,
  contextoMeioRural: false,

  segurancaCaes: false,
  segurancaPortaBlindada: false,
  segurancaOutrasMedidas: false,

  avaliador: "",
  dataAvaliacao: new Date().toISOString().split("T")[0],
  parecer: "",
  neopManual: "",
  observacoes: "",
  outrasObservacoes: "",
};

const b = (v: boolean) => (v ? 1 : 0);
const toBool = (v: unknown) => Boolean(v) && v !== 0 && v !== "0";

/**
 * Pontuação e classificação para a pré-visualização, mais os rótulos de
 * complexidade. O cálculo em si vem de lib/scoring, o mesmo que está espelhado
 * em SQL — este ficheiro só acrescenta a apresentação.
 */
export function avaliarFormulario(f: FormState) {
  const { pontuacao, neop: calculado } = calcScore({
    mandadoDetencao: b(f.mandadoDetencao),
    mandadoBusca: b(f.mandadoBusca),
    quantidadeSuspeitos: f.quantidadeSuspeitos,
    modalidadeIsolado: b(f.modalidadeIsolado),
    modalidadeAssociacao: b(f.modalidadeAssociacao),
    tipoCriminal: f.tipoCriminal.join(","),
    antecedentesContraPessoas: b(f.antecedentesContraPessoas),
    antecedentesContraPatrimonio: b(f.antecedentesContraPatrimonio),
    antecedentesOutros: b(f.antecedentesOutros),
    antecedentesFss: f.antecedentesFss,
    posseArma: f.posseArma,
    usoArma: f.usoArma,
    tipologiaApartamento: b(f.tipologiaApartamento),
    tipologiaMoradia: b(f.tipologiaMoradia),
    tipologiaOutro: b(f.tipologiaOutro),
    contextoIsolado: b(f.contextoIsolado),
    contextoBairroSocial: b(f.contextoBairroSocial),
    contextoMeioUrbano: b(f.contextoMeioUrbano),
    contextoMeioRural: b(f.contextoMeioRural),
    segurancaCaes: b(f.segurancaCaes),
    segurancaPortaBlindada: b(f.segurancaPortaBlindada),
    segurancaOutrasMedidas: b(f.segurancaOutrasMedidas),
  });

  const neop =
    f.neopManual && ["2º NEOP", "3º NEOP", "4º NEOP"].includes(f.neopManual)
      ? f.neopManual
      : calculado;

  if (neop === "4º NEOP") {
    return {
      pontuacao,
      neop,
      complexidade: "Alta",
      descricao: "Necessita de planeamento especializado",
      neopColor: "#ef4444",
    };
  }

  if (neop === "3º NEOP") {
    return {
      pontuacao,
      neop,
      complexidade: "Média",
      descricao: "Operação com risco moderado — requer coordenação",
      neopColor: "#f97316",
    };
  }

  return {
    pontuacao,
    neop,
    complexidade: "Baixa",
    descricao: "Operação de rotina — procedimentos padrão",
    neopColor: "#22c55e",
  };
}

/**
 * Converte o formulário no registo a gravar.
 *
 * `pontuacao` e `neop` não vão aqui: são calculados pela base de dados. O CTer
 * passa a ir na sua própria coluna, em vez de ser embutido no texto do parecer
 * como na versão anterior.
 */
export function paraRegistoDeAvaliacao(f: FormState) {
  return {
    nuipc: f.nuipc,
    entidadeSolicitadora: f.entidadeSolicitadora,
    cterRequerente: f.cterRequerente,
    refFiledoc: f.refFiledoc,
    email: f.email,
    ordemVerbal: f.ordemVerbal,
    pocPosto: f.pocPosto,
    pocNome: f.pocNome,
    pocContacto: f.pocContacto,
    despacho: f.despacho,
    parecer: f.parecer,

    mandadoDetencao: b(f.mandadoDetencao),
    mandadoBusca: b(f.mandadoBusca),
    quantidadeSuspeitos: f.quantidadeSuspeitos,
    modalidadeIsolado: b(f.modalidadeIsolado),
    modalidadeAssociacao: b(f.modalidadeAssociacao),

    tipoCriminal: f.tipoCriminal.join(","),
    antecedentesContraPessoas: b(f.antecedentesContraPessoas),
    antecedentesContraPatrimonio: b(f.antecedentesContraPatrimonio),
    antecedentesOutros: b(f.antecedentesOutros),
    antecedentesFss: f.antecedentesFss,

    posseArma: f.posseArma,
    usoArma: f.usoArma,

    tipologiaApartamento: b(f.tipologiaApartamento),
    tipologiaMoradia: b(f.tipologiaMoradia),
    tipologiaOutro: b(f.tipologiaOutro),

    contextoIsolado: b(f.contextoIsolado),
    contextoBairroSocial: b(f.contextoBairroSocial),
    contextoMeioUrbano: b(f.contextoMeioUrbano),
    contextoMeioRural: b(f.contextoMeioRural),

    segurancaCaes: b(f.segurancaCaes),
    segurancaPortaBlindada: b(f.segurancaPortaBlindada),
    segurancaOutrasMedidas: b(f.segurancaOutrasMedidas),

    avaliador: f.avaliador,
    dataAvaliacao: f.dataAvaliacao,
    neopManual: f.neopManual || "",
    observacoes: f.observacoes,
    outrasObservacoes: f.outrasObservacoes,
  };
}

/** Converte um registo gravado no estado do formulário, para edição. */
export function deRegistoParaFormulario(e: Record<string, any>): FormState {
  // Registos antigos guardavam o CTer no início do parecer, entre parênteses
  // retos. Recupera-se daí e limpa-se o texto do parecer.
  let parecer: string = e.parecer ?? "";
  let cter: string = e.cterRequerente ?? "";

  if (!cter) {
    const match = parecer.match(/^\s*\[([^\]]+)\]\s*/);
    if (match) {
      cter = match[1].trim();
      parecer = parecer.slice(match[0].length);
    }
  }

  return {
    nuipc: e.nuipc ?? "",
    entidadeSolicitadora: e.entidadeSolicitadora ?? "",
    refFiledoc: e.refFiledoc ?? "",
    email: e.email ?? "",
    ordemVerbal: e.ordemVerbal ?? "",
    pocPosto: e.pocPosto ?? "",
    pocNome: e.pocNome ?? "",
    pocContacto: e.pocContacto ?? "",
    despacho: e.despacho ?? "",
    cterRequerente: cter,

    mandadoDetencao: toBool(e.mandadoDetencao),
    mandadoBusca: toBool(e.mandadoBusca),
    quantidadeSuspeitos: e.quantidadeSuspeitos ?? "1",
    modalidadeIsolado: toBool(e.modalidadeIsolado),
    modalidadeAssociacao: toBool(e.modalidadeAssociacao),

    tipoCriminal: (e.tipoCriminal ?? "outro")
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean),
    antecedentesContraPessoas: toBool(e.antecedentesContraPessoas),
    antecedentesContraPatrimonio: toBool(e.antecedentesContraPatrimonio),
    antecedentesOutros: toBool(e.antecedentesOutros),
    antecedentesFss: e.antecedentesFss ?? "nao",

    posseArma: e.posseArma ?? "improvavel",
    usoArma: e.usoArma ?? "naoHaRegisto",

    tipologiaApartamento: toBool(e.tipologiaApartamento),
    tipologiaMoradia: toBool(e.tipologiaMoradia),
    tipologiaOutro: toBool(e.tipologiaOutro),

    contextoIsolado: toBool(e.contextoIsolado),
    contextoBairroSocial: toBool(e.contextoBairroSocial),
    contextoMeioUrbano: toBool(e.contextoMeioUrbano),
    contextoMeioRural: toBool(e.contextoMeioRural),

    segurancaCaes: toBool(e.segurancaCaes),
    segurancaPortaBlindada: toBool(e.segurancaPortaBlindada),
    segurancaOutrasMedidas: toBool(e.segurancaOutrasMedidas),

    avaliador: e.avaliador ?? "",
    dataAvaliacao: e.dataAvaliacao ?? new Date().toISOString().split("T")[0],
    parecer,
    neopManual: e.neopManual ?? "",
    observacoes: e.observacoes ?? "",
    outrasObservacoes: e.outrasObservacoes ?? "",
  };
}
