import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MINIMA } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Mail, Phone, Hash, Award, Save, X, ArrowLeft, KeyRound, ShieldCheck, Pencil } from "lucide-react";
import { POSTOS } from "./Auth";

function Linha({
  icone,
  rotulo,
  id,
  children,
}: {
  icone: React.ReactNode;
  rotulo: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-ral-700 flex items-center gap-2">
        <span aria-hidden="true">{icone}</span>
        {rotulo}
      </Label>
      {children}
    </div>
  );
}

const Valor = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 py-2 bg-ral-50 rounded-md border border-ral-200 text-ral-800 min-h-9">{children}</div>
);

export default function Profile() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [isEditing, setIsEditing] = useState(false);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [formData, setFormData] = useState({ name: "", phoneNumber: "", mecanographicNumber: "", rank: "" });

  const updateMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      setIsEditing(false);
      void utils.auth.sessao.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password alterada.");
      setAtual("");
      setNova("");
      setConfirmacao("");
    },
    onError: (e) => toast.error(e.message),
  });

  // O perfil chega de forma assíncrona; sem isto o formulário de edição abria
  // com os campos vazios.
  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || "",
      phoneNumber: user.phoneNumber || "",
      mecanographicNumber: user.mecanographicNumber || "",
      rank: user.rank || "",
    });
  }, [user]);

  if (!user) return null;

  const handleChange = (field: keyof typeof formData, value: string) => setFormData({ ...formData, [field]: value });

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (formData.name.trim().length < 2) {
      toast.error("O nome tem de ter pelo menos 2 caracteres.");
      return;
    }
    if (formData.phoneNumber && !/^\+?\d{9,15}$/.test(formData.phoneNumber.replace(/\s/g, ""))) {
      toast.error("Número de telefone inválido.");
      return;
    }
    if (formData.mecanographicNumber && !/^\d{7}$/.test(formData.mecanographicNumber)) {
      toast.error("O número mecanográfico tem de ter 7 dígitos.");
      return;
    }

    updateMutation.mutate({
      name: formData.name !== user.name ? formData.name : undefined,
      phoneNumber: formData.phoneNumber !== user.phoneNumber ? formData.phoneNumber : undefined,
      mecanographicNumber:
        formData.mecanographicNumber !== user.mecanographicNumber ? formData.mecanographicNumber : undefined,
      rank: formData.rank !== user.rank ? formData.rank : undefined,
    });
  };

  const handleCancel = () => {
    setFormData({
      name: user.name || "",
      phoneNumber: user.phoneNumber || "",
      mecanographicNumber: user.mecanographicNumber || "",
      rank: user.rank || "",
    });
    setIsEditing(false);
  };

  const handleChangePassword = (e: FormEvent) => {
    e.preventDefault();
    if (!atual) {
      toast.error("Introduza a password atual.");
      return;
    }
    if (nova.length < PASSWORD_MINIMA) {
      toast.error(`A nova password tem de ter pelo menos ${PASSWORD_MINIMA} caracteres.`);
      return;
    }
    if (nova !== confirmacao) {
      toast.error("As passwords não coincidem.");
      return;
    }
    changePasswordMutation.mutate({ atual, nova });
  };

  return (
    <div className="min-h-dvh bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-start gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/")} aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ral-800">O meu perfil</h1>
            <p className="text-ral-500">Consulte e edite os seus dados pessoais</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-lg border border-ral-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center mb-8 pb-6 border-b border-ral-200 gap-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gioe shrink-0">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-ral-900 truncate">
                {[user.rank, user.name].filter(Boolean).join(" ")}
              </h2>
              <p className="text-ral-500 truncate">{user.email}</p>
            </div>
          </div>

          <div className="space-y-5">
            <Linha icone={<User className="w-4 h-4" />} rotulo="Nome completo" id="perfil-nome">
              {isEditing ? (
                <Input
                  id="perfil-nome"
                  value={formData.name}
                  maxLength={200}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
              ) : (
                <Valor>{user.name}</Valor>
              )}
            </Linha>

            <Linha icone={<Mail className="w-4 h-4" />} rotulo="Email">
              <Valor>{user.email}</Valor>
              <p className="text-xs text-ral-500">O email não pode ser alterado aqui.</p>
            </Linha>

            <Linha icone={<Phone className="w-4 h-4" />} rotulo="Telefone" id="perfil-telefone">
              {isEditing ? (
                <Input
                  id="perfil-telefone"
                  type="tel"
                  value={formData.phoneNumber}
                  maxLength={20}
                  onChange={(e) => handleChange("phoneNumber", e.target.value)}
                  placeholder="912345678"
                />
              ) : (
                <Valor>{user.phoneNumber || "Não preenchido"}</Valor>
              )}
            </Linha>

            <Linha icone={<Hash className="w-4 h-4" />} rotulo="N.º mecanográfico" id="perfil-mecanografico">
              {isEditing ? (
                <Input
                  id="perfil-mecanografico"
                  inputMode="numeric"
                  value={formData.mecanographicNumber}
                  onChange={(e) => handleChange("mecanographicNumber", e.target.value.replace(/\D/g, "").slice(0, 7))}
                  placeholder="7 dígitos"
                />
              ) : (
                <Valor>{user.mecanographicNumber || "Não preenchido"}</Valor>
              )}
            </Linha>

            <Linha icone={<Award className="w-4 h-4" />} rotulo="Posto" id="perfil-posto">
              {isEditing ? (
                <select
                  id="perfil-posto"
                  value={formData.rank}
                  onChange={(e) => handleChange("rank", e.target.value)}
                  className="w-full h-9 border border-input rounded-md px-3 bg-white text-sm"
                >
                  <option value="">Selecione um posto</option>
                  {POSTOS.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  ))}
                </select>
              ) : (
                <Valor>{user.rank || "Não preenchido"}</Valor>
              )}
            </Linha>
          </div>

          <div className="flex gap-3 mt-8 pt-6 border-t border-ral-200">
            {!isEditing ? (
              <Button type="button" onClick={() => setIsEditing(true)} className="flex-1">
                <Pencil className="w-4 h-4" />
                Editar perfil
              </Button>
            ) : (
              <>
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
                  <Save className="w-4 h-4" />
                  {updateMutation.isPending ? "A guardar..." : "Guardar alterações"}
                </Button>
                <Button type="button" onClick={handleCancel} variant="outline" className="flex-1">
                  <X className="w-4 h-4" />
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </form>

        <section className="bg-white rounded-lg border border-ral-200 shadow-sm p-6 sm:p-8 mt-6">
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-ral-800">
            <ShieldCheck className="w-5 h-5" />
            Segundo fator
          </h3>
          <p className="text-sm text-ral-600">
            Ativo. A entrada pede o código da aplicação autenticadora. Se mudar de telemóvel, peça a um
            administrador que remova o fator atual; no próximo acesso será pedido um novo registo.
          </p>
        </section>

        <form
          onSubmit={handleChangePassword}
          className="bg-white rounded-lg border border-ral-200 shadow-sm p-6 sm:p-8 mt-6"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-ral-800">
            <KeyRound className="w-5 h-5" />
            Alterar password
          </h3>
          <input type="email" autoComplete="username" value={user.email} readOnly hidden />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password-atual" className="text-sm font-semibold text-ral-700">
                Password atual
              </Label>
              <Input
                id="password-atual"
                type="password"
                autoComplete="current-password"
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password-nova" className="text-sm font-semibold text-ral-700">
                Nova password
              </Label>
              <Input
                id="password-nova"
                type="password"
                autoComplete="new-password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
              />
              <p className="text-xs text-ral-500">Mínimo {PASSWORD_MINIMA} caracteres.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password-confirmar" className="text-sm font-semibold text-ral-700">
                Confirmar nova password
              </Label>
              <Input
                id="password-confirmar"
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={changePasswordMutation.isPending || !nova || !atual}>
              {changePasswordMutation.isPending ? "A alterar..." : "Alterar password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
