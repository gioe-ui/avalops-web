import { describe, expect, it } from "vitest";
import { numeroSePossivel } from "../exportar";

describe("numeroSePossivel", () => {
  it("converte números simples, com vírgula decimal ou espaços", () => {
    expect(numeroSePossivel("12")).toBe(12);
    expect(numeroSePossivel(" 35,5 ")).toBe(35.5);
    expect(numeroSePossivel("1 200")).toBe(1200);
    expect(numeroSePossivel("12.5")).toBe(12.5);
  });

  it("deixa como texto o que não é só um número, ou é ambíguo", () => {
    expect(numeroSePossivel("1.200")).toBe("1.200");
    expect(numeroSePossivel("12 €")).toBe("12 €");
    expect(numeroSePossivel("=1+1")).toBe("=1+1");
    expect(numeroSePossivel("")).toBe("");
  });

  it("não mexe em números nem em valores vazios", () => {
    expect(numeroSePossivel(7)).toBe(7);
    expect(numeroSePossivel(null)).toBeNull();
    expect(numeroSePossivel(undefined)).toBeUndefined();
  });
});
