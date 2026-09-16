import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";

/**
 * Perfis de suspeitos, agregados a partir da tabela `suspects`.
 *
 * A versão original desta página não lia suspeitos nenhuns: construía a lista a
 * partir das avaliações, usando o NUIPC no lugar do nome e o CTer no lugar do
 * NIF, com um comentário do próprio gerador a assumir que era provisório. Como
 * a tabela de suspeitos existe e é preenchida pelo formulário de avaliação, a
 * página passou a usá-la.
 */
export default function SuspectProfiles() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: suspects = [], isLoading } = trpc.suspectProfiles.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  const filteredSuspects = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    if (!termo) return suspects;

    return suspects.filter(
      (s) =>
        s.nome?.toLowerCase().includes(termo) ||
        s.nif?.toLowerCase().includes(termo) ||
        s.cc?.toLowerCase().includes(termo),
    );
  }, [suspects, searchTerm]);

  const paginatedSuspects = filteredSuspects.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredSuspects.length / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Perfis de Suspeitos</h1>
          <p className="text-muted-foreground mt-2">
            Suspeitos registados nas avaliações e respetivo histórico
          </p>
        </div>
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Procurar por nome, NIF ou CC..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              A carregar...
            </CardContent>
          </Card>
        ) : paginatedSuspects.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {suspects.length === 0
                ? "Ainda não há suspeitos registados nas avaliações."
                : "Nenhum suspeito corresponde à pesquisa."}
            </CardContent>
          </Card>
        ) : (
          paginatedSuspects.map((suspect) => (
            <Card key={suspect.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{suspect.nome || "Sem nome"}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      NIF: {suspect.nif || "—"} · CC: {suspect.cc || "—"} · Nacionalidade:{" "}
                      {suspect.nacionalidade || "—"}
                    </p>
                  </div>
                  {suspect.neop4Count > 0 && (
                    <Badge variant="destructive">{suspect.neop4Count} × 4º NEOP</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Avaliações em que consta</p>
                    <p className="text-2xl font-bold">{suspect.totalOperations}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Proporção de 4º NEOP</p>
                    <p className="text-2xl font-bold">
                      {suspect.totalOperations > 0
                        ? Math.round((suspect.neop4Count / suspect.totalOperations) * 100)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
            >
              Seguinte
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
