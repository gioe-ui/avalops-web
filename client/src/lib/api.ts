/**
 * Camada de dados.
 *
 * Substitui server/routers.ts e server/db.ts da aplicação original. Cada função
 * aqui corresponde a um procedimento tRPC que existia no servidor Express; a
 * assinatura e o formato de resposta foram mantidos para que as páginas não
 * precisem de ser reescritas.
 *
 * A autorização já não vive aqui — vive nas políticas de Row Level Security e
 * nos triggers (supabase/02_policies.sql e 05_seguranca.sql). Uma verificação
 * feita neste ficheiro seria apenas conveniência de interface: qualquer pessoa
 * pode chamar a API do Supabase diretamente.
 *
 * Uma particularidade do RLS que este ficheiro trata: um UPDATE ou DELETE sobre
 * uma linha que o utilizador não pode alterar NÃO dá erro — simplesmente não
 * afeta nada. Por isso as escritas pedem de volta as linhas afetadas e falham
 * se não houver nenhuma; de outro modo a interface diria "eliminado" sem nada
 * ter sido eliminado.
 */
import { createClient } from "@supabase/supabase-js";
import {
  concluirRecuperacao,
  inicializacao,
  marcarAtividade,
  supabase,
  terminarSessaoLocal,
  traduzirErro,
  unwrap,
} from "./supabase";
import { fimDoDiaExclusivo, inicioDoDia } from "./datas";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  approved: number;
  active: number;
  phoneNumber: string | null;
  mecanographicNumber: string | null;
  rank: string | null;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
}

export type Evaluation = Record<string, any> & {
  id: number;
  userId: string;
  pontuacao: number;
  neop: string;
  createdAt: string;
};

export type Operation = Record<string, any> & { id: number; evaluationId: number };
export type Suspect = Record<string, any> & { id: number; evaluationId: number };

export interface EstadoSessao {
  perfil: Profile;
  /** "aal1" depois da password, "aal2" depois do código do segundo fator. */
  nivel: "aal1" | "aal2" | null;
  /** Fator TOTP já confirmado, se existir. */
  fatorId: string | null;
}

export interface RegistoAuditoria {
  id: number;
  occurredAt: string;
  actorId: string | null;
  actorEmail: string | null;
  tableName: string;
  recordId: string | null;
  action: "INSERT" | "UPDATE" | "DELETE" | "EXPORT" | "PRINT";
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

export const PASSWORD_MINIMA = 12;

// ─── Utilitários ─────────────────────────────────────────────────────────────

const PAGINA = 1000;

/**
 * Lê todas as linhas de uma consulta, página a página.
 *
 * A API do Supabase devolve no máximo um certo número de linhas por pedido
 * (1000 por omissão). Sem isto, a partir desse número as listas e as
 * estatísticas ficavam incompletas sem qualquer aviso. A consulta tem de pedir
 * `count: "exact"` e uma ordenação estável.
 */
async function buscarTudo<T = any>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: any; error: any; count?: number | null }>,
): Promise<T[]> {
  const todos: T[] = [];
  let de = 0;
  let total: number | null = null;

  for (;;) {
    const { data, error, count } = await consulta(de, de + PAGINA - 1);
    if (error) throw traduzirErro(error);
    if (typeof count === "number") total = count;

    const linhas = (data ?? []) as T[];
    todos.push(...linhas);
    de += linhas.length;

    if (linhas.length === 0) break;
    if (total !== null ? de >= total : linhas.length < PAGINA) break;
  }

  return todos;
}

/** Falha se a escrita não afetou nenhuma linha (bloqueada pelo RLS ou inexistente). */
function exigirLinhas<T>(
  resultado: { data: T[] | null; error: any },
  mensagem = "Sem permissão para esta operação, ou o registo já não existe.",
): T[] {
  if (resultado.error) throw traduzirErro(resultado.error);
  const linhas = resultado.data ?? [];
  if (linhas.length === 0) throw new Error(mensagem);
  return linhas;
}

async function utilizadorAtual() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada. Entre novamente.");
  return data.user;
}

