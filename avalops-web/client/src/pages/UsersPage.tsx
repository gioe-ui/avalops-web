import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2, Users, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.users.list.useQuery();

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Utilizador eliminado.");
      utils.users.list.invalidate();
      utils.users.getPending.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const promoteToAdminMutation = trpc.users.promoteToAdmin.useMutation({
    onSuccess: () => {
      toast.success("Utilizador promovido a administrador.");
      utils.users.list.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleDelete = (id: string) => {
    if (currentUser?.id === id) {
      toast.error("Não pode eliminar a sua própria conta.");
      return;
    }
    if (
      confirm(
        "Eliminar este utilizador? Perde imediatamente o acesso a todo o sistema.\n\n" +
          "A conta de autenticação em si só pode ser removida no painel do Supabase " +
          "(Authentication → Users).",
      )
    ) {
      deleteMutation.mutate({ id });
    }
  };

  const handlePromoteToAdmin = (id: string, name: string) => {
    if (confirm(`Promover ${name} a administrador?`)) {
      promoteToAdminMutation.mutate({ id });
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6" style={{ color: "#1a472a" }} />
        <h2 className="text-xl font-bold" style={{ color: "#1a472a" }}>
          Gestão de Utilizadores
        </h2>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : !users || users.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-400 text-sm">Nenhum utilizador registado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#1a472a" }}>
                {["Nome", "Email", "Função", "Estado", "Data de Registo", "Ação"].map((h) => (
                  <th key={h} className="text-white text-left px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b border-gray-100 hover:bg-green-50 transition-colors ${
                    i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {u.name || "—"}
                    {currentUser?.id === u.id && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                        Você
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        u.role === "admin"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {u.role === "admin" ? "Administrador" : "Utilizador"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        u.approved === 1
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {u.approved === 1 ? "Aprovado" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(u.createdAt).toLocaleDateString("pt-PT")}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {u.role !== "admin" && isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePromoteToAdmin(u.id, u.name || "Utilizador")}
                        disabled={promoteToAdminMutation.isPending}
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        Promover
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(u.id)}
                      disabled={deleteMutation.isPending || currentUser?.id === u.id}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            {users.length} utilizador(es) registado(s)
          </div>
        </div>
      )}
    </div>
  );
}
