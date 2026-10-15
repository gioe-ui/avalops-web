import { describe, expect, it } from "vitest";
import { calcScore } from "../scoring";

/**
 * Casos de referência. A equivalência total com o SQL é verificada por
 * scripts/verify-scoring.mjs (5000 casos aleatórios contra a base de dados);
 * aqui ficam as regras que não podem mudar sem se dar por isso.
 */
describe("calcScore", () => {
  it("caso mínimo: 10 pontos, 2º NEOP", () => {
    // outro(4) + 1 suspeito(1) + posse improvável(2) + sem registo de uso(3)
    expect(calcScore({})).toEqual({ pontuacao: 10, neop: "2º NEOP" });
  });

  it("os tipos de crime somam-se", () => {
    expect(calcScore({ tipoCriminal: "trafico,assalto" }).pontuacao).toBe(1 + 7 + 6 + 2 + 3);
  });

  it("tipologia e contexto contam só o máximo", () => {
    const base = calcScore({}).pontuacao;
    expect(calcScore({ tipologiaApartamento: 1, tipologiaOutro: 1 }).pontuacao).toBe(base + 5);
    expect(calcScore({ contextoIsolado: 1, contextoBairroSocial: 1 }).pontuacao).toBe(base + 7);
  });

  it("limita a pontuação a 100", () => {
    const tudo = calcScore({
      mandadoDetencao: 1,
      mandadoBusca: 1,
      quantidadeSuspeitos: "4+",
      modalidadeIsolado: 1,
      modalidadeAssociacao: 1,
      tipoCriminal: "trafico,assalto,homicidio,sequestro,violencia",
      antecedentesContraPessoas: 1,
      antecedentesContraPatrimonio: 1,
      antecedentesOutros: 1,
      antecedentesFss: "sim",
      posseArma: "registada",
      usoArma: "haRegisto",
      tipologiaOutro: 1,
      contextoBairroSocial: 1,
      segurancaCaes: 1,
      segurancaPortaBlindada: 1,
      segurancaOutrasMedidas: 1,
    });
    expect(tudo).toEqual({ pontuacao: 100, neop: "4º NEOP" });
  });

  it.each([
    ["associação criminosa + arma provável", { modalidadeAssociacao: 1, posseArma: "provavel" }],
    ["uso de arma + antecedentes contra FSS", { usoArma: "haRegisto", antecedentesFss: "sim" }],
    ["arma registada + crime grave", { posseArma: "registada", tipoCriminal: "sequestro" }],
    ["arma provável + uso com registo", { posseArma: "provavel", usoArma: "haRegisto" }],
  ])("eleva a 4º NEOP: %s", (_, input) => {
    const r = calcScore(input);
    expect(r.pontuacao).toBeLessThanOrEqual(75);
    expect(r.neop).toBe("4º NEOP");
  });

  it("limiares: 25 ainda é 2º NEOP, 26 já é 3º", () => {
    // 10 (mínimo) + detenção 5 + busca 3 + outros antecedentes 3 + cães 4 = 25
    const vinteCinco = { mandadoDetencao: 1, mandadoBusca: 1, antecedentesOutros: 1, segurancaCaes: 1 };
    expect(calcScore(vinteCinco)).toEqual({ pontuacao: 25, neop: "2º NEOP" });
    // 2 suspeitos em vez de 1: +1
    expect(calcScore({ ...vinteCinco, quantidadeSuspeitos: "2" })).toEqual({ pontuacao: 26, neop: "3º NEOP" });
  });
});
