/**
 * Estado de autenticação.
 *
 * Mantém a mesma interface do hook original (user, loading, error,
 * isAuthenticated, refresh, logout) para as páginas não mudarem, mas por baixo
 * usa o Supabase Auth em vez do portal OAuth da plataforma anterior.
 */
import { useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";

type UseAuthOptions = {
  /** Redireciona para a página de entrada quando não há sessão. */
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/" } = options ?? {};
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // O Supabase renova e expira sessões por sua conta; quando isso acontece,
  // o perfil em cache deixa de estar correto.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        utils.auth.me.setData(undefined, null);
      }
      void utils.auth.me.invalidate();
    });

    return () => data.subscription.unsubscribe();
    // utils é reconstruído a cada render; as suas funções são estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync(undefined as never);
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      /** Registado mas ainda à espera de aprovação de um administrador. */
      isApproved: meQuery.data?.approved === 1,
      isAdmin: meQuery.data?.role === "admin" && meQuery.data?.approved === 1,
    }),
    [
      meQuery.data,
      meQuery.error,
      meQuery.isLoading,
      logoutMutation.error,
      logoutMutation.isPending,
    ],
  );

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.loading) return;
    if (state.user) return;
    if (location === redirectPath) return;

    navigate(redirectPath);
  }, [redirectOnUnauthenticated, redirectPath, state.loading, state.user, location, navigate]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
