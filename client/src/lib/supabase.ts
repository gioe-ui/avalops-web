import { createClient } from "@supabase/supabase-js";
import { traduzirErro } from "./erros";
import { registoDeAtividade, tempoAteInatividade as calcularTempoAteInatividade } from "./inatividade";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Sem estas variáveis a aplicação não tem base de dados nenhuma. Em vez de
 * rebentar durante o arranque e deixar um ecrã branco, sinaliza-se a falta de
 * configuração e a aplicação mostra uma página a explicar o que falta.
 */
export const configuracaoEmFalta = !url || !anonKey;

const STORAGE_KEY = "gioe-auth";
const CHAVE_RECUPERACAO = "gioe-recuperacao";
const CHAVE_MOTIVO_SAIDA = "gioe-motivo-saida";
export const CHAVE_ATIVIDADE = "gioe-ultima-atividade";

/** Sessão termina ao fim de 30 minutos sem interação. */
export const LIMITE_INATIVIDADE_MS = 30 * 60 * 1000;

// ─── Armazenamento local, tolerante a falhas ─────────────────────────────────
// Numa janela privada ou com o armazenamento bloqueado, estas chamadas podem
// lançar exceções; a aplicação tem de continuar a funcionar na mesma.
export function lerLocal(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarLocal(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: nada a fazer
  }
}

/**
 * A chave anónima é pública por natureza — vai no bundle e qualquer pessoa a
 * consegue ler. Quem protege os dados é o Row Level Security definido em
 * supabase/02_policies.sql e 05_seguranca.sql, não o segredo desta chave.
 *
 * flowType "pkce": as ligações de email (confirmação, recuperação de password)
 * trazem um código de uso único, trocado por uma sessão apenas no browser que
 * fez o pedido, em vez de tokens de acesso no endereço. Consequência prática:
 * a ligação de recuperação tem de ser aberta no mesmo browser onde foi pedida.
 */
export const supabase = createClient(url ?? "https://exemplo.supabase.co", anonKey ?? "sem-chave", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: STORAGE_KEY,
    flowType: "pkce",
  },
});

// ─── Recuperação de password ─────────────────────────────────────────────────
// A ligação de recuperação inicia uma sessão. Sem este controlo, quem a abrisse
// entrava diretamente na aplicação sem nunca definir a nova password. O sinal
// fica em localStorage para valer também noutros separadores, e só desaparece
// quando a nova password é gravada ou a sessão termina.
//
// A subscrição é feita aqui, ao carregar o módulo, para não perder o evento:
// o supabase-js emite-o durante a inicialização, antes de qualquer componente
// estar montado.
supabase.auth.onAuthStateChange((evento) => {
  if (evento === "PASSWORD_RECOVERY") {
    gravarLocal(CHAVE_RECUPERACAO, "1");
  } else if (evento === "SIGNED_OUT") {
    gravarLocal(CHAVE_RECUPERACAO, null);
  }
});

export const recuperacaoPendente = () => lerLocal(CHAVE_RECUPERACAO) === "1";
export const concluirRecuperacao = () => gravarLocal(CHAVE_RECUPERACAO, null);

// ─── Motivo da última saída (para avisar no ecrã de entrada) ─────────────────
export function registarMotivoSaida(motivo: "inatividade") {
  try {
    sessionStorage.setItem(CHAVE_MOTIVO_SAIDA, motivo);
  } catch {
    // sem armazenamento: o aviso simplesmente não aparece
  }
}

export function lerMotivoSaida(): string | null {
  try {
    const motivo = sessionStorage.getItem(CHAVE_MOTIVO_SAIDA);
    sessionStorage.removeItem(CHAVE_MOTIVO_SAIDA);
    return motivo;
  } catch {
    return null;
  }
}

// ─── Inatividade ─────────────────────────────────────────────────────────────
// A última atividade fica ligada ao identificador da sessão: as regras estão em
// lib/inatividade.ts.

/** Token de acesso guardado pelo supabase-js, lido de forma síncrona. */
function tokenGuardado(): string | undefined {
  try {
    const valor = lerLocal(STORAGE_KEY);
    return valor ? (JSON.parse(valor).access_token as string | undefined) : undefined;
  } catch {
    return undefined;
  }
}

/** Há uma sessão guardada neste browser (sem a validar junto do servidor). */
export const temSessaoGuardada = () => lerLocal(STORAGE_KEY) !== null;

/** Regista atividade agora, na sessão guardada. Sem sessão não há nada a registar. */
export function marcarAtividade(accessToken = tokenGuardado()) {
  if (!accessToken) return;
  gravarLocal(CHAVE_ATIVIDADE, registoDeAtividade(accessToken, Date.now()));
}

/** Milissegundos até a sessão ser considerada inativa (ver lib/inatividade.ts). */
export const tempoAteInatividade = (accessToken: string | undefined) =>
  calcularTempoAteInatividade(accessToken, lerLocal(CHAVE_ATIVIDADE), Date.now(), LIMITE_INATIVIDADE_MS);

export function sessaoInativaHaDemasiado(accessToken: string | undefined) {
  const restante = tempoAteInatividade(accessToken);
  return restante !== null && restante <= 0;
}

/**
 * Depois de a sessão terminar (botão Sair, inatividade, noutro separador, ou
 * sessão revogada): limpa as marcas locais e recarrega a aplicação.
 *
 * Recarregar é deliberado. Esvaziar a cache do React Query não chega: os
 * componentes montados continuam a mostrar os dados que já tinham, e com eles
 * ainda se podia exportar ou imprimir. Um carregamento novo não deixa nada em
 * memória.
 */
export function aposTerminarSessao() {
  gravarLocal(CHAVE_RECUPERACAO, null);
  gravarLocal(CHAVE_ATIVIDADE, null);
  try {
    sessionStorage.removeItem("gioe-entrada-registada");
  } catch {
    // sem armazenamento
  }
  window.location.replace(import.meta.env.BASE_URL);
}

/**
 * Termina apenas a sessão deste browser (não as de outros dispositivos).
 *
 * Se o pedido ao servidor falhar (sem rede), o supabase-js mantém a sessão
 * guardada; aqui ela é apagada na mesma, para que "Sair" saia sempre.
 */
export async function terminarSessaoLocal() {
  gravarLocal(CHAVE_RECUPERACAO, null);
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    gravarLocal(STORAGE_KEY, null);
    gravarLocal(`${STORAGE_KEY}-code-verifier`, null);
    aposTerminarSessao();
  }
}

/**
 * Ao abrir a aplicação: se a última interação foi há mais de 30 minutos, a
 * sessão guardada é terminada antes de qualquer pedido de dados. Quem fechou o
 * separador sem sair não deixa a sessão aberta para o próximo que use o
 * computador.
 *
 * Todas as consultas esperam por esta promessa (ver api.auth.sessao).
 */
export const inicializacao: Promise<void> = (async () => {
  if (configuracaoEmFalta) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    if (sessaoInativaHaDemasiado(data.session.access_token)) {
      registarMotivoSaida("inatividade");
      await terminarSessaoLocal();
    } else {
      marcarAtividade(data.session.access_token);
    }
  } catch {
    // Falha de rede ao arrancar: as consultas seguintes tratam o erro.
  }
})();

// ─── Erros ───────────────────────────────────────────────────────────────────

export { traduzirErro };

/** Levanta o erro do Supabase como exceção, para o TanStack Query o apanhar. */
export function unwrap<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) throw traduzirErro(result.error);
  return result.data;
}
