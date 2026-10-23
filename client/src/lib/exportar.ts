import { CLASSIFICACAO } from "@/components/Classificacao";
import { formatarDataHora } from "./datas";

type Celula = string | number | null | undefined;

/**
 * Um campo de texto que contém só um número ("12", "35,5", "1 200") passa a
 * número, para o Excel o poder somar; tudo o resto fica como estava.
 *
 * "1.200" fica como texto: tanto pode ser mil e duzentos (separador de
 * milhares) como um e dois décimos, e um número errado é pior do que texto.
 */
export function numeroSePossivel(valor: Celula): Celula {
  if (typeof valor !== "string") return valor;
  const limpo = valor.trim().replace(/\s/g, "");
  if (/^-?\d+(,\d+)?$/.test(limpo)) return Number(limpo.replace(",", "."));
  if (/^-?\d+\.\d+$/.test(limpo) && !/\.\d{3}$/.test(limpo)) return Number(limpo);
  return valor;
}

/**
 * Exporta uma folha de Excel com a marca de classificação no topo e no fim.
 *
 * Usa `write-excel-file`, que só escreve ficheiros e depende apenas de uma
 * biblioteca de compressão. Substitui o pacote `xlsx` 0.18.5, que tinha duas
 * vulnerabilidades conhecidas e já não recebe correções através do npm.
 *
 * Todo o texto é escrito como texto: um valor começado por "=" não é
 * interpretado como fórmula ao abrir o ficheiro.
 *
 * A biblioteca é carregada só quando é precisa.
 */
export async function exportarFolha(opcoes: {
  nomeFicheiro: string;
  nomeFolha: string;
  cabecalhos: Array<Array<string | number>>;
  linhas: Array<Array<Celula>>;
  larguras?: number[];
}) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");

  const texto = (valor: Celula, negrito = false) =>
    valor === null || valor === undefined || valor === ""
      ? null
      : typeof valor === "number"
        ? { value: valor, type: Number, ...(negrito ? { fontWeight: "bold" as const } : {}) }
        : { value: String(valor), type: String, ...(negrito ? { fontWeight: "bold" as const } : {}) };

  const marca = {
    value: `${CLASSIFICACAO} — exportado em ${formatarDataHora(new Date())}`,
    type: String,
    fontWeight: "bold" as const,
    textColor: "#B42318",
  };

  const dados = [
    [marca],
    [],
    ...opcoes.cabecalhos.map((linha) => linha.map((c) => texto(c, true))),
    ...opcoes.linhas.map((linha) => linha.map((c) => texto(c))),
    [],
    [{ ...marca, value: CLASSIFICACAO }],
  ];

  await writeExcelFile(dados, {
    sheet: opcoes.nomeFolha.slice(0, 31),
    columns: opcoes.larguras?.map((width) => ({ width })),
  }).toFile(opcoes.nomeFicheiro);
}
