import { describe, expect, it } from "vitest";
import { traduzirErro } from "../erros";

describe("traduzirErro", () => {
  it("não expõe detalhes internos de permissões", () => {
    expect(traduzirErro({ code: "42501", message: 'new row violates row-level security policy for table "x"' }).message).toBe(
      "Sem permissão para esta operação.",
    );
  });

  it("mantém as mensagens dos triggers, já em português", () => {
    expect(traduzirErro({ code: "P0001", message: "Apenas administradores atribuem operações" }).message).toBe(
      "Apenas administradores atribuem operações",
    );
  });

  it("usa o contexto para registos duplicados", () => {
    expect(traduzirErro({ code: "23505", message: "duplicate key" }, "Já existe um relatório.").message).toBe(
      "Já existe um relatório.",
    );
  });

  it("explica a falta de rede", () => {
    expect(traduzirErro(new Error("Failed to fetch")).message).toMatch(/Sem ligação/);
  });
});
