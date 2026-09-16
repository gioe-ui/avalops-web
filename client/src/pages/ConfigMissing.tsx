import { AlertTriangle } from "lucide-react";

/**
 * Mostrada quando o site foi publicado sem as variáveis do Supabase.
 * É um erro de configuração do deploy, não do código — daí a instrução concreta.
 */
export default function ConfigMissing() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
        <AlertTriangle className="w-12 h-12 mb-4" style={{ color: "#b8860b" }} />

        <h1 className="text-xl font-bold mb-3" style={{ color: "#1a472a" }}>
          Aplicação sem ligação à base de dados
        </h1>

        <p className="text-sm text-gray-700 mb-4">
          Faltam as variáveis <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_URL</code> e{" "}
          <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>. Sem elas não há
          autenticação nem dados.
        </p>

        <p className="text-sm text-gray-700 mb-2">Onde as definir:</p>
        <p className="text-sm text-gray-700 mb-4">
          No GitHub, em Settings → Secrets and variables → Actions → Variables, e voltar a correr o
          workflow de deploy. Em desenvolvimento local, no ficheiro{" "}
          <code className="bg-gray-100 px-1 rounded">client/.env.local</code>.
        </p>

        <p className="text-xs text-gray-500">
          Os valores estão no painel do Supabase, em Project Settings → API.
        </p>
      </div>
    </div>
  );
}
