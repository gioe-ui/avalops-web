import { AlertTriangle } from "lucide-react";
import EcraAcesso from "@/components/EcraAcesso";

/**
 * Mostrada quando o site foi publicado sem as variáveis do Supabase.
 * É um erro de configuração do deploy, não do código — daí a instrução concreta.
 */
export default function ConfigMissing() {
  const codigo = "bg-ral-100 px-1 rounded font-mono text-xs";
  return (
    <EcraAcesso
      icone={<AlertTriangle className="w-12 h-12 text-aviso" />}
      titulo="Aplicação sem ligação à base de dados"
      largura="max-w-lg"
    >
      <div className="space-y-3 text-sm text-ral-800">
        <p>
          Faltam as variáveis <code className={codigo}>VITE_SUPABASE_URL</code> e{" "}
          <code className={codigo}>VITE_SUPABASE_ANON_KEY</code>. Sem elas não há autenticação nem dados.
        </p>
        <p>
          No GitHub, definem-se em Settings → Secrets and variables → Actions → Variables; depois volta a
          correr-se o workflow de deploy. Em desenvolvimento local, no ficheiro{" "}
          <code className={codigo}>client/.env.local</code>.
        </p>
        <p className="text-xs text-ral-500">Os valores estão no painel do Supabase, em Project Settings → API.</p>
      </div>
    </EcraAcesso>
  );
}
