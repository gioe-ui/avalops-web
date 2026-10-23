import { Button } from "@/components/ui/button";
import { Compass, Home } from "lucide-react";
import { useLocation } from "wouter";
import EcraAcesso from "@/components/EcraAcesso";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <EcraAcesso icone={<Compass className="w-12 h-12" />} titulo="Página não encontrada" subtitulo="Erro 404">
      <p className="text-sm text-ral-700 text-center mb-6">
        A página que procura não existe. Pode ter sido movida ou o endereço estar incorreto.
      </p>
      <Button className="w-full" onClick={() => setLocation("/")}>
        <Home className="w-4 h-4" />
        Voltar ao início
      </Button>
    </EcraAcesso>
  );
}
