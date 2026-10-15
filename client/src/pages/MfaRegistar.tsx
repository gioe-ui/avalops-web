import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, LogOut, Smartphone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EcraAcesso from "@/components/EcraAcesso";

/**
 * Registo do segundo fator: o militar lê o QR code com uma aplicação
 * autenticadora (Google Authenticator, Microsoft Authenticator, FreeOTP, …) e
 * confirma com o primeiro código. Sem isto não há acesso a dados.
 */
export default function MfaRegistar() {
  const { logout } = useAuth();
  const utils = trpc.useUtils();
  const [codigo, setCodigo] = useState("");
  const [mostrarSegredo, setMostrarSegredo] = useState(false);

  const iniciar = trpc.auth.mfaIniciarRegisto.useMutation({
    onError: (e) => toast.error(`Não foi possível iniciar o registo do segundo fator: ${e.message}`),
  });

  const confirmar = trpc.auth.mfaConfirmarRegisto.useMutation({
    onSuccess: () => {
      toast.success("Segundo fator ativado.");
      void utils.auth.sessao.invalidate();
    },
    onError: (e) => {
      setCodigo("");
      toast.error(e.message);
    },
  });

  useEffect(() => {
    iniciar.mutate(undefined as never);
    // Só ao abrir o ecrã.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submeter = (e: FormEvent) => {
    e.preventDefault();
    if (!iniciar.data) return;
    if (!/^\d{6}$/.test(codigo)) {
      toast.error("O código tem 6 dígitos.");
      return;
    }
    confirmar.mutate({ factorId: iniciar.data.factorId, codigo });
  };

  return (
    <EcraAcesso
      icone={<Smartphone className="w-10 h-10" />}
      titulo="Ativar o segundo fator"
      subtitulo="Obrigatório para aceder ao sistema"
    >
      <ol className="text-sm text-ral-700 space-y-1 mb-5 list-decimal pl-5">
        <li>Abra uma aplicação autenticadora no telemóvel.</li>
        <li>Leia o código QR abaixo (ou introduza a chave manualmente).</li>
        <li>Escreva o código de 6 dígitos que a aplicação mostra.</li>
      </ol>

      {iniciar.isPending || !iniciar.data ? (
        <div className="flex flex-col items-center gap-3 py-8 text-ral-500">
          {iniciar.isError ? (
            <Button variant="outline" onClick={() => iniciar.mutate(undefined as never)}>
              Tentar de novo
            </Button>
          ) : (
            <Loader2 className="w-8 h-8 animate-spin" />
          )}
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-4">
            <img
              src={iniciar.data.qrCode}
              alt="Código QR para a aplicação autenticadora"
              className="w-48 h-48 border border-ral-200 rounded-lg bg-white p-2"
            />
          </div>

          <div className="mb-5 text-center">
            {mostrarSegredo ? (
              <code className="block break-all text-xs bg-ral-50 border border-ral-200 rounded p-2 select-all">
                {iniciar.data.segredo}
              </code>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarSegredo(true)}
                className="text-xs text-ral-600 underline underline-offset-2"
              >
                Não consigo ler o código — mostrar a chave
              </button>
            )}
          </div>

          <form onSubmit={submeter} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mfa-codigo" className="text-ral-700 font-semibold">
                Código de 6 dígitos
              </Label>
              <Input
                id="mfa-codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl font-mono tracking-[0.5em] h-12"
              />
            </div>
            <Button type="submit" className="w-full h-10" disabled={confirmar.isPending || codigo.length !== 6}>
              <KeyRound className="w-4 h-4" />
              {confirmar.isPending ? "A confirmar..." : "Confirmar e ativar"}
            </Button>
          </form>
        </>
      )}

      <Button variant="ghost" className="w-full mt-3 text-ral-600" onClick={() => void logout()}>
        <LogOut className="w-4 h-4" />
        Sair
      </Button>
    </EcraAcesso>
  );
}
