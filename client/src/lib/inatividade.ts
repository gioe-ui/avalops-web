/**
 * Regras de inatividade, sem acesso a armazenamento (testáveis à parte).
 *
 * A última atividade é guardada como "<session_id>|<hora em ms>". Ligar a hora
 * à sessão distingue uma sessão nova (por exemplo, criada agora por uma ligação
 * de confirmação de email) de uma sessão antiga esquecida no browser — mesmo que
 * alguém abra um endereço com um código forjado, que não muda a sessão guardada,
 * ou que o token seja renovado, que mantém o mesmo session_id.
 */

/** Lê um campo do token de acesso (sem o validar: só serve para decisões locais). */
export function campoDoToken(accessToken: string | undefined, campo: string): unknown {
  try {
    const parte = accessToken?.split(".")[1];
    if (!parte) return undefined;
    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "=");
    return JSON.parse(atob(base64))[campo];
  } catch {
    return undefined;
  }
}

export const idDaSessao = (accessToken: string | undefined) => String(campoDoToken(accessToken, "session_id") ?? "");

export const registoDeAtividade = (accessToken: string, agora: number) => `${idDaSessao(accessToken)}|${agora}`;

/**
 * Milissegundos até a sessão ser considerada inativa, ou null se não houver
 * referência: nenhuma atividade registada, ou registada noutra sessão (ou seja,
 * a sessão atual é nova).
 */
export function tempoAteInatividade(
  accessToken: string | undefined,
  registo: string | null,
  agora: number,
  limiteMs: number,
): number | null {
  const [id, hora] = (registo ?? "").split("|");
  const ultima = Number(hora);
  if (!ultima) return null;
  const atual = idDaSessao(accessToken);
  if (id && atual && id !== atual) return null;
  return limiteMs - (agora - ultima);
}
