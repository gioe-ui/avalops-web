import type { ReactNode } from "react";

/**
 * Moldura comum dos ecrãs fora da aplicação: entrada, registo, segundo fator,
 * recuperação de password, conta por aprovar ou desativada.
 *
 * O logótipo é servido pela própria aplicação (client/public/gioe-logo.webp).
 */
export const LOGO_URL = `${import.meta.env.BASE_URL}gioe-logo.webp`;

export function Logotipo({ className = "" }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt="Logótipo GNR/GIOE"
      className={`object-contain ${className}`}
      onError={(e) => {
        // Sem ficheiro de logótipo, o espaço fica apenas vazio.
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

export default function EcraAcesso({
  titulo,
  subtitulo,
  icone,
  children,
  largura = "max-w-md",
}: {
  titulo?: string;
  subtitulo?: ReactNode;
  icone?: ReactNode;
  children: ReactNode;
  largura?: string;
}) {
  return (
    <div className="bg-gioe min-h-dvh flex items-center justify-center p-4 sm:p-6">
      <main className={`w-full ${largura}`}>
        <div className="text-center text-white mb-6">
          <Logotipo className="w-24 h-24 mx-auto mb-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]" />
          <p className="text-2xl font-bold tracking-[0.3em]">GIOE</p>
          <p className="text-sm text-ral-100/90">Grupo de Intervenção de Operações Especiais</p>
        </div>

        <div className="bg-card text-card-foreground rounded-xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
          <div className="h-1 bg-latao-500" aria-hidden="true" />
          <div className="p-6 sm:p-8">
            {(titulo || icone) && (
              <div className="text-center mb-6">
                {icone ? <div className="flex justify-center mb-3 text-ral-700">{icone}</div> : null}
                {titulo ? <h1 className="text-xl font-bold text-ral-800">{titulo}</h1> : null}
                {subtitulo ? <div className="text-sm text-muted-foreground mt-2">{subtitulo}</div> : null}
              </div>
            )}
            {children}
          </div>
        </div>

        <p className="text-center text-xs text-ral-200/80 mt-6">
          Sistema de Avaliação de Pedidos de Apoio · Acesso restrito
        </p>
      </main>
    </div>
  );
}
