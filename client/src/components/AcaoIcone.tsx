import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Botão de ação só com ícone, com o mesmo aspeto em toda a aplicação. Tem
 * sempre um nome acessível (leitores de ecrã) e uma dica ao passar o rato.
 * Só a variante "perigo" (eliminar) usa cor.
 */
export function AcaoIcone({
  rotulo,
  onClick,
  children,
  variante = "normal",
  disabled,
}: {
  rotulo: string;
  onClick: () => void;
  children: ReactNode;
  variante?: "normal" | "perigo" | "destaque";
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:h-4 [&_svg]:w-4",
            variante === "normal" && "border-ral-200 bg-white text-ral-700 hover:bg-ral-100 hover:border-ral-300",
            variante === "destaque" && "border-latao-300 bg-latao-100 text-latao-700 hover:bg-latao-300/40",
            variante === "perigo" && "border-erro/30 bg-white text-erro hover:bg-erro-claro",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{rotulo}</TooltipContent>
    </Tooltip>
  );
}
