/**
 * Camada de dados.
 *
 * Substitui server/routers.ts e server/db.ts da aplicação original. Cada função
 * aqui corresponde a um procedimento tRPC que existia no servidor Express; a
 * assinatura e o formato de resposta foram mantidos para que as páginas não
 * precisem de ser reescritas.
 *
 * A autorização já não vive aqui — vive nas políticas de Row Level Security
 * (supabase/02_policies.sql). Uma verificação feita neste ficheiro seria apenas
 * conveniência de interface: qualquer pessoa pode chamar a API do Supabase
 * diretamente. Onde este ficheiro verifica papéis, é para esconder botões, não
 * para proteger dados.
 */
import { supabase, unwrap } from "./supabase";
import { calcScore } from "./scoring";
import type { ScoringInput } from "./scoring";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  approved: number;
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

// ─── auth ────────────────────────────────────────────────────────────────────

export const auth = {
  /** Equivalente a `auth.me`: devolve o perfil do militar autenticado, ou null. */
  async me(): Promise<Profile | null> {
    const { data: sessionData } = await supabase.auth.getUser();
    const user = sessionData.user;
    if (!user) return null;

    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw new Error(error.message);

    // Sessão válida sem perfil: a conta foi eliminada ou rejeitada por um
    // administrador enquanto a sessão estava aberta. Termina-a.
    if (!data) {
      await supabase.auth.signOut();
      return null;
    }

    return data as Profile;
  },

  async register(input: {
    email: string;
    password: string;
    name: string;
    phoneNumber: string;
    mecanographicNumber: string;
    rank: string;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: {
          name: input.name,
          phoneNumber: input.phoneNumber,
          mecanographicNumber: input.mecanographicNumber,
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
      throw new Error(error.message);
    }

    return { success: true as const, user: data.user };
  },

  async login(input: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });

    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        throw new Error("Email ou password incorretos.");
      }
      if (/email not confirmed/i.test(error.message)) {
        throw new Error("Confirme o email antes de entrar. Verifique a sua caixa de correio.");
      }
      throw new Error(error.message);
    }

    if (data.user) {
      await supabase
        .from("profiles")
        .update({ lastSignedIn: new Date().toISOString() })
        .eq("id", data.user.id);
    }

    return { success: true as const, user: data.user };
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async updateProfile(input: {
    name?: string;
    phoneNumber?: string;
    mecanographicNumber?: string;
    rank?: string;
  }) {
    const { data: sessionData } = await supabase.auth.getUser();
    const user = sessionData.user;
    if (!user) throw new Error("Sessão expirada.");

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.phoneNumber !== undefined) patch.phoneNumber = input.phoneNumber;
    if (input.mecanographicNumber !== undefined) patch.mecanographicNumber = input.mecanographicNumber;
    if (input.rank !== undefined) patch.rank = input.rank;

    if (Object.keys(patch).length === 0) throw new Error("Nenhum campo para atualizar.");

    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { success: true as const, user: data as Profile };
  },

  async changePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    });
    if (error) throw new Error(error.message);
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

/** Campos que o cliente nunca envia: são calculados pelo trigger na base de dados. */
const CAMPOS_CALCULADOS = ["pontuacao", "neop", "updatedBy", "updatedAt", "createdAt", "id"];

