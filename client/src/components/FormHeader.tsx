/**
 * Cabeçalho comum dos formulários e das folhas de impressão.
 *
 * O logótipo é servido pela própria aplicação (client/public/gioe-logo.webp).
 * Na versão anterior vinha de um CDN da plataforma onde a aplicação estava
 * alojada, o que tornava as folhas impressas dependentes desse serviço.
 */
export function FormHeader({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="text-center mb-8 pb-6 border-b-2" style={{ borderColor: "#1a472a" }}>
      <img
        src={`${import.meta.env.BASE_URL}gioe-logo.webp`}
        alt="Logótipo GIOE"
        className="h-24 mx-auto mb-4"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="text-2xl font-bold" style={{ color: "#1a472a" }}>
        GIOE
      </div>
      <div className="text-sm" style={{ color: "#1a472a" }}>
        Grupo de Intervenção de Operações Especiais
      </div>
      <div className="text-xs mt-2 text-gray-500">{subtitulo}</div>
    </div>
  );
}
