import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Sem estas variáveis a aplicação não tem base de dados nenhuma. Em vez de
 * rebentar durante o arranque e deixar um ecrã branco, sinaliza-se a falta de
 * configuração e a aplicação mostra uma página a explicar o que falta.
 */
export const configuracaoEmFalta = !url || !anonKey;

/**
 * A chave anónima é pública por natureza — vai no bundle e qualquer pessoa a
 * consegue ler. Quem protege os dados é o Row Level Security definido em
 * supabase/02_policies.sql, não o segredo desta chave.
 */
export const supabase = createClient(url ?? "https://exemplo.supabase.co", anonKey ?? "sem-chave", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "gioe-auth",
  },
});

/** Levanta o erro do Supabase como exceção, para o TanStack Query o apanhar. */
export function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
