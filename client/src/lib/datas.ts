/**
 * Datas e GDH (grupo data-hora).
 *
 * `new Date().toISOString()` devolve a data em UTC: entre a meia-noite e a
 * 01:00 (hora de verão) dá o dia anterior. Aqui tudo é calculado na hora local.
 */

export const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const dois = (n: number) => String(n).padStart(2, "0");

/** Data local de hoje no formato AAAA-MM-DD (o de um <input type="date">). */
export function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/** Decompõe AAAA-MM-DD sem passar por `new Date(texto)`, que o lê como UTC. */
function partesDeData(valor: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Formata para DD/MM/AAAA. Aceita AAAA-MM-DD (datas de formulário, mostradas
 * tal como foram escritas) ou um carimbo completo (convertido para hora local).
 */
export function formatarData(valor: string | null | undefined): string {
  if (!valor) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = partesDeData(valor)!;
    return `${dois(d)}/${dois(m)}/${a}`;
  }
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-PT");
}

export function formatarDataHora(valor: string | Date): string {
  const data = typeof valor === "string" ? new Date(valor) : valor;
  return Number.isNaN(data.getTime())
    ? String(valor)
    : `${data.toLocaleDateString("pt-PT")} ${data.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Início do dia local (AAAA-MM-DD) como instante ISO, para filtrar `createdAt`. */
export function inicioDoDia(valor: string): string | undefined {
  const p = partesDeData(valor);
  return p ? new Date(p[0], p[1] - 1, p[2]).toISOString() : undefined;
}

/** Início do dia local SEGUINTE — limite exclusivo de um intervalo "até ao dia X". */
export function fimDoDiaExclusivo(valor: string): string | undefined {
  const p = partesDeData(valor);
  return p ? new Date(p[0], p[1] - 1, p[2] + 1).toISOString() : undefined;
}

/** Mês (JAN…DEZ) de uma data AAAA-MM-DD. */
export function mesDeData(valor: string | null | undefined): string {
  const p = valor ? partesDeData(valor) : null;
  return p ? (MESES[p[1] - 1] ?? "") : "";
}

// ─── GDH: DDHHMMMMMAA, por exemplo 151630OUT26 ───────────────────────────────

const GDH_RE = /^(\d{2})(\d{2})(\d{2})([A-Z]{3})(\d{2})$/;

export const GDH_EXEMPLO = "151630OUT26";

/** Converte um GDH em data local, ou null se não for válido. */
export function gdhParaData(gdh: string | null | undefined): Date | null {
  if (!gdh) return null;
  const m = GDH_RE.exec(gdh.trim().toUpperCase());
  if (!m) return null;

  const [, dd, hh, mm, mes, aa] = m;
  const indiceMes = MESES.indexOf(mes);
  const dia = Number(dd);
  const hora = Number(hh);
  const minuto = Number(mm);
  if (indiceMes < 0 || hora > 23 || minuto > 59 || dia < 1) return null;

  const ano = 2000 + Number(aa);
  const data = new Date(ano, indiceMes, dia, hora, minuto);
  // Rejeita dias que não existem (31FEV passaria a 3 de março).
  if (data.getMonth() !== indiceMes || data.getDate() !== dia) return null;
  return data;
}

export const gdhValido = (gdh: string | null | undefined) => !gdh || gdhParaData(gdh) !== null;

/** Normaliza o que o militar escreve: maiúsculas, sem espaços. */
export const normalizarGdh = (valor: string) => valor.toUpperCase().replace(/\s+/g, "").slice(0, 11);

export function dataParaGdh(data: Date): string {
  return (
    dois(data.getDate()) +
    dois(data.getHours()) +
    dois(data.getMinutes()) +
    MESES[data.getMonth()] +
    dois(data.getFullYear() % 100)
  );
}

/** Horas entre dois GDH (com uma casa decimal), ou null se algum for inválido. Para exportar. */
export function horasEntreGdhNumero(inicio: string | null | undefined, fim: string | null | undefined): number | null {
  const a = gdhParaData(inicio);
  const b = gdhParaData(fim);
  if (!a || !b || b < a) return null;
  const horas = (b.getTime() - a.getTime()) / 3_600_000;
  return Math.round(horas * 10) / 10;
}

/** Horas entre dois GDH para mostrar (vírgula decimal), ou "" se algum for inválido. */
export function horasEntreGdh(inicio: string | null | undefined, fim: string | null | undefined): string {
  const horas = horasEntreGdhNumero(inicio, fim);
  return horas === null ? "" : horas.toString().replace(".", ",");
}
