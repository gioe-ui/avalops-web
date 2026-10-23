import { Logotipo } from "@/components/EcraAcesso";
import { MarcaClassificacao } from "@/components/Classificacao";

/**
 * Cabeçalho comum dos formulários e das folhas de impressão.
 *
 * O logótipo é servido pela própria aplicação (client/public/gioe-logo.webp).
 * Na versão anterior vinha de um CDN da plataforma onde a aplicação estava
 * alojada, o que tornava as folhas impressas dependentes desse serviço.
 */
export function FormHeader({ subtitulo }: { subtitulo: string }) {
  return (
    <header className="text-center mb-8 pb-6 border-b-2 border-ral-600">
      <MarcaClassificacao className="mb-4" />
      <Logotipo className="h-24 mx-auto mb-4" />
      <div className="text-2xl font-bold tracking-[0.2em] text-ral-800">GIOE</div>
      <div className="text-sm text-ral-700">Grupo de Intervenção de Operações Especiais</div>
      <div className="text-xs mt-2 text-ral-500">{subtitulo}</div>
    </header>
  );
}