function limparEntrada(input: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    if (CAMPOS_CALCULADOS.includes(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export const evaluations = {
  async list(filters?: { neop?: string; avaliador?: string; cterRequerente?: string; userId?: string }) {
    let query = supabase.from("evaluations").select(LIST_SELECT).order("createdAt", { ascending: false });

    if (filters?.neop) query = query.ilike("neop", `%${filters.neop}%`);
    if (filters?.avaliador) query = query.ilike("avaliador", `%${filters.avaliador}%`);
    if (filters?.userId) query = query.eq("userId", filters.userId);

    // Aceita tanto a coluna própria como os registos antigos, em que o CTer só
    // existia dentro do texto do parecer.
    if (filters?.cterRequerente) {
      const valor = filters.cterRequerente.replace(/[,()]/g, "");
      query = query.or(`cterRequerente.eq.${valor},parecer.ilike.%${valor}%`);
    }

    const rows = unwrap(await query);
    return (rows ?? []).map(flattenEvaluationRow);
  },

  async getById(input: { id: number }) {
    const { data, error } = await supabase.from("evaluations").select("*").eq("id", input.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Avaliação não encontrada");
    return data as Evaluation;
  },

  async create(input: Record<string, any>) {
    const { data: sessionData } = await supabase.auth.getUser();
    const user = sessionData.user;
    if (!user) throw new Error("Sessão expirada.");

    const { neopManual, ...resto } = input;

    const { data, error } = await supabase
      .from("evaluations")
      .insert({ ...limparEntrada(resto), neopManual: neopManual || null, userId: user.id })
      .select("id, pontuacao, neop")
      .single();

    if (error) throw new Error(error.message);

    return {
      success: true as const,
      pontuacao: data.pontuacao,
      neop: data.neop,
      evaluationId: data.id,
    };
  },

  async update(input: Record<string, any> & { id: number }) {
    const { id, neopManual, ...resto } = input;

    const { data, error } = await supabase
      .from("evaluations")
      .update({ ...limparEntrada(resto), neopManual: neopManual || null })
      .eq("id", id)
      .select("pontuacao, neop")
      .single();

    if (error) throw new Error(error.message);
    return { success: true as const, pontuacao: data.pontuacao, neop: data.neop };
  },

  async delete(input: { id: number }) {
    // As operações e suspeitos associados caem por ON DELETE CASCADE.
    const { error } = await supabase.from("evaluations").delete().eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  /** Pré-visualização em tempo real — não toca na base de dados. */
  async preview(input: ScoringInput & { neopManual?: string }) {
    const resultado = calcScore(input);
    return input.neopManual ? { ...resultado, neop: input.neopManual } : resultado;
  },

  /** Lista os Comandos Territoriais presentes nas avaliações, para o filtro. */
  async getCters() {
    const rows = unwrap(await supabase.from("evaluations").select('"cterRequerente", parecer'));
    const cters = new Set<string>();

    (rows ?? []).forEach((e: any) => {
      const cter = cterDaAvaliacao(e);
      if (cter) cters.add(cter);
    });

    return Array.from(cters).sort();
  },
};

// ─── statistics ──────────────────────────────────────────────────────────────

function dentroDoIntervalo(createdAt: string, startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return true;
  const d = new Date(createdAt);
  if (startDate && d < new Date(startDate)) return false;
  if (endDate && d > new Date(endDate)) return false;
  return true;
}

export const statistics = {
  async get(input?: { startDate?: string; endDate?: string }) {
    const rows = unwrap(
      await supabase.from("evaluations").select("pontuacao, neop, createdAt"),
    ) as Array<{ pontuacao: number; neop: string; createdAt: string }>;

    const all = (rows ?? []).filter((e) => dentroDoIntervalo(e.createdAt, input?.startDate, input?.endDate));

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
    const rows = unwrap(
      await supabase
        .from("evaluations")
        .select('neop, parecer, "cterRequerente", "createdAt"')
        .eq("neop", "4º NEOP"),
    ) as Array<{ parecer: string | null; cterRequerente: string | null; createdAt: string }>;

    const cterCounts: Record<string, number> = {};

    (rows ?? [])
      .filter((e) => dentroDoIntervalo(e.createdAt, input?.startDate, input?.endDate))
      .forEach((e) => {
        const nome = cterDaAvaliacao(e);
        if (nome) cterCounts[nome] = (cterCounts[nome] || 0) + 1;
      });

    return cterCounts;
  },
};

// ─── users ───────────────────────────────────────────────────────────────────

export const users = {
  async list() {
    return unwrap(
      await supabase.from("profiles").select("*").order("createdAt", { ascending: false }),
    ) as Profile[];
  },

  async delete(input: { id: string }) {
    // Remove o perfil. A conta em auth.users só pode ser apagada com a
    // service_role key, que não existe num site estático — ver README.
    const { error } = await supabase.from("profiles").delete().eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async promoteToAdmin(input: { id: string }) {
    const { error } = await supabase.from("profiles").update({ role: "admin", approved: 1 }).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async getPending() {
    return unwrap(
      await supabase.from("profiles").select("*").eq("approved", 0).order("createdAt", { ascending: false }),
    ) as Profile[];
  },

  async approve(input: { id: string }) {
    const { error } = await supabase.from("profiles").update({ approved: 1 }).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async reject(input: { id: string }) {
    const { error } = await supabase.from("profiles").delete().eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },
};

// ─── operations ──────────────────────────────────────────────────────────────

export const operations = {
  async create(input: Record<string, any> & { evaluationId: number }) {
    const { data: sessionData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("operations")
      .insert({ ...input, userId: sessionData.user?.id ?? null });
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async getByEvaluationId(input: { evaluationId: number }) {
    const { data, error } = await supabase
      .from("operations")
      .select("*")
      .eq("evaluationId", input.evaluationId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Operation) ?? null;
  },

  async getById(input: { id: number }) {
    const { data, error } = await supabase.from("operations").select("*").eq("id", input.id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Operation) ?? null;
  },

  async update(input: Record<string, any> & { id: number }) {
    const { id, ...data } = input;
    const { error } = await supabase.from("operations").update(data).eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async getMonths() {
    const rows = unwrap(await supabase.from("operations").select("preenchimentoSecOp")) as Array<{
      preenchimentoSecOp: string | null;
    }>;
    const months = new Set<string>();
    (rows ?? []).forEach((op) => {
      if (op.preenchimentoSecOp) months.add(op.preenchimentoSecOp);
    });
    return Array.from(months).sort();
  },

  async getByMonth(input?: { month?: string }) {
    // O militar atribuído vem junto para que o botão de notificação tenha o
    // nome e o telefone. Na versão anterior estes campos não eram carregados e
    // a janela de notificação aparecia sempre com "N/A".
    let query = supabase
      .from("operations")
      .select('*, assigned:profiles!operations_assignedUserId_fkey ( "name", "rank", "phoneNumber" )');

    if (input?.month) query = query.eq("preenchimentoSecOp", input.month);

    const rows = (unwrap(await query) ?? []) as Array<any>;

    return rows.map(({ assigned, ...op }) => ({
      ...op,
      assignedUserName: assigned?.name ?? null,
      assignedUserRank: assigned?.rank ?? null,
      assignedUserPhone: assigned?.phoneNumber ?? null,
    })) as Operation[];
  },

  async deleteMany(input: { ids: number[] }) {
    if (input.ids.length === 0) return { success: true as const };
    const { error } = await supabase.from("operations").delete().in("id", input.ids);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async listMilitares() {
    return unwrap(
      await supabase.from("profiles").select('id, "name", email, "rank", "phoneNumber", "mecanographicNumber"'),
    ) as Array<Pick<Profile, "id" | "name" | "email" | "rank" | "phoneNumber" | "mecanographicNumber">>;
  },

  async assignToMilitar(input: { operationId: number; assignedUserId: string; scheduledDate: string }) {
    const { error } = await supabase
      .from("operations")
      .update({ assignedUserId: input.assignedUserId, scheduledDate: input.scheduledDate })
      .eq("id", input.operationId);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  /**
   * Prepara a mensagem de WhatsApp. Tal como na versão original, nada é enviado
   * automaticamente: é gerada uma ligação wa.me que o utilizador abre.
   */
  async sendNotification(input: {
    operationId: number;
    userId: string;
    phoneNumber: string;
    militarName: string;
    scheduledDate: string;
  }) {
    const message =
      `Olá ${input.militarName},\n\n` +
      `Foi-lhe atribuída uma operação GIOE para a data de ${input.scheduledDate}.\n\n` +
      `Por favor, preencha o relatório da operação no sistema.\n\nObrigado!`;

    const phoneClean = input.phoneNumber.replace(/[^0-9]/g, "");
    const whatsappLink = `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        operationId: input.operationId,
        userId: input.userId,
        phoneNumber: input.phoneNumber,
        message,
        whatsappLink,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ...data, whatsappLink };
  },

  async getNotifications(input: { operationId: number }) {
    return (unwrap(
      await supabase.from("notifications").select("*").eq("operationId", input.operationId),
    ) ?? []) as Array<Record<string, any>>;
  },

  async markNotificationAsSent(input: { notificationId: number }) {
    const { error } = await supabase
      .from("notifications")
      .update({ sent: 1, sentAt: new Date().toISOString() })
      .eq("id", input.notificationId);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async updateOperationStatus(input: {
    operationId: number;
    operacaoPreenchida?: number;
    consumosPreenchidos?: number;
    observacoesPreenchidas?: number;
  }) {
    const patch: Record<string, number> = {};
    if (input.operacaoPreenchida !== undefined) patch.operacaoPreenchida = input.operacaoPreenchida;
    if (input.consumosPreenchidos !== undefined) patch.consumosPreenchidos = input.consumosPreenchidos;
    if (input.observacoesPreenchidas !== undefined) patch.observacoesPreenchidas = input.observacoesPreenchidas;
    if (Object.keys(patch).length === 0) return { success: true as const };

    const { error } = await supabase.from("operations").update(patch).eq("id", input.operationId);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async listMilitarOperations() {
    const { data: sessionData } = await supabase.auth.getUser();
    if (!sessionData.user) return [];

    const rows = unwrap(
      await supabase
        .from("operations")
        .select(
          'id, "operacaoNumero", "dataOp", "scheduledDate", "operacaoPreenchida", "consumosPreenchidos", ' +
            '"observacoesPreenchidas", "flaggedForCompletion", "flaggedAt", "preenchimentoSecOp", "cmdtOp", ' +
            '"efetivTotalOperacao"',
        )
        .eq("assignedUserId", sessionData.user.id),
    );

    return (rows ?? []) as unknown as Operation[];
  },

  /** Sinaliza operações atribuídas que ainda não foram preenchidas. */
  async flagIncompleteOperations() {
    const pendentes = unwrap(
      await supabase
        .from("operations")
        .select("id")
        .not("assignedUserId", "is", null)
        .eq("flaggedForCompletion", 0)
        .or("operacaoPreenchida.eq.0,consumosPreenchidos.eq.0,observacoesPreenchidas.eq.0"),
    ) as Array<{ id: number }>;

    const ids = (pendentes ?? []).map((o) => o.id);
    if (ids.length === 0) return { flagged: 0 };

    const { error } = await supabase
      .from("operations")
      .update({ flaggedForCompletion: 1, flaggedAt: new Date().toISOString() })
      .in("id", ids);
    if (error) throw new Error(error.message);

    return { flagged: ids.length };
  },

  async getFlaggedOperations() {
    return (unwrap(
      await supabase.from("operations").select("*").eq("flaggedForCompletion", 1),
    ) ?? []) as Operation[];
  },

  async getOperationWithAssignedUser(input: { operationId: number }) {
    const { data, error } = await supabase
      .from("operations")
      .select('*, user:profiles!operations_assignedUserId_fkey (*)')
      .eq("id", input.operationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data || !data.assignedUserId) return null;

    const { user, ...operation } = data as any;
    return { operation, user };
  },
};

// ─── suspects ────────────────────────────────────────────────────────────────

export const suspects = {
  async createBatch(input: { evaluationId: number; suspects: Array<Record<string, any>> }) {
    if (input.suspects.length === 0) return [];

    const rows = input.suspects.map((s) => {
      const limpo: Record<string, any> = { evaluationId: input.evaluationId };
      for (const [k, v] of Object.entries(s)) {
        if (v !== undefined && v !== null) limpo[k] = v;
      }
      return limpo;
    });

    return (unwrap(await supabase.from("suspects").insert(rows).select()) ?? []) as Suspect[];
  },

  async getByEvaluationId(input: { evaluationId: number }) {
    return (unwrap(
      await supabase.from("suspects").select("*").eq("evaluationId", input.evaluationId),
    ) ?? []) as Suspect[];
  },

  async update(input: Record<string, any> & { id: number }) {
    const { id, ...data } = input;
    const { error } = await supabase.from("suspects").update(data).eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async delete(input: { id: number }) {
    const { error } = await supabase.from("suspects").delete().eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },

  async deleteByEvaluationId(input: { evaluationId: number }) {
    const { error } = await supabase.from("suspects").delete().eq("evaluationId", input.evaluationId);
    if (error) throw new Error(error.message);
    return { success: true as const };
  },
};

// ─── suspectProfiles ─────────────────────────────────────────────────────────

export const suspectProfiles = {
  async list(input?: { limit?: number; offset?: number }) {
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;

    const todos = (unwrap(
      await supabase.from("suspects").select('*, evaluations ( neop )'),
    ) ?? []) as Array<any>;

    // Agrupar por pessoa (nome + NIF + CC), como na versão original.
    const unicos = new Map<string, any[]>();
    todos.forEach((s) => {
      const chave = `${s.nome}-${s.nif}-${s.cc}`;
      const lista = unicos.get(chave) ?? [];
      lista.push(s);
      unicos.set(chave, lista);
    });

    return Array.from(unicos.values())
      .slice(offset, offset + limit)
      .map((ocorrencias) => {
        const primeiro = ocorrencias[0];
        const neops = ocorrencias.map((o) => o.evaluations?.neop).filter(Boolean);

        return {
          id: primeiro.id,
          nome: primeiro.nome,
          nif: primeiro.nif,
          cc: primeiro.cc,
          nacionalidade: primeiro.nacionalidade,
          totalOperations: ocorrencias.length,
          neop4Count: neops.filter((n: string) => n === "4º NEOP").length,
        };
      });
  },

  async getById(input: { suspectId: number }) {
    const { data, error } = await supabase
      .from("suspects")
      .select("*")
      .eq("id", input.suspectId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const relacionadas = (unwrap(
      await supabase
        .from("evaluations")
        .select('id, pontuacao, neop, "dataAvaliacao", "tipoCriminal"')
        .eq("id", (data as any).evaluationId),
    ) ?? []) as Array<any>;

    const total = relacionadas.length;

    return {
      suspect: data,
      evaluations: relacionadas,
      stats: {
        totalOperations: total,
        averageScore:
          total > 0
            ? Math.round((relacionadas.reduce((s, e) => s + e.pontuacao, 0) / total) * 100) / 100
            : 0,
        neop4Count: relacionadas.filter((e) => e.neop === "4º NEOP").length,
      },
    };
  },
};

// ─── operationAnalysis ───────────────────────────────────────────────────────

export const operationAnalysis = {
  async summary() {
    const all = (unwrap(
      await supabase.from("evaluations").select('neop, pontuacao, "cterRequerente"'),
    ) ?? []) as Array<any>;

    const byNeop: Record<string, number> = {};
    const byCter: Record<string, number> = {};
    let totalScore = 0;

    all.forEach((e) => {
      byNeop[e.neop] = (byNeop[e.neop] || 0) + 1;
      if (e.cterRequerente) byCter[e.cterRequerente] = (byCter[e.cterRequerente] || 0) + 1;
      totalScore += e.pontuacao;
    });

    return {
      totalOperations: all.length,
      averageScore: all.length > 0 ? Math.round((totalScore / all.length) * 100) / 100 : 0,
      byNeop,
      byCter,
      neop4Percentage: all.length > 0 ? Math.round(((byNeop["4º NEOP"] || 0) / all.length) * 100) : 0,
    };
  },

  async filtered(input?: { neop?: string; cterRequerente?: string; limit?: number; offset?: number }) {
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;

    let query = supabase.from("evaluations").select("*");
    if (input?.neop) query = query.eq("neop", input.neop);
    if (input?.cterRequerente) query = query.eq("cterRequerente", input.cterRequerente);

    return (unwrap(await query.range(offset, offset + limit - 1)) ?? []) as Evaluation[];
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
  operationAnalysis,
};
