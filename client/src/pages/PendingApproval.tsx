import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Clock, LogOut } from "lucide-react";

export default function PendingApproval() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)" }}
    >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <Clock className="w-16 h-16" style={{ color: "#1a472a" }} />
        </div>

        <h1 className="text-2xl font-bold mb-4" style={{ color: "#1a472a" }}>
          A aguardar aprovação
        </h1>

        <p className="text-gray-600 mb-6">
          A sua conta foi criada. Um administrador irá analisá-la e aprová-la.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            Enquanto a conta não for aprovada, não tem acesso a nenhum dado do sistema.
          </p>
        </div>

        <Button onClick={handleLogout} className="w-full" style={{ background: "#1a472a" }}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
}
