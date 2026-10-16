import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  aposTerminarSessao,
  marcarAtividade,
  registarMotivoSaida,
  supabase,
  tempoAteInatividade,
  temSessaoGuardada,
  terminarSessaoLocal,
} from "@/lib/supabase";

const EVENTOS_ATIVIDADE = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove", "scroll"] as const;
const AVISO_ANTES_MS = 60_000;

/**
 * Vigia a sessão, uma única vez para toda a aplicação:
 *
 * - termina a sessão ao fim de 30 minutos sem interação (em qualquer separador:
 *   a última atividade é partilhada através do localStorage), com aviso um
 *   minuto antes;
 * - quando a sessão termina — aqui, noutro separador, ou revogada pelo
 *   servidor — esconde logo os dados e recarrega a aplicação, para que nada do
 *   que estava no ecrã ou em memória fique para quem usar o computador a seguir;
 * - quando a sessão muda (entrada, segundo fator, nova password), volta a ler
 *   o estado.
 */
export default function VigilanciaSessao() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      // Fora da chamada de retorno: o supabase-js não deve ser chamado de
      // dentro dela enquanto processa o evento.
      setTimeout(() => {
        if (evento === "SIGNED_OUT") {
          // Esconde já os dados (o portão passa a mostrar a entrada) e depois
          // recarrega, que é o que garante que não fica nada em memória.
          queryClient.setQueryData(["auth", "sessao"], null);
          queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
          aposTerminarSessao();
          return;
        }
        if (evento !== "TOKEN_REFRESHED") {
          void queryClient.invalidateQueries({ queryKey: ["auth", "sessao"] });
        }
      }, 0);
    });

    let ultimaEscrita = 0;
    const atividade = () => {
      const agora = Date.now();
      if (agora - ultimaEscrita > 15_000 && temSessaoGuardada()) {
        ultimaEscrita = agora;
        marcarAtividade();
      }
    };
    EVENTOS_ATIVIDADE.forEach((e) => window.addEventListener(e, atividade, { passive: true }));

    let avisado = false;
    const verificar = async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;

      const restante = tempoAteInatividade(s.session.access_token);
      if (restante === null) {
        marcarAtividade(s.session.access_token);
        return;
      }

      if (restante <= 0) {
        // O aviso aparece no ecrã de entrada, depois de a aplicação recarregar.
        registarMotivoSaida("inatividade");
        await terminarSessaoLocal();
      } else if (restante < AVISO_ANTES_MS) {
        if (!avisado) {
          avisado = true;
          toast.warning("A sessão vai terminar dentro de 1 minuto por inatividade.");
        }
      } else {
        avisado = false;
      }
    };
    const intervalo = window.setInterval(() => void verificar(), 15_000);

    return () => {
      data.subscription.unsubscribe();
      EVENTOS_ATIVIDADE.forEach((e) => window.removeEventListener(e, atividade));
      window.clearInterval(intervalo);
    };
  }, [queryClient]);

  return null;
}
