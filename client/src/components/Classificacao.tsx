import { useEffect } from "react";
import { api } from "@/lib/api";
import { formatarDataHora } from "@/lib/datas";
import type { Profile } from "@/lib/api";

/** Classificação de segurança dos documentos produzidos pela aplicação. */
export const CLASSIFICACAO = "RESERVADO";

/** Marca visível no ecrã (pré-visualização de impressão, formulários). */
export function MarcaClassificacao({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <span className="marca-classificacao">{CLASSIFICACAO}</span>
    </div>
  );
}

const quem = (u: Pick<Profile, "name" | "rank" | "email"> | null | undefined) =>
  u ? [u.rank, u.name].filter(Boolean).join(" ") || u.email : "utilizador desconhecido";

/**
 * Marcas que só aparecem no papel: RESERVADO no topo e no rodapé de cada
 * página, e no rodapé quem imprimiu e quando. Regista também a impressão no
 * registo de auditoria.
 */
export function MarcasImpressao({
  utilizador,
  recurso,
  id,
}: {
  utilizador: Pick<Profile, "name" | "rank" | "email"> | null | undefined;
  recurso: string;
  id?: number | string;
}) {
  useEffect(() => {
    const aoImprimir = () => {
      void api.audit.registar({ acao: "PRINT", detalhe: { recurso, id: id != null ? String(id) : undefined } });
    };
    window.addEventListener("beforeprint", aoImprimir);
    return () => window.removeEventListener("beforeprint", aoImprimir);
  }, [recurso, id]);

  const agora = formatarDataHora(new Date());

  return (
    <>
      <div className="marca-impressao topo" aria-hidden="true">
        <MarcaClassificacao />
      </div>
      <div className="marca-impressao rodape text-[9px] text-center" aria-hidden="true">
        <MarcaClassificacao />
        <p className="mt-1 text-black">
          Impresso por {quem(utilizador)} em {agora}
        </p>
      </div>
    </>
  );
}
