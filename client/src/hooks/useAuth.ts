/**
 * Estado de autenticação.
 *
 * Mantém a interface do hook original (user, loading, error, isAuthenticated,
 * refresh, logout) e acrescenta o estado do segundo fator. Os eventos do
 * Supabase Auth são tratados uma única vez, em components/VigilanciaSessao.
 */
import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { api } from "@/lib/api";

export function useAuth() {
  const queryClient = useQueryClient();

  const sessaoQuery = trpc.auth.sessao.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      // Nada do que estava em cache pode ficar para quem usar o computador a
      // seguir.
      queryClient.clear();
      try {
        sessionStorage.removeItem("gioe-entrada-registada");
      } catch {
        // sem armazenamento
      }
    }
  }, [queryClient]);

  const state = useMemo(() => {
    const estado = sessaoQuery.data ?? null;
    const user = estado?.perfil ?? null;
    const mfaOk = estado?.nivel === "aal2";
    const ativo = user?.active === 1;
    const aprovado = user?.approved === 1;

    return {
      user,
      loading: sessaoQuery.isLoading,
      error: sessaoQuery.error ?? null,
      isAuthenticated: Boolean(user),
      /** Ainda não registou uma aplicação autenticadora. */
      precisaRegistarMfa: Boolean(user) && !estado?.fatorId,
      /** Tem segundo fator registado mas a sessão ainda só passou a password. */
      precisaVerificarMfa: Boolean(user) && Boolean(estado?.fatorId) && !mfaOk,
      fatorId: estado?.fatorId ?? null,
      mfaOk,
      ativo,
      /** Pode usar a aplicação: aprovado, ativo e com o segundo fator. */
      isApproved: mfaOk && aprovado && ativo,
      isAdmin: mfaOk && aprovado && ativo && user?.role === "admin",
    };
  }, [sessaoQuery.data, sessaoQuery.error, sessaoQuery.isLoading]);

  return {
    ...state,
    refresh: () => sessaoQuery.refetch(),
    logout,
  };
}
