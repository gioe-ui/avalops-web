type ErroSupabase = { message: string; code?: string; details?: string | null; hint?: string | null };

/**
 * Traduz os erros da API e da base de dados para mensagens em português que
 * digam ao militar o que aconteceu, sem expor detalhes internos.
 */
export function traduzirErro(erro: ErroSupabase | Error | null | undefined, contexto?: string): Error {
  if (!erro) return new Error("Erro desconhecido.");
  const codigo = (erro as ErroSupabase).code;
  const mensagem = erro.message ?? "";

  if (codigo === "42501" || /row-level security|permission denied/i.test(mensagem)) {
    return new Error("Sem permissão para esta operação.");
  }
  if (codigo === "PGRST116") return new Error("Registo inexistente ou sem permissão para o alterar.");
  if (codigo === "23505") return new Error(contexto ?? "Já existe um registo igual.");
  if (codigo === "23503") {
    return new Error("O registo está ligado a outros dados e não pode ser eliminado.");
  }
  if (codigo === "23514" || codigo === "22P02") return new Error("Há um valor inválido no formulário.");
  if (codigo === "22001") return new Error("Um dos campos tem texto demasiado longo.");
  if (/Failed to fetch|NetworkError|Load failed/i.test(mensagem)) {
    return new Error("Sem ligação ao servidor. Verifique a rede e tente de novo.");
  }
  // P0001: mensagens escritas por nós nos triggers, já em português.
  return new Error(mensagem || "Erro desconhecido.");
}
