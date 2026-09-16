import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Mail, Phone, Hash, Award, Save, X, ArrowLeft, KeyRound } from "lucide-react";

const RANKS = [
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

export default function Profile() {
  const [, navigate] = useLocation();
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();

  const updateMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      setIsEditing(false);
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password alterada.");
      setNewPassword("");
      setConfirmNewPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    mecanographicNumber: "",
    rank: "",
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">A carregar perfil...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Utilizador não encontrado.</div>
      </div>
    );
  }

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = () => {
    if (!formData.name || formData.name.length < 2) {
      toast.error("O nome tem de ter pelo menos 2 caracteres.");
      return;
    }
    if (formData.phoneNumber && formData.phoneNumber.length < 9) {
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
        formData.mecanographicNumber !== user.mecanographicNumber
          ? formData.mecanographicNumber
          : undefined,
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

  const handleChangePassword = () => {
    if (newPassword.length < 8) {
      toast.error("A nova password tem de ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("As passwords não coincidem.");
      return;
    }
    changePasswordMutation.mutate(newPassword);
  };

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: "linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)" }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-start gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#1a472a" }}>
              O Meu Perfil
            </h1>
            <p className="text-gray-600">Consulte e edite os seus dados pessoais</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center mb-8 pb-8 border-b border-gray-200">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mr-6"
              style={{ background: "#1a472a" }}
            >
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <Label className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome completo
              </Label>
              {isEditing ? (
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="border-2 focus:border-[#1a472a]"
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">
                  {user.name}
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">
                {user.email}
              </div>
              <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado.</p>
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Número de telefone
              </Label>
              {isEditing ? (
                <Input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleChange("phoneNumber", e.target.value)}
                  placeholder="Ex.: 912345678"
                  className="border-2 focus:border-[#1a472a]"
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">
                  {user.phoneNumber || "Não preenchido"}
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Número mecanográfico
              </Label>
              {isEditing ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formData.mecanographicNumber}
                  onChange={(e) => handleChange("mecanographicNumber", e.target.value)}
                  placeholder="7 dígitos"
                  className="border-2 focus:border-[#1a472a]"
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">
                  {user.mecanographicNumber || "Não preenchido"}
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                <Award className="w-4 h-4" />
                Posto
              </Label>
              {isEditing ? (
                <select
                  value={formData.rank}
                  onChange={(e) => handleChange("rank", e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-[#1a472a] focus:outline-none"
                >
                  <option value="">Selecione um posto</option>
                  {RANKS.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">
                  {user.rank || "Não preenchido"}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-8 pt-8 border-t border-gray-200">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="flex-1 flex items-center justify-center gap-2"
                style={{ background: "#1a472a" }}
              >
                <Save className="w-4 h-4" />
                Editar perfil
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2"
                  style={{ background: "#1a472a" }}
                >
                  {updateMutation.isPending ? "A guardar..." : "Guardar alterações"}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Alteração de password — possível agora que a autenticação verifica
            mesmo a password. */}
        <div className="bg-white rounded-xl shadow-lg p-8 mt-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: "#1a472a" }}>
            <KeyRound className="w-5 h-5" />
            Alterar password
          </h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-gray-600 mb-2 block">Nova password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="border-2 focus:border-[#1a472a]"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-600 mb-2 block">
                Confirmar nova password
              </Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="border-2 focus:border-[#1a472a]"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending || !newPassword}
              style={{ background: "#1a472a" }}
            >
              {changePasswordMutation.isPending ? "A alterar..." : "Alterar password"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
