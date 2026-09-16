import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, UserPlus, Shield, AlertCircle } from "lucide-react";

/**
 * O logótipo é servido pela própria aplicação (client/public/gioe-logo.webp).
 * Na versão anterior vinha de um CDN da plataforma onde a aplicação estava
 * alojada — essa dependência foi removida.
 */
const LOGO_URL = `${import.meta.env.BASE_URL}gioe-logo.webp`;

const POSTOS = [
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

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mecanographicNumber, setMecanographicNumber] = useState("");
  const [rank, setRank] = useState("");

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      // Se a confirmação de email estiver ligada no Supabase, não há sessão
      // imediata: o militar tem de confirmar o endereço primeiro.
      const precisaConfirmar = !data.user?.confirmed_at && !(data.user as any)?.email_confirmed_at;

      if (precisaConfirmar) {
        toast.success("Conta criada. Confirme o email antes de entrar.");
        setMode("login");
      } else {
        toast.success("Conta criada com sucesso.");
        setTimeout(() => window.location.reload(), 1000);
      }

      setName("");
      setPassword("");
      setConfirmPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Sessão iniciada.");
      setTimeout(() => window.location.reload(), 500);
    },
    onError: (e) => toast.error(e.message),
  });

  const resetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => toast.success("Se o email estiver registado, receberá as instruções."),
    onError: (e) => toast.error(e.message),
  });

  const handleRegister = () => {
    if (
      !email ||
      !name ||
      !password ||
      !confirmPassword ||
      !phoneNumber ||
      !mecanographicNumber ||
      !rank
    ) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (!email.endsWith("@gnr.pt")) {
      toast.error("O email tem de terminar em @gnr.pt");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As passwords não coincidem.");
      return;
    }
    if (password.length < 8) {
      toast.error("A password tem de ter pelo menos 8 caracteres.");
      return;
    }
    if (!/^\d{7}$/.test(mecanographicNumber)) {
      toast.error("O número mecanográfico tem de ter 7 dígitos.");
      return;
    }
    registerMutation.mutate({ email, name, password, phoneNumber, mecanographicNumber, rank });
  };

  const handleLogin = () => {
    if (!email || !password) {
      toast.error("Preencha o email e a password.");
      return;
    }
    if (!email.endsWith("@gnr.pt")) {
      toast.error("O email tem de terminar em @gnr.pt");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  const handleReset = () => {
    if (!email || !email.endsWith("@gnr.pt")) {
      toast.error("Introduza o seu email @gnr.pt para recuperar a password.");
      return;
    }
    resetMutation.mutate(email);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Cabeçalho */}
        <div
          className="text-white text-center py-10 px-5"
          style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)" }}
        >
          <img
            src={LOGO_URL}
            alt="Logótipo GNR/GIOE"
            className="w-28 h-28 mx-auto mb-5 object-contain"
            style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}
            onError={(e) => {
              // Sem ficheiro de logótipo, mostra apenas o texto.
              e.currentTarget.style.display = "none";
            }}
          />
          <h1 className="text-2xl font-bold tracking-widest mb-1">GIOE</h1>
          <p className="text-sm opacity-90">Grupo de Intervenção de Operações Especiais</p>
        </div>

        <div className="p-8">
          <div className="text-center mb-6">
            <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: "#1a472a" }} />
            <h2 className="text-xl font-bold" style={{ color: "#1a472a" }}>
              Sistema de Avaliação de Pedidos de Apoio
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Acesso restrito a elementos da GNR com email institucional
            </p>
          </div>

          {/* Separadores */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
                mode === "login"
                  ? "border-[#1a472a] text-[#1a472a]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-1" />
              Entrar
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
                mode === "register"
                  ? "border-[#1a472a] text-[#1a472a]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-1" />
              Registo
            </button>
          </div>

          {mode === "login" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-600 mb-1 block">
                  Email (@gnr.pt)
                </Label>
                <Input
                  type="email"
                  autoComplete="username"
                  placeholder="nome.apelido@gnr.pt"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-2 focus:border-[#1a472a]"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-600 mb-1 block">Password</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="A sua password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="border-2 focus:border-[#1a472a]"
                />
              </div>
              <Button
                onClick={handleLogin}
                disabled={loginMutation.isPending}
                className="w-full py-2 text-base font-semibold"
                style={{ background: "#1a472a" }}
              >
                {loginMutation.isPending ? "A entrar..." : "Entrar"}
              </Button>

              <button
                type="button"
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="w-full text-xs text-gray-500 hover:text-[#1a472a] underline"
              >
                Esqueci-me da password
              </button>
            </div>
          )}

          {mode === "register" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Registe-se com o seu email institucional <strong>@gnr.pt</strong>. A conta só fica
                  ativa depois de aprovada por um administrador.
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-600 mb-1 block">Nome</Label>
                <Input
                  type="text"
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-2 focus:border-[#1a472a]"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-600 mb-1 block">
                  Email (@gnr.pt)
                </Label>
                <Input
                  type="email"
                  autoComplete="username"
                  placeholder="nome.apelido@gnr.pt"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-2 focus:border-[#1a472a]"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-600 mb-1 block">Password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-2 focus:border-[#1a472a]"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-600 mb-1 block">
                  Confirmar password
                </Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repita a password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                  className="border-2 focus:border-[#1a472a]"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-600 mb-1 block">
                  Número de telefone
                </Label>
                <Input
                  type="tel"
                  placeholder="Ex.: 912345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="border-2 focus:border-[#1a472a]"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-600 mb-1 block">
                  Número mecanográfico
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="7 dígitos"
                  value={mecanographicNumber}
                  onChange={(e) => setMecanographicNumber(e.target.value)}
                  className="border-2 focus:border-[#1a472a]"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-600 mb-1 block">Posto</Label>
                <select
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-md px-3 py-2 focus:border-[#1a472a] focus:outline-none"
                >
                  <option value="">Selecione um posto</option>
                  {POSTOS.map((posto) => (
                    <option key={posto} value={posto}>
                      {posto}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleRegister}
                disabled={registerMutation.isPending}
                className="w-full py-2 text-base font-semibold"
                style={{ background: "#1a472a" }}
              >
                {registerMutation.isPending ? "A registar..." : "Criar conta"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
