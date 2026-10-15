import { createClient } from "@supabase/supabase-js";
import { traduzirErro } from "./erros";

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
    gravarLocal(CHAVE_ATIVIDADE, String(Date.now()));
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

export const marcarAtividade = () => gravarLocal(CHAVE_ATIVIDADE, String(Date.now()));

export function sessaoInativaHaDemasiado() {
  const ultima = Number(lerLocal(CHAVE_ATIVIDADE) ?? 0);
  return ultima > 0 && Date.now() - ultima > LIMITE_INATIVIDADE_MS;
}

/** Termina apenas a sessão deste browser (não as de outros dispositivos). */
export async function terminarSessaoLocal() {
  gravarLocal(CHAVE_RECUPERACAO, null);
  await supabase.auth.signOut({ scope: "local" });
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

    if (sessaoInativaHaDemasiado()) {
      registarMotivoSaida("inatividade");
      await terminarSessaoLocal();
    } else if (!lerLocal(CHAVE_ATIVIDADE)) {
      marcarAtividade();
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
