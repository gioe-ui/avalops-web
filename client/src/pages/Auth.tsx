import { useEffect, useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MINIMA } from "@/lib/api";
import { lerMotivoSaida } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, UserPlus, Info } from "lucide-react";
import EcraAcesso from "@/components/EcraAcesso";

export const POSTOS = [
  "Guarda",
  "Guarda-Principal",
  "Cabo",
  "Cabo-Chefe",
  "Cabo-Mor",
  "2º Sargento",
  "1º Sargento",
  "Sargento-Ajudante",
  "Sargento-Chefe",
  "Alferes",
  "Tenente",
  "Capitão",
  "Major",
  "Tenente Coronel",
];

type AuthMode = "login" | "register";

const emailInstitucional = (email: string) => /^[^@\s]+@gnr\.pt$/i.test(email.trim());

function Campo({
  id,
  label,
  children,
  ajuda,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  ajuda?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-ral-700 font-semibold">
        {label}
      </Label>
      {children}
      {ajuda ? <p className="text-xs text-muted-foreground">{ajuda}</p> : null}
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mecanographicNumber, setMecanographicNumber] = useState("");
  const [rank, setRank] = useState("");
  const utils = trpc.useUtils();

  useEffect(() => {
    if (lerMotivoSaida() === "inatividade") {
      toast.info("A sessão foi terminada por inatividade. Entre novamente.");
    }
  }, []);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      // Com a confirmação de email ligada no Supabase (recomendado), não há
      // sessão imediata: o militar tem de confirmar o endereço primeiro.
      if (!data.sessao) {
        toast.success("Conta criada. Confirme o email antes de entrar.");
        setMode("login");
      } else {
        toast.success("Conta criada.");
        void utils.auth.sessao.invalidate();
      }
      setName("");
      setPassword("");
      setConfirmPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setPassword("");
      void utils.auth.sessao.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () =>
      toast.success(
        "Se o email estiver registado, receberá as instruções. Abra a ligação neste mesmo browser.",
      ),
    onError: (e) => toast.error(e.message),
  });

  const handleRegister = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !name || !password || !confirmPassword || !phoneNumber || !mecanographicNumber || !rank) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (!emailInstitucional(email)) {
      toast.error("O email tem de terminar em @gnr.pt");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As passwords não coincidem.");
      return;
    }
    if (password.length < PASSWORD_MINIMA) {
      toast.error(`A password tem de ter pelo menos ${PASSWORD_MINIMA} caracteres.`);
      return;
    }
    if (!/^\d{7}$/.test(mecanographicNumber)) {
      toast.error("O número mecanográfico tem de ter 7 dígitos.");
      return;
    }
    if (!/^\+?\d{9,15}$/.test(phoneNumber.replace(/\s/g, ""))) {
      toast.error("Número de telefone inválido.");
      return;
    }
    registerMutation.mutate({ email, name, password, phoneNumber, mecanographicNumber, rank });
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha o email e a password.");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  const handleReset = () => {
    if (!emailInstitucional(email)) {
      toast.error("Introduza o seu email @gnr.pt para recuperar a password.");
      return;
    }
    resetMutation.mutate(email);
  };

  const separador = (alvo: AuthMode, rotulo: string, icone: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === alvo}
      onClick={() => setMode(alvo)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
        mode === alvo
          ? "border-latao-500 text-ral-800"
          : "border-transparent text-ral-400 hover:text-ral-700"
      }`}
    >
      {icone}
      {rotulo}
    </button>
  );

  return (
    <EcraAcesso
      titulo="Sistema de Avaliação de Pedidos de Apoio"
      subtitulo="Acesso restrito a militares da GNR com email institucional"
    >
      <div role="tablist" className="flex gap-2 mb-6 border-b border-ral-200">
        {separador("login", "Entrar", <LogIn className="w-4 h-4" />)}
        {separador("register", "Registo", <UserPlus className="w-4 h-4" />)}
      </div>

      {mode === "login" && (
        <form className="space-y-4" onSubmit={handleLogin} noValidate>
          <Campo id="login-email" label="Email (@gnr.pt)">
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="nome.apelido@gnr.pt"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Campo>
          <Campo id="login-password" label="Password">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Campo>
          <Button type="submit" disabled={loginMutation.isPending} className="w-full h-10 text-base font-semibold">
            {loginMutation.isPending ? "A entrar..." : "Entrar"}
          </Button>

          <button
            type="button"
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="w-full text-xs text-ral-500 hover:text-ral-800 underline underline-offset-2"
          >
            Esqueci-me da password
          </button>
        </form>
      )}

      {mode === "register" && (
        <form className="space-y-4" onSubmit={handleRegister} noValidate>
          <div className="bg-latao-100 border border-latao-300 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-latao-700 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-ral-800">
              Registe-se com o seu email institucional <strong>@gnr.pt</strong>. A conta só fica ativa
              depois de aprovada por um administrador, e o acesso exige uma aplicação autenticadora no
              telemóvel (segundo fator).
            </p>
          </div>
          <Campo id="reg-nome" label="Nome">
            <Input
              id="reg-nome"
              autoComplete="name"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </Campo>
          <Campo id="reg-email" label="Email (@gnr.pt)">
            <Input
              id="reg-email"
              type="email"
              autoComplete="username"
              placeholder="nome.apelido@gnr.pt"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Campo>
          <Campo id="reg-password" label="Password" ajuda={`Mínimo ${PASSWORD_MINIMA} caracteres. Uma frase longa é mais segura e mais fácil de lembrar.`}>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Campo>
          <Campo id="reg-password2" label="Confirmar password">
            <Input
              id="reg-password2"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Campo>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo id="reg-telefone" label="Telefone">
              <Input
                id="reg-telefone"
                type="tel"
                autoComplete="tel"
                placeholder="912345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                maxLength={20}
              />
            </Campo>
            <Campo id="reg-mecanografico" label="N.º mecanográfico">
              <Input
                id="reg-mecanografico"
                inputMode="numeric"
                placeholder="7 dígitos"
                value={mecanographicNumber}
                onChange={(e) => setMecanographicNumber(e.target.value.replace(/\D/g, "").slice(0, 7))}
              />
            </Campo>
          </div>
          <Campo id="reg-posto" label="Posto">
            <select
              id="reg-posto"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="w-full h-9 border border-input rounded-md px-3 bg-white text-sm"
            >
              <option value="">Selecione um posto</option>
              {POSTOS.map((posto) => (
                <option key={posto} value={posto}>
                  {posto}
                </option>
              ))}
            </select>
          </Campo>
          <Button type="submit" disabled={registerMutation.isPending} className="w-full h-10 text-base font-semibold">
            {registerMutation.isPending ? "A registar..." : "Criar conta"}
          </Button>
        </form>
      )}
    </EcraAcesso>
  );
}
