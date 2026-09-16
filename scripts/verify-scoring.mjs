/**
 * Compara a implementação TypeScript do cálculo NEOP (client/src/lib/scoring.ts)
 * com a implementação SQL (supabase/03_scoring.sql).
 *
 *   node --experimental-strip-types scripts/verify-scoring.mjs "<connection-string>"
 *
 * Os casos são inseridos mesmo na tabela `evaluations`, por isso o teste cobre
 * o trigger completo e não apenas a função. Correr sempre contra uma base de
 * dados descartável — o script apaga o que cria.
 *
 * Qualquer divergência é um erro: se as duas não concordarem, a pré-visualização
 * no formulário mente ao avaliador.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calcScore } from "../client/src/lib/scoring.ts";

const CONN = process.argv[2];
if (!CONN) {
  console.error('Uso: node --experimental-strip-types scripts/verify-scoring.mjs "<connection-string>"');
  process.exit(1);
}

// As queries de teste são grandes demais para a linha de comandos (E2BIG),
// por isso passam por ficheiro.
const workDir = mkdtempSync(join(tmpdir(), "gioe-scoring-"));

const psql = (sql) => {
  const file = join(workDir, "query.sql");
  writeFileSync(file, sql, "utf8");
  return execFileSync("psql", [CONN, "-t", "-A", "-F", "|", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-f", file], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const bit = () => (Math.random() < 0.5 ? 0 : 1);

// Inclui valores fora da lista ("desconhecido") para confirmar que ambos os
// lados aplicam o mesmo valor por omissão.
const TIPOS = ["trafico", "assalto", "homicidio", "sequestro", "violencia", "outro", "desconhecido"];

const COLS = [
  "mandadoDetencao",
  "mandadoBusca",
  "quantidadeSuspeitos",
  "modalidadeIsolado",
  "modalidadeAssociacao",
  "tipoCriminal",
  "antecedentesContraPessoas",
  "antecedentesContraPatrimonio",
  "antecedentesOutros",
  "antecedentesFss",
  "posseArma",
  "usoArma",
  "tipologiaApartamento",
  "tipologiaMoradia",
  "tipologiaOutro",
  "contextoIsolado",
  "contextoBairroSocial",
  "contextoMeioUrbano",
  "contextoMeioRural",
  "segurancaCaes",
  "segurancaPortaBlindada",
  "segurancaOutrasMedidas",
];

function randomCase() {
  const nTipos = 1 + Math.floor(Math.random() * 3);
  return {
    mandadoDetencao: bit(),
    mandadoBusca: bit(),
    quantidadeSuspeitos: pick(["1", "2", "3", "4+", "9"]),
    modalidadeIsolado: bit(),
    modalidadeAssociacao: bit(),
    tipoCriminal: Array.from({ length: nTipos }, () => pick(TIPOS)).join(","),
    antecedentesContraPessoas: bit(),
    antecedentesContraPatrimonio: bit(),
    antecedentesOutros: bit(),
    antecedentesFss: pick(["sim", "nao"]),
    posseArma: pick(["registada", "provavel", "improvavel"]),
    usoArma: pick(["haRegisto", "naoHaRegisto"]),
    tipologiaApartamento: bit(),
    tipologiaMoradia: bit(),
    tipologiaOutro: bit(),
    contextoIsolado: bit(),
    contextoBairroSocial: bit(),
    contextoMeioUrbano: bit(),
    contextoMeioRural: bit(),
    segurancaCaes: bit(),
    segurancaPortaBlindada: bit(),
    segurancaOutrasMedidas: bit(),
  };
}

const N = Number(process.env.N ?? 5000);
const cases = Array.from({ length: N }, randomCase);

const lit = (v) => (typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

// Utilizador descartável — as chaves estrangeiras exigem um perfil existente.
const uid = psql(`
  insert into auth.users (email, raw_user_meta_data)
  values ('verificacao.scoring@gnr.pt', '{"name":"Verificação"}'::jsonb)
  returning id;
`)
  .trim()
  .split("\n")[0]
  .trim();

try {
  const values = cases
    .map((c, i) => `(${lit(uid)}::uuid, ${i}, ` + COLS.map((k) => lit(c[k])).join(", ") + ")")
    .join(",\n");

  const out = psql(`
    insert into public.evaluations ("userId", nuipc, ${COLS.map((c) => `"${c}"`).join(", ")})
    values
${values};

    select nuipc, pontuacao, neop
    from public.evaluations
    where "userId" = ${lit(uid)}::uuid
    order by nuipc::int;
  `);

  const rows = out
    .trim()
    .split("\n")
    .filter((l) => l.includes("|"))
    .map((line) => {
      const [idx, pontuacao, neop] = line.split("|");
      return { idx: Number(idx), pontuacao: Number(pontuacao), neop };
    });

  if (rows.length !== cases.length) {
    console.error(`Esperadas ${cases.length} linhas, recebidas ${rows.length}`);
    process.exit(1);
  }

  let falhas = 0;
  for (const row of rows) {
    const esperado = calcScore(cases[row.idx]);
    if (esperado.pontuacao !== row.pontuacao || esperado.neop !== row.neop) {
      if (falhas < 10) {
        console.error("DIVERGÊNCIA no caso", row.idx, JSON.stringify(cases[row.idx]));
        console.error("  TypeScript:", esperado);
        console.error("  PostgreSQL:", { pontuacao: row.pontuacao, neop: row.neop });
      }
      falhas++;
    }
  }

  if (falhas > 0) {
    console.error(`\n${falhas} de ${rows.length} casos divergem.`);
    process.exit(1);
  }

  console.log(`OK — ${rows.length} casos: TypeScript e PostgreSQL concordam em pontuação e NEOP.`);
} finally {
  psql(`delete from auth.users where id = ${lit(uid)}::uuid;`);
  rmSync(workDir, { recursive: true, force: true });
}