function validarPassword(password: string) {
  if (password.length < PASSWORD_MINIMA) {
    throw new Error(`A password tem de ter pelo menos ${PASSWORD_MINIMA} caracteres.`);
  }
}

const emailInstitucional = (email: string) => /^[^@\s]+@gnr\.pt$/i.test(email.trim());

// ─── auth ────────────────────────────────────────────────────────────────────

export const auth = {
  /**
   * Estado completo da sessão: perfil do militar e nível de autenticação.
   * Devolve null sem sessão. Todas as páginas dependem disto antes de pedirem
   * dados, e isto espera pela verificação de inatividade feita no arranque.
   */
  async sessao(): Promise<EstadoSessao | null> {
    await inicializacao;

    const { data: sessionData } = await supabase.auth.getUser();
    const user = sessionData.user;
    if (!user) return null;

    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw traduzirErro(error);

    // Sessão válida sem perfil: o registo foi rejeitado por um administrador
    // enquanto a sessão estava aberta. Termina-a.
    if (!data) {
      await terminarSessaoLocal();
      return null;
    }

    const [{ data: nivel }, { data: fatores }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    const fator = fatores?.totp?.find((f) => f.status === "verified") ?? null;

    return {
      perfil: data as Profile,
      nivel: (nivel?.currentLevel as EstadoSessao["nivel"]) ?? null,
      fatorId: fator?.id ?? null,
    };
  },

  async register(input: {
    email: string;
    password: string;
    name: string;
    phoneNumber: string;
    mecanographicNumber: string;
    rank: string;
  }) {
    const email = input.email.trim().toLowerCase();
    if (!emailInstitucional(email)) throw new Error("O registo está restrito a endereços @gnr.pt.");
    validarPassword(input.password);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        data: {
          name: input.name.trim(),
          phoneNumber: input.phoneNumber.trim(),
          mecanographicNumber: input.mecanographicNumber.trim(),
          rank: input.rank,
        },
      },
    });

    if (error) {
      // O trigger handle_new_user rejeita domínios fora de @gnr.pt; a mensagem
      // chega aqui embrulhada pelo GoTrue.
      if (/gnr\.pt/i.test(error.message)) {
        throw new Error("O registo está restrito a endereços @gnr.pt.");
      }
      if (/already registered|already exists/i.test(error.message)) {
        throw new Error("Email já registado.");
      }
      if (/password/i.test(error.message)) {
        throw new Error("A password não cumpre as regras de segurança definidas no servidor.");
      }
      throw traduzirErro(error);
    }

    return { success: true as const, user: data.user, sessao: Boolean(data.session) };
  },

  async login(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    if (!emailInstitucional(email)) throw new Error("O email tem de terminar em @gnr.pt.");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });

    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        throw new Error("Email ou password incorretos.");
      }
      if (/email not confirmed/i.test(error.message)) {
        throw new Error("Confirme o email antes de entrar. Verifique a sua caixa de correio.");
      }
      throw traduzirErro(error);
    }

    marcarAtividade();
    return { success: true as const, user: data.user };
  },

  /**
   * Regista a hora de entrada. Só é possível depois do segundo fator (o perfil
   * não é editável em aal1); o valor gravado é a hora do servidor.
   */
  async registarEntrada() {
    const user = await utilizadorAtual();
    await supabase.from("profiles").update({ lastSignedIn: new Date().toISOString() }).eq("id", user.id);
    return { success: true as const };
  },

  async logout() {
    await terminarSessaoLocal();
    return { success: true as const };
  },

  async updateProfile(input: {
    name?: string;
    phoneNumber?: string;
    mecanographicNumber?: string;
    rank?: string;
  }) {
    const user = await utilizadorAtual();

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.phoneNumber !== undefined) patch.phoneNumber = input.phoneNumber.trim();
    if (input.mecanographicNumber !== undefined) patch.mecanographicNumber = input.mecanographicNumber.trim();
    if (input.rank !== undefined) patch.rank = input.rank;

    if (Object.keys(patch).length === 0) throw new Error("Nenhum campo para atualizar.");

    const linhas = exigirLinhas(await supabase.from("profiles").update(patch).eq("id", user.id).select());
    return { success: true as const, user: linhas[0] as Profile };
  },

  /**
   * Alterar a password pede a atual. A verificação é feita num cliente
   * separado, sem guardar sessão, para não substituir a sessão em curso (que
   * já passou o segundo fator).
   */
  async changePassword(input: { atual: string; nova: string }) {
    const user = await utilizadorAtual();
    validarPassword(input.nova);
    if (input.atual === input.nova) throw new Error("A nova password tem de ser diferente da atual.");

    const verificador = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "gioe-verificacao",
        },
      },
    );

    const { error: erroVerificacao } = await verificador.auth.signInWithPassword({
      email: user.email!,
      password: input.atual,
    });
    if (erroVerificacao) throw new Error("A password atual está incorreta.");
    await verificador.auth.signOut({ scope: "local" });

    const { error } = await supabase.auth.updateUser({ password: input.nova });
    if (error) throw traduzirErro(error);
    return { success: true as const };
  },

  /** Define a nova password depois de abrir a ligação de recuperação. */
  async definirNovaPassword(nova: string) {
    validarPassword(nova);
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) throw traduzirErro(error);
    concluirRecuperacao();
    return { success: true as const };
  },

  async requestPasswordReset(email: string) {
    const normalizado = email.trim().toLowerCase();
    if (!emailInstitucional(normalizado)) throw new Error("Introduza o seu email @gnr.pt.");
    const { error } = await supabase.auth.resetPasswordForEmail(normalizado, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    });
    if (error) throw traduzirErro(error);
    return { success: true as const };
  },

  // ─── Segundo fator (TOTP) ──────────────────────────────────────────────────

  /** Inicia o registo de uma aplicação autenticadora. Devolve o QR code. */
  async mfaIniciarRegisto() {
    const { data: fatores } = await supabase.auth.mfa.listFactors();

    // Registos anteriores não concluídos (por exemplo, QR code fechado a meio)
    // impediriam um novo com o mesmo nome.
    for (const fator of fatores?.all ?? []) {
      if (fator.factor_type === "totp" && fator.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: fator.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "GIOE",
      issuer: "GIOE",
    });
    if (error) throw traduzirErro(error);

    return { factorId: data.id, qrCode: data.totp.qr_code, segredo: data.totp.secret };
  },

  async mfaConfirmarRegisto(input: { factorId: string; codigo: string }) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: input.factorId,
      code: input.codigo.trim(),
    });
    if (error) throw new Error("Código inválido ou expirado. Confirme a hora do telemóvel e tente de novo.");
    marcarAtividade();
    return { success: true as const };
  },

  async mfaVerificar(input: { factorId: string; codigo: string }) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: input.factorId,
      code: input.codigo.trim(),
    });
    if (error) throw new Error("Código inválido ou expirado.");
    marcarAtividade();
    return { success: true as const };
  },
};

