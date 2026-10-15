import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CHAVE_ATIVIDADE,
  LIMITE_INATIVIDADE_MS,
  lerLocal,
  marcarAtividade,
  registarMotivoSaida,
  supabase,
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
 * - ao sair, limpa tudo o que estava em cache, para que os dados não fiquem
 *   em memória para quem usar o computador a seguir;
 * - quando a sessão muda (entrada, segundo fator, saída), volta a ler o estado.
 */
export default function VigilanciaSessao() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      // Fora da chamada de retorno: o supabase-js não deve ser chamado de
      // dentro dela enquanto processa o evento.
      setTimeout(() => {
        if (evento === "SIGNED_OUT") queryClient.clear();
        if (evento !== "TOKEN_REFRESHED") {
          void queryClient.invalidateQueries({ queryKey: ["auth", "sessao"] });
        }
      }, 0);
    });

    let ultimaEscrita = 0;
    const atividade = () => {
      const agora = Date.now();
      if (agora - ultimaEscrita > 15_000) {
        ultimaEscrita = agora;
        marcarAtividade();
      }
    };
    EVENTOS_ATIVIDADE.forEach((e) => window.addEventListener(e, atividade, { passive: true }));

    let avisado = false;
    const verificar = async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;

      const ultima = Number(lerLocal(CHAVE_ATIVIDADE) ?? 0);
      if (!ultima) {
        marcarAtividade();
        return;
      }

      const inativo = Date.now() - ultima;
      if (inativo > LIMITE_INATIVIDADE_MS) {
        registarMotivoSaida("inatividade");
        await terminarSessaoLocal();
        queryClient.clear();
        toast.info("Sessão terminada por inatividade.");
      } else if (inativo > LIMITE_INATIVIDADE_MS - AVISO_ANTES_MS) {
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
