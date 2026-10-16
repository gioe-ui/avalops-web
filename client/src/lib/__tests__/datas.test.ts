import { describe, expect, it } from "vitest";
import {
  dataParaGdh,
  fimDoDiaExclusivo,
  formatarData,
  gdhParaData,
  gdhValido,
  hojeLocal,
  horasEntreGdh,
  horasEntreGdhNumero,
  inicioDoDia,
  mesDeData,
  normalizarGdh,
} from "../datas";

describe("GDH (DDHHMMMMMAA)", () => {
  it("lê um GDH válido na hora local", () => {
    const d = gdhParaData("151630OUT26")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(16);
    expect(d.getMinutes()).toBe(30);
  });

  it("aceita minúsculas e espaços à volta", () => {
    expect(gdhValido(" 010000jan27 ")).toBe(true);
  });

  it.each([
    ["31FEV", "310000FEV26"],
    ["hora 24", "152400OUT26"],
    ["minuto 60", "151660OUT26"],
    ["mês inexistente", "151630XYZ26"],
    ["mês em inglês", "151630OCT26"],
    ["dia zero", "001630OUT26"],
    ["hora com dois pontos", "16:30"],
    ["ano com 4 dígitos", "151630OUT2026"],
  ])("rejeita %s", (_, gdh) => {
    expect(gdhParaData(gdh)).toBeNull();
    expect(gdhValido(gdh)).toBe(false);
  });

  it("considera válido o campo vazio (não obrigatório)", () => {
    expect(gdhValido("")).toBe(true);
    expect(gdhValido(null)).toBe(true);
  });

  it("converte nos dois sentidos", () => {
    const d = new Date(2026, 1, 28, 7, 5);
    expect(dataParaGdh(d)).toBe("280705FEV26");
    expect(gdhParaData(dataParaGdh(d))!.getTime()).toBe(d.getTime());
  });

  it("normaliza o que se escreve", () => {
    expect(normalizarGdh("15 1630 out 26 extra")).toBe("151630OUT26");
  });

  it("calcula as horas entre dois GDH, mesmo de um dia para o outro", () => {
    expect(horasEntreGdh("152200OUT26", "160130OUT26")).toBe("3,5");
    expect(horasEntreGdh("151630OUT26", "151630OUT26")).toBe("0");
  });

  it("não calcula horas com GDH inválidos ou fim antes do início", () => {
    expect(horasEntreGdh("16:30", "151630OUT26")).toBe("");
    expect(horasEntreGdh("161630OUT26", "151630OUT26")).toBe("");
  });

  it("exporta as horas como número", () => {
    expect(horasEntreGdhNumero("152200OUT26", "160130OUT26")).toBe(3.5);
    expect(horasEntreGdhNumero("151630OUT26", "151630OUT26")).toBe(0);
    expect(horasEntreGdhNumero("161630OUT26", "151630OUT26")).toBeNull();
    expect(horasEntreGdhNumero(null, "151630OUT26")).toBeNull();
  });
});

describe("datas locais", () => {
  it("hoje no formato AAAA-MM-DD", () => {
    expect(hojeLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = new Date();
    expect(hojeLocal().endsWith(String(d.getDate()).padStart(2, "0"))).toBe(true);
  });

  it("formata AAAA-MM-DD sem desvio de fuso horário", () => {
    expect(formatarData("2026-10-15")).toBe("15/10/2026");
    expect(formatarData("2026-01-01")).toBe("01/01/2026");
    expect(formatarData(null)).toBe("—");
  });

  it("o intervalo de um dia vai da meia-noite local à meia-noite seguinte", () => {
    const inicio = new Date(inicioDoDia("2026-10-15")!);
    const fim = new Date(fimDoDiaExclusivo("2026-10-15")!);
    expect(inicio.getDate()).toBe(15);
    expect(inicio.getHours()).toBe(0);
    expect(fim.getDate()).toBe(16);
    expect(fim.getHours()).toBe(0);
  });

  it("mês de uma data", () => {
    expect(mesDeData("2026-10-15")).toBe("OUT");
    expect(mesDeData("2026-01-31")).toBe("JAN");
    expect(mesDeData("")).toBe("");
  });
});