// ─── evaluations ─────────────────────────────────────────────────────────────

/** Campos da operação associada que a listagem do Dashboard achata na avaliação. */
const LIST_SELECT = `
  *,
  operations (
    id,
    "assignedUserId",
    "scheduledDate",
    "operacaoPreenchida",
    "consumosPreenchidos",
    "observacoesPreenchidas",
    assigned:profiles!operations_assignedUserId_fkey ( "name", "rank", "phoneNumber" )
  )
`;

/**
 * Achata o resultado embebido para o formato que a aplicação original
 * devolvia através do LEFT JOIN em server/db.ts.
 */
function flattenEvaluationRow(row: any) {
  const operation = Array.isArray(row.operations) ? row.operations[0] : row.operations;
  const assigned = operation?.assigned ?? null;
  const { operations: _drop, ...evaluation } = row;

  return {
    ...evaluation,
    operationId: operation?.id ?? null,
    assignedUserId: operation?.assignedUserId ?? null,
    assignedUserName: assigned?.name ?? null,
    assignedUserRank: assigned?.rank ?? null,
    assignedUserPhone: assigned?.phoneNumber ?? null,
    scheduledDate: operation?.scheduledDate ?? null,
    operacaoPreenchida: operation?.operacaoPreenchida ?? null,
    consumosPreenchidos: operation?.consumosPreenchidos ?? null,
    observacoesPreenchidas: operation?.observacoesPreenchidas ?? null,
  };
}

