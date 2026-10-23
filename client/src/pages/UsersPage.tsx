import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Crown, UserCheck, UserX, Users, ShieldOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { formatarData, formatarDataHora } from "@/lib/datas";
import type { Profile } from "@/lib/api";

const Etiqueta = ({ classe, children }: { classe: string; children: React.ReactNode }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${classe}`}>{children}</span>
);

function estado(u: Profile) {
  if (u.active !== 1) return <Etiqueta classe="bg-erro-claro text-erro">Desativado</Etiqueta>;
  if (u.approved !== 1) return <Etiqueta classe="bg-aviso-claro text-aviso">Pendente</Etiqueta>;
  return <Etiqueta classe="bg-ok-claro text-ok">Ativo</Etiqueta>;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.users.list.useQuery();

  const atualizar = () => {
    void utils.users.invalidate();
    void utils.auth.sessao.invalidate();
  };

  const desativar = trpc.users.desativar.useMutation({
    onSuccess: () => {
      toast.success("Conta desativada. Os registos do militar mantêm-se.");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const reativar = trpc.users.reativar.useMutation({
    onSuccess: () => {
      toast.success("Conta reativada.");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const promover = trpc.users.promoteToAdmin.useMutation({
    onSuccess: () => {
      toast.success("Utilizador promovido a administrador.");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const despromover = trpc.users.removerAdmin.useMutation({
    onSuccess: () => {
      toast.success("Privilégios de administrador retirados.");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const nome = (u: Profile) => [u.rank, u.name].filter(Boolean).join(" ") || u.email;
  const ocupado = desativar.isPending || reativar.isPending || promover.isPending || despromover.isPending;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Users className="w-6 h-6 text-ral-700" />
        <h2 className="text-xl font-bold text-ral-800">Gestão de utilizadores</h2>
      </div>
      <p className="text-sm text-ral-500 mb-6">
        Desativar retira o acesso de imediato e preserva tudo o que o militar registou. As contas não se
        eliminam; os registos por aprovar rejeitam-se no separador Aprovações.
      </p>

      {isLoading ? (
        <div className="text-center py-12 text-ral-400">A carregar...</div>
      ) : !users || users.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-ral-300">
          <p className="text-ral-500 text-sm">Nenhum utilizador registado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <caption className="sr-only">Utilizadores</caption>
            <thead>
              <tr className="bg-ral-700 text-white">
                {["Nome", "Email", "Função", "Estado", "Registo", "Última entrada", "Ações"].map((h) => (
                  <th key={h} scope="col" className="text-left px-4 py-3 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const eu = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className="border-b border-ral-100 even:bg-ral-50/60">
                    <td className="px-4 py-3 font-medium text-ral-900">
                      {nome(u)}
                      {eu && (
                        <span className="ml-2 text-xs bg-latao-100 text-latao-700 px-2 py-0.5 rounded-full font-semibold">
                          Você
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ral-700">{u.email || "—"}</td>
                    <td className="px-4 py-3">
                      {u.role === "admin" ? (
                        <Etiqueta classe="bg-latao-100 text-latao-700">Administrador</Etiqueta>
                      ) : (
                        <Etiqueta classe="bg-ral-100 text-ral-700">Utilizador</Etiqueta>
                      )}
                    </td>
                    <td className="px-4 py-3">{estado(u)}</td>
                    <td className="px-4 py-3 text-ral-600 whitespace-nowrap">{formatarData(u.createdAt)}</td>
                    <td className="px-4 py-3 text-ral-600 whitespace-nowrap">{formatarDataHora(u.lastSignedIn)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {u.role !== "admin" && u.approved === 1 && u.active === 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={ocupado}
                            onClick={() => confirm(`Promover ${nome(u)} a administrador?`) && promover.mutate({ id: u.id })}
                          >
                            <Crown className="w-3.5 h-3.5" />
                            Promover
                          </Button>
                        )}
                        {u.role === "admin" && !eu && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={ocupado}
                            onClick={() =>
                              confirm(`Retirar os privilégios de administrador a ${nome(u)}?`) &&
                              despromover.mutate({ id: u.id })
                            }
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                            Retirar admin
                          </Button>
                        )}
                        {u.active === 1 && !eu && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-erro border-erro/40 hover:bg-erro-claro"
                            disabled={ocupado}
                            onClick={() =>
                              confirm(
                                `Desativar a conta de ${nome(u)}? Perde imediatamente o acesso; os registos que fez mantêm-se.`,
                              ) && desativar.mutate({ id: u.id })
                            }
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Desativar
                          </Button>
                        )}
                        {u.active !== 1 && (
                          <Button variant="outline" size="sm" disabled={ocupado} onClick={() => reativar.mutate({ id: u.id })}>
                            <UserCheck className="w-3.5 h-3.5" />
                            Reativar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-ral-50 border-t border-ral-200 text-xs text-ral-500">
            {users.length} utilizador(es) registado(s)
          </div>
        </div>
      )}
    </div>
  );
}
