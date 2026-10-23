import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LogOut, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EcraAcesso from "@/components/EcraAcesso";

/** Segundo passo da entrada: o código da aplicação autenticadora. */
export default function MfaVerificar() {
  const { logout, fatorId, user } = useAuth();
  const utils = trpc.useUtils();
  const [codigo, setCodigo] = useState("");

  const verificar = trpc.auth.mfaVerificar.useMutation({
    onSuccess: () => void utils.auth.sessao.invalidate(),
    onError: (e) => {
      setCodigo("");
      toast.error(e.message);
    },
  });

  const submeter = (e: FormEvent) => {
    e.preventDefault();
    if (!fatorId || !/^\d{6}$/.test(codigo)) {
      toast.error("O código tem 6 dígitos.");
      return;
    }
    verificar.mutate({ factorId: fatorId, codigo });
  };

  return (
    <EcraAcesso
      icone={<ShieldCheck className="w-10 h-10" />}
      titulo="Verificação em dois passos"
      subtitulo={user?.email}
    >
      <form onSubmit={submeter} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="mfa-verificar" className="text-ral-700 font-semibold">
            Código da aplicação autenticadora
          </Label>
          <Input
            id="mfa-verificar"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-2xl font-mono tracking-[0.5em] h-12"
          />
        </div>
        <Button type="submit" className="w-full h-10" disabled={verificar.isPending || codigo.length !== 6}>
          {verificar.isPending ? "A verificar..." : "Verificar"}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Perdeu o acesso à aplicação autenticadora? Um administrador tem de remover o segundo fator da
        sua conta no painel do Supabase.
      </p>

      <Button variant="ghost" className="w-full mt-3 text-ral-600" onClick={() => void logout()}>
        <LogOut className="w-4 h-4" />
        Sair
      </Button>
    </EcraAcesso>
  );
}