/**
 * Comando Territorial de uma avaliação.
 *
 * O valor próprio é a coluna `cterRequerente`. A versão anterior nunca a
 * preenchia: escrevia o CTer no início do parecer como "[CT Lisboa] ..." e
 * depois procurava-o com o padrão "CTer: ...", que nunca coincidia — daí a
 * coluna CTer aparecer sempre vazia no histórico e o filtro não ter opções.
 * Continuamos a ler os dois formatos antigos para não perder registos
 * anteriores.
 */
export function cterDaAvaliacao(e: { cterRequerente?: string | null; parecer?: string | null }) {
  if (e.cterRequerente) return e.cterRequerente.trim();
  if (!e.parecer) return null;

  const entreParenteses = e.parecer.match(/\[([^\]]+)\]/);
  if (entreParenteses) return entreParenteses[1].trim();

  const comPrefixo = e.parecer.match(/CTer:\s*([^\n,]+)/i);
  if (comPrefixo) return comPrefixo[1].trim();

  return null;
}

type Suspeito = {
  nome?: string | null;
  dataNascimento?: string | null;
  nacionalidade?: string | null;
  nif?: string | null;
  cc?: string | null;
  morada?: string | null;
  observacoes?: string | null;
};

export const evaluations = {
  async list(filters?: { neop?: string; avaliador?: string; cterRequerente?: string; userId?: string }) {
    const rows = await buscarTudo((de, ate) => {
      let query = supabase
        .from("evaluations")
        .select(LIST_SELECT, { count: "exact" })
        .order("createdAt", { ascending: false })
        .order("id", { ascending: false });

      if (filters?.neop) query = query.eq("neop", filters.neop);
      if (filters?.avaliador) query = query.ilike("avaliador", `%${filters.avaliador}%`);
      if (filters?.userId) query = query.eq("userId", filters.userId);

      // Aceita tanto a coluna própria como os registos antigos, em que o CTer
      // só existia dentro do texto do parecer. Vírgulas, parênteses, aspas e
      // barras mudariam a estrutura do filtro `or`, por isso são retirados.
      if (filters?.cterRequerente) {
        const valor = filters.cterRequerente.replace(/[,()"\\]/g, "");
        query = query.or(`cterRequerente.eq.${valor},parecer.ilike.%${valor}%`);
      }

      return query.range(de, ate);
    });

    return rows.map(flattenEvaluationRow);
  },

  async getById(input: { id: number }) {
    const { data, error } = await supabase.from("evaluations").select("*").eq("id", input.id).maybeSingle();
    if (error) throw traduzirErro(error);
    if (!data) throw new Error("Avaliação não encontrada");
    return data as Evaluation;
  },

  /**
   * Cria ou altera uma avaliação juntamente com os seus suspeitos, numa só
   * transação (função gioe_guardar_avaliacao). Ou fica tudo gravado, ou nada.
   * A pontuação e o NEOP devolvidos são os calculados pela base de dados.
   */
  async guardar(input: { id?: number; dados: Record<string, any>; suspeitos: Suspeito[] }) {
    const { data, error } = await supabase.rpc("gioe_guardar_avaliacao", {
      p_id: input.id ?? null,
      p_dados: input.dados,
      p_suspeitos: input.suspeitos,
    });
    if (error) throw traduzirErro(error);
    const resultado = data as { id: number; pontuacao: number; neop: string };
    return {
      success: true as const,
      evaluationId: resultado.id,
      pontuacao: resultado.pontuacao,
      neop: resultado.neop,
    };
  },

  /** Muda apenas a classificação manual; a pontuação continua a vir dos critérios. */
  async atualizarNeop(input: { id: number; neopManual: string | null }) {
    const linhas = exigirLinhas(
      await supabase
        .from("evaluations")
        .update({ neopManual: input.neopManual || null })
        .eq("id", input.id)
        .select("pontuacao, neop"),
      "Só o autor da avaliação ou um administrador pode mudar o NEOP.",
    );
    return { success: true as const, pontuacao: linhas[0].pontuacao, neop: linhas[0].neop };
  },

  async delete(input: { id: number }) {
    // As operações e suspeitos associados caem por ON DELETE CASCADE.
    exigirLinhas(
      await supabase.from("evaluations").delete().eq("id", input.id).select("id"),
      "Só o autor da avaliação ou um administrador a pode eliminar.",
    );
    return { success: true as const };
  },

  async deleteMany(input: { ids: number[] }) {
    if (input.ids.length === 0) return { eliminadas: 0, pedidas: 0 };
    const { data, error } = await supabase.from("evaluations").delete().in("id", input.ids).select("id");
    if (error) throw traduzirErro(error);
    return { eliminadas: data?.length ?? 0, pedidas: input.ids.length };
  },

  /** Lista os Comandos Territoriais presentes nas avaliações, para o filtro. */
  async getCters() {
    const rows = await buscarTudo((de, ate) =>
      supabase
        .from("evaluations")
        .select('id, "cterRequerente", parecer', { count: "exact" })
        .order("id")
        .range(de, ate),
    );
    const cters = new Set<string>();
    rows.forEach((e: any) => {
      const cter = cterDaAvaliacao(e);
      if (cter) cters.add(cter);
    });
    return Array.from(cters).sort((a, b) => a.localeCompare(b, "pt"));
  },
};

// ─── statistics ──────────────────────────────────────────────────────────────

/** Avaliações num intervalo de datas (dias locais, ambos inclusivos). */
function avaliacoesNoIntervalo<T>(colunas: string, input?: { startDate?: string; endDate?: string }, neop?: string) {
  return buscarTudo<T>((de, ate) => {
    let query = supabase.from("evaluations").select(colunas, { count: "exact" }).order("id");
    const inicio = input?.startDate ? inicioDoDia(input.startDate) : undefined;
    const fim = input?.endDate ? fimDoDiaExclusivo(input.endDate) : undefined;
    if (inicio) query = query.gte("createdAt", inicio);
    if (fim) query = query.lt("createdAt", fim);
    if (neop) query = query.eq("neop", neop);
    return query.range(de, ate);
  });
}

export const statistics = {
  async get(input?: { startDate?: string; endDate?: string }) {
    const all = await avaliacoesNoIntervalo<{ pontuacao: number; neop: string }>("id, pontuacao, neop", input);

    const total = all.length;
    const avgScore = total > 0 ? all.reduce((s, e) => s + e.pontuacao, 0) / total : 0;

    return {
      total,
      avgScore,
      neop2: all.filter((e) => e.neop === "2º NEOP").length,
      neop3: all.filter((e) => e.neop === "3º NEOP").length,
      neop4: all.filter((e) => e.neop === "4º NEOP").length,
      score0_25: all.filter((e) => e.pontuacao <= 25).length,
      score26_50: all.filter((e) => e.pontuacao >= 26 && e.pontuacao <= 50).length,
      score51_75: all.filter((e) => e.pontuacao >= 51 && e.pontuacao <= 75).length,
      score76_100: all.filter((e) => e.pontuacao >= 76).length,
    };
  },

  /** Conta os 4º NEOP por Comando Territorial, para o mapa. */
  async neop4ByCter(input?: { startDate?: string; endDate?: string }) {
    const rows = await avaliacoesNoIntervalo<{ parecer: string | null; cterRequerente: string | null }>(
      'id, parecer, "cterRequerente"',
      input,
      "4º NEOP",
    );

    const cterCounts: Record<string, number> = {};
    rows.forEach((e) => {
      const nome = cterDaAvaliacao(e);
      if (nome) cterCounts[nome] = (cterCounts[nome] || 0) + 1;
    });
    return cterCounts;
  },
};

// ─── users ───────────────────────────────────────────────────────────────────

export const users = {
  async list() {
    return buscarTudo<Profile>((de, ate) =>
      supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .order("createdAt", { ascending: false })
        .order("id")
        .range(de, ate),
    );
  },

  /**
   * Desativa a conta: o militar perde imediatamente o acesso, mas tudo o que
   * registou fica intacto. Substitui a eliminação, que apagava em cascata as
   * avaliações, os suspeitos e as operações dessa pessoa.
   */
  async desativar(input: { id: string }) {
    exigirLinhas(await supabase.from("profiles").update({ active: 0 }).eq("id", input.id).select("id"));
    return { success: true as const };
  },

  async reativar(input: { id: string }) {
    exigirLinhas(await supabase.from("profiles").update({ active: 1 }).eq("id", input.id).select("id"));
    return { success: true as const };
  },

  async promoteToAdmin(input: { id: string }) {
    exigirLinhas(
      await supabase.from("profiles").update({ role: "admin", approved: 1 }).eq("id", input.id).select("id"),
    );
    return { success: true as const };
  },

  async removerAdmin(input: { id: string }) {
    exigirLinhas(await supabase.from("profiles").update({ role: "user" }).eq("id", input.id).select("id"));
    return { success: true as const };
  },

  async getPending() {
    return unwrap(
      await supabase
        .from("profiles")
        .select("*")
        .eq("approved", 0)
        .eq("active", 1)
        .order("createdAt", { ascending: false }),
    ) as Profile[];
  },

  async approve(input: { id: string }) {
    exigirLinhas(await supabase.from("profiles").update({ approved: 1 }).eq("id", input.id).select("id"));
    return { success: true as const };
  },

  /** Rejeita um registo por aprovar. Contas aprovadas não se eliminam — desativam-se. */
  async reject(input: { id: string }) {
    exigirLinhas(
      await supabase.from("profiles").delete().eq("id", input.id).eq("approved", 0).select("id"),
      "Só é possível rejeitar registos que ainda não foram aprovados.",
    );
    return { success: true as const };
  },
};

// ─── operations ──────────────────────────────────────────────────────────────

/**
 * Campos que o cliente nunca envia numa operação: ou são do servidor (estado
 * de preenchimento, datas), ou só os administradores os mudam, por funções
 * próprias (atribuição, sinalização).
 */
const CAMPOS_PROTEGIDOS_OPERACAO = new Set([
  "id",
  "userId",
  "evaluationId",
  "assignedUserId",
  "scheduledDate",
  "flaggedForCompletion",
  "flaggedAt",
  "operacaoPreenchida",
  "consumosPreenchidos",
  "observacoesPreenchidas",
  "createdAt",
  "assignedUserName",
  "assignedUserRank",
  "assignedUserPhone",
  "avaliacao",
  "assigned",
]);

function camposEditaveisOperacao(input: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!CAMPOS_PROTEGIDOS_OPERACAO.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

export const operations = {
  async create(input: Record<string, any> & { evaluationId: number }) {
    const { data, error } = await supabase
      .from("operations")
      .insert({ ...camposEditaveisOperacao(input), evaluationId: input.evaluationId })
      .select("id")
      .single();
    if (error) {
      throw traduzirErro(error, "Já existe um relatório de operação para esta avaliação.");
    }
    return { success: true as const, id: data.id as number };
  },

  async getByEvaluationId(input: { evaluationId: number }) {
    const { data, error } = await supabase
      .from("operations")
      .select("*")
      .eq("evaluationId", input.evaluationId)
      .order("id")
      .limit(1)
      .maybeSingle();
    if (error) throw traduzirErro(error);
    return (data as Operation) ?? null;
  },

  async getById(input: { id: number }) {
    const { data, error } = await supabase
      .from("operations")
      .select('*, avaliacao:evaluations ( "userId" )')
      .eq("id", input.id)
      .maybeSingle();
    if (error) throw traduzirErro(error);
    if (!data) return null;
    const { avaliacao, ...operacao } = data as any;
    return { ...operacao, autorAvaliacaoId: avaliacao?.userId ?? null } as Operation;
  },

  async update(input: Record<string, any> & { id: number }) {
    const { id, ...resto } = input;
    exigirLinhas(
      await supabase.from("operations").update(camposEditaveisOperacao(resto)).eq("id", id).select("id"),
      "Só o autor da avaliação, o militar atribuído ou um administrador podem alterar esta operação.",
    );
    return { success: true as const };
  },

  async getMonths() {
    const rows = await buscarTudo<{ preenchimentoSecOp: string | null }>((de, ate) =>
      supabase
        .from("operations")
        .select('id, "preenchimentoSecOp"', { count: "exact" })
        .order("id")
        .range(de, ate),
    );
    const months = new Set<string>();
    rows.forEach((op) => {
      if (op.preenchimentoSecOp) months.add(op.preenchimentoSecOp);
    });
    return Array.from(months).sort();
  },

  async getByMonth(input?: { month?: string }) {
    // O militar atribuído vem junto para que o botão de notificação tenha o
    // nome e o telefone; o autor da avaliação, para saber quem pode eliminar.
    const rows = await buscarTudo<any>((de, ate) => {
      let query = supabase
        .from("operations")
        .select(
          '*, assigned:profiles!operations_assignedUserId_fkey ( "name", "rank", "phoneNumber" ), avaliacao:evaluations ( "userId" )',
          { count: "exact" },
        )
        .order("id");
      if (input?.month) query = query.eq("preenchimentoSecOp", input.month);
      return query.range(de, ate);
    });

    return rows.map(({ assigned, avaliacao, ...op }) => ({
      ...op,
      assignedUserName: assigned?.name ?? null,
      assignedUserRank: assigned?.rank ?? null,
      assignedUserPhone: assigned?.phoneNumber ?? null,
      autorAvaliacaoId: avaliacao?.userId ?? null,
    })) as Operation[];
  },

  async deleteMany(input: { ids: number[] }) {
    if (input.ids.length === 0) return { eliminadas: 0, pedidas: 0 };
    const { data, error } = await supabase.from("operations").delete().in("id", input.ids).select("id");
    if (error) throw traduzirErro(error);
    return { eliminadas: data?.length ?? 0, pedidas: input.ids.length };
  },

  /** Militares a quem se pode atribuir uma operação: aprovados e ativos. */
  async listMilitares() {
    return unwrap(
      await supabase
        .from("profiles")
        .select('id, "name", email, "rank", "phoneNumber", "mecanographicNumber"')
        .eq("approved", 1)
        .eq("active", 1)
        .order("name"),
    ) as Array<Pick<Profile, "id" | "name" | "email" | "rank" | "phoneNumber" | "mecanographicNumber">>;
  },

  /** Só administradores (imposto pela base de dados). */
  async assignToMilitar(input: { operationId: number; assignedUserId: string; scheduledDate: string }) {
    exigirLinhas(
      await supabase
        .from("operations")
        .update({ assignedUserId: input.assignedUserId, scheduledDate: input.scheduledDate })
        .eq("id", input.operationId)
        .select("id"),
    );
    return { success: true as const };
  },

  /**
   * Regista a notificação e devolve a ligação wa.me para abrir. O destinatário,
   * o telefone, a mensagem e a ligação são gerados pela base de dados a partir
   * da operação — o cliente envia só o identificador.
   */
  async sendNotification(input: { operationId: number }) {
    const { data, error } = await supabase
      .from("notifications")
      .insert({ operationId: input.operationId })
      .select("whatsappLink")
      .single();
    if (error) throw traduzirErro(error);

    const ligacao = String(data.whatsappLink ?? "");
    // Defesa em profundidade: só se abre uma ligação para o WhatsApp.
    if (!/^https:\/\/wa\.me\/\d+\?text=/.test(ligacao)) {
      throw new Error("Ligação de notificação inválida.");
    }
    return { whatsappLink: ligacao };
  },

  async listMilitarOperations() {
    const user = await utilizadorAtual();
    return unwrap(
      await supabase
        .from("operations")
        .select(
          'id, "operacaoNumero", "dataOp", "scheduledDate", "operacaoPreenchida", "consumosPreenchidos", ' +
            '"observacoesPreenchidas", "flaggedForCompletion", "flaggedAt", "preenchimentoSecOp", "cmdtOp", ' +
            '"efetivTotalOperacao"',
        )
        .eq("assignedUserId", user.id)
        .order("id", { ascending: false }),
    ) as unknown as Operation[];
  },

  /**
   * Sinaliza operações atribuídas cujo relatório ainda está incompleto.
   * Só administradores; a sinalização desaparece sozinha quando o relatório
   * fica completo.
   */
  async flagIncompleteOperations() {
    const { data, error } = await supabase
      .from("operations")
      .update({ flaggedForCompletion: 1, flaggedAt: new Date().toISOString() })
      .not("assignedUserId", "is", null)
      .eq("flaggedForCompletion", 0)
      .or("operacaoPreenchida.eq.0,consumosPreenchidos.eq.0,observacoesPreenchidas.eq.0")
      .select("id");
    if (error) throw traduzirErro(error);
    return { flagged: data?.length ?? 0 };
  },
};

// ─── suspects ────────────────────────────────────────────────────────────────

export const suspects = {
  async getByEvaluationId(input: { evaluationId: number }) {
    return (unwrap(
      await supabase.from("suspects").select("*").eq("evaluationId", input.evaluationId).order("id"),
    ) ?? []) as Suspect[];
  },
};

// ─── suspectProfiles ─────────────────────────────────────────────────────────

export const suspectProfiles = {
  async list() {
    const todos = await buscarTudo<any>((de, ate) =>
      supabase
        .from("suspects")
        .select("*, evaluations ( neop )", { count: "exact" })
        .order("id")
        .range(de, ate),
    );

    // Agrupar por pessoa (nome + NIF + CC), como na versão original.
    const unicos = new Map<string, any[]>();
    todos.forEach((s) => {
      const chave = [s.nome, s.nif, s.cc].map((v) => (v ?? "").toString().trim().toLowerCase()).join("|");
      const lista = unicos.get(chave) ?? [];
      lista.push(s);
      unicos.set(chave, lista);
    });

    return Array.from(unicos.values()).map((ocorrencias) => {
      const primeiro = ocorrencias[0];
      const neops = ocorrencias.map((o) => o.evaluations?.neop).filter(Boolean);

      return {
        id: primeiro.id as number,
        nome: primeiro.nome as string | null,
        nif: primeiro.nif as string | null,
        cc: primeiro.cc as string | null,
        nacionalidade: primeiro.nacionalidade as string | null,
        totalOperations: ocorrencias.length,
        neop4Count: neops.filter((n: string) => n === "4º NEOP").length,
      };
    });
  },
};

// ─── audit ───────────────────────────────────────────────────────────────────

export const audit = {
  /** Só administradores (imposto pela base de dados). */
  async list(input?: { tabela?: string; acao?: string; limite?: number }) {
    let query = supabase
      .from("audit_log")
      .select("*")
      .order("occurredAt", { ascending: false })
      .limit(Math.min(input?.limite ?? 200, 1000));
    if (input?.tabela) query = query.eq("tableName", input.tabela);
    if (input?.acao) query = query.eq("action", input.acao);
    return unwrap(await query) as RegistoAuditoria[];
  },

  /**
   * Regista uma exportação ou impressão. Não bloqueia a ação se falhar: o
   * registo é complementar, não uma condição.
   */
  async registar(input: { acao: "EXPORT" | "PRINT"; detalhe: Record<string, unknown> }) {
    const { error } = await supabase.rpc("registar_evento", { p_acao: input.acao, p_detalhe: input.detalhe });
    if (error) console.warn("[auditoria] não foi possível registar o evento", error.message);
    return { success: !error };
  },
};

export const api = {
  auth,
  evaluations,
  statistics,
  users,
  operations,
  suspects,
  suspectProfiles,
  audit,
};
