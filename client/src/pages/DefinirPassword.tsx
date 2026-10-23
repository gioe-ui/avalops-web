import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MINIMA } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EcraAcesso from "@/components/EcraAcesso";

/**
 * Depois de abrir a ligação de recuperação, a única coisa possível é definir
 * a nova password. Antes, a ligação entrava diretamente na aplicação e a
 * password antiga continuava válida.
 */
export default function DefinirPassword() {
  const { logout, user } = useAuth();
  const utils = trpc.useUtils();
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");

  const definir = trpc.auth.definirNovaPassword.useMutation({
    onSuccess: () => {
      toast.success("Password alterada.");
      void utils.auth.sessao.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const submeter = (e: FormEvent) => {
    e.preventDefault();
    if (nova.length < PASSWORD_MINIMA) {
      toast.error(`A password tem de ter pelo menos ${PASSWORD_MINIMA} caracteres.`);
      return;
    }
    if (nova !== confirmacao) {
      toast.error("As passwords não coincidem.");
      return;
    }
    definir.mutate(nova);
  };

  return (
    <EcraAcesso icone={<KeyRound className="w-10 h-10" />} titulo="Definir nova password" subtitulo={user?.email}>
      <form onSubmit={submeter} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nova-password" className="text-ral-700 font-semibold">
            Nova password
          </Label>
          <Input
            id="nova-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={nova}
            onChange={(e) => setNova(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Mínimo {PASSWORD_MINIMA} caracteres.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nova-password-2" className="text-ral-700 font-semibold">
            Confirmar nova password
          </Label>
          <Input
            id="nova-password-2"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full h-10" disabled={definir.isPending}>
          {definir.isPending ? "A gravar..." : "Gravar nova password"}
        </Button>
      </form>

      <Button variant="ghost" className="w-full mt-3 text-ral-600" onClick={() => void logout()}>
        <LogOut className="w-4 h-4" />
        Cancelar e sair
      </Button>
    </EcraAcesso>
  );
}
