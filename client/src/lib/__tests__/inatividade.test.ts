import { describe, expect, it } from "vitest";
import { idDaSessao, registoDeAtividade, tempoAteInatividade } from "../inatividade";

const LIMITE = 30 * 60 * 1000;
const AGORA = 1_800_000_000_000;

/** Token com o formato de um JWT (a assinatura não interessa aqui). */
const token = (payload: Record<string, unknown>) =>
  ["e30", btoa(JSON.stringify(payload)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"), "x"].join(".");

const sessaoA = token({ sub: "u1", session_id: "sessao-a", aal: "aal2" });
const sessaoB = token({ sub: "u1", session_id: "sessao-b", aal: "aal1" });

describe("inatividade", () => {
  it("lê o session_id do token", () => {
    expect(idDaSessao(sessaoA)).toBe("sessao-a");
    expect(idDaSessao("lixo")).toBe("");
    expect(idDaSessao(undefined)).toBe("");
  });

  it("sessão com atividade recente não está inativa", () => {
    const registo = registoDeAtividade(sessaoA, AGORA - 5 * 60 * 1000);
    expect(tempoAteInatividade(sessaoA, registo, AGORA, LIMITE)).toBe(25 * 60 * 1000);
  });

  it("sessão esquecida há mais de 30 minutos está inativa", () => {
    const registo = registoDeAtividade(sessaoA, AGORA - 31 * 60 * 1000);
    expect(tempoAteInatividade(sessaoA, registo, AGORA, LIMITE)).toBeLessThan(0);
  });

  it("um token renovado (mesmo session_id) não reinicia a contagem", () => {
    const renovado = token({ sub: "u1", session_id: "sessao-a", aal: "aal2", iat: 999 });
    const registo = registoDeAtividade(sessaoA, AGORA - 40 * 60 * 1000);
    expect(tempoAteInatividade(renovado, registo, AGORA, LIMITE)).toBeLessThan(0);
  });

  it("uma sessão nova (ligação de confirmação aberta mais tarde) não herda a inatividade da anterior", () => {
    const registoAntigo = registoDeAtividade(sessaoA, AGORA - 3 * 60 * 60 * 1000);
    expect(tempoAteInatividade(sessaoB, registoAntigo, AGORA, LIMITE)).toBeNull();
  });

  it("sem registo de atividade não há referência", () => {
    expect(tempoAteInatividade(sessaoA, null, AGORA, LIMITE)).toBeNull();
    expect(tempoAteInatividade(sessaoA, "lixo", AGORA, LIMITE)).toBeNull();
  });

  it("registos no formato antigo (só a hora) continuam a contar", () => {
    expect(tempoAteInatividade(sessaoA, `|${AGORA - 31 * 60 * 1000}`, AGORA, LIMITE)).toBeLessThan(0);
  });
});
