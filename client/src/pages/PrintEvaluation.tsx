import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { cterDaAvaliacao } from "@/lib/api";
import { Loader2, ArrowLeft, Printer, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormHeader } from "@/components/FormHeader";
import { toast } from "sonner";

const TIPO_LABELS: Record<string, string> = {
  trafico: "Tráfico",
  assalto: "Assalto",
  homicidio: "Homicídio",
  sequestro: "Sequestro",
  violencia: "Violência",
  outro: "Outro",
};

const POSSE_LABELS: Record<string, string> = {
  registada: "Registada",
  provavel: "Provável",
  improvavel: "Improvável",
};

const USO_LABELS: Record<string, string> = {
  haRegisto: "Há registo",
  naoHaRegisto: "Não há registo",
};

const QTD_LABELS: Record<string, string> = {
  "1": "1 suspeito",
  "2": "2 suspeitos",
  "3": "3 suspeitos",
  "4+": "4 ou mais suspeitos",
};

const NEOP_COLORS: Record<string, string> = {
  "2º NEOP": "#1a472a",
  "3º NEOP": "#b8860b",
  "4º NEOP": "#8b0000",
};

const Bloco = ({ titulo, children }: { titulo?: string; children: React.ReactNode }) => (
  <div className="bg-gray-50 rounded-xl p-5 mb-5 border-l-4" style={{ borderColor: "#1a472a" }}>
    {titulo ? (
      <div className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#1a472a" }}>
        {titulo}
      </div>
    ) : null}
    {children}
  </div>
);

const Marca = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm mb-2">• {children}</div>
);

export default function PrintEvaluation() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [isEditingNeop, setIsEditingNeop] = useState(false);
  const [selectedNeop, setSelectedNeop] = useState<string>("");

  const evaluationId = Number(id ?? 0);
  const utils = trpc.useUtils();

  const {
    data: evaluation,
    isLoading,
    error,
  } = trpc.evaluations.getById.useQuery({ id: evaluationId }, { enabled: Number.isFinite(evaluationId) && evaluationId > 0 });

  const { data: suspects = [] } = trpc.suspects.getByEvaluationId.useQuery(
    { evaluationId },
    { enabled: Number.isFinite(evaluationId) && evaluationId > 0 },
  );

  const updateMutation = trpc.evaluations.update.useMutation({
    onSuccess: (result) => {
      toast.success(`NEOP atualizado para ${result.neop}.`);
      setIsEditingNeop(false);
      utils.evaluations.getById.invalidate({ id: evaluationId });
      utils.evaluations.list.invalidate();
      utils.statistics.get.invalidate();
      utils.statistics.neop4ByCter.invalidate();
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#1a472a" }} />
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Não foi possível carregar a avaliação.</p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const e = evaluation as Record<string, any>;
  const cter = cterDaAvaliacao(e);

  const marcado = (v: unknown) => Boolean(v) && v !== 0;

  const temSuspeitos =
    marcado(e.mandadoDetencao) ||
    marcado(e.mandadoBusca) ||
    (e.quantidadeSuspeitos && e.quantidadeSuspeitos !== "1") ||
    suspects.length > 0;

  const temAtividadeCriminal =
    marcado(e.modalidadeIsolado) ||
    marcado(e.modalidadeAssociacao) ||
    !!e.tipoCriminal ||
    marcado(e.antecedentesContraPessoas) ||
    marcado(e.antecedentesContraPatrimonio) ||
    marcado(e.antecedentesOutros) ||
    !!e.antecedentesFss;

  const temMeios = !!e.posseArma || !!e.usoArma;

  const temLocal =
    marcado(e.tipologiaApartamento) ||
    marcado(e.tipologiaMoradia) ||
    marcado(e.tipologiaOutro) ||
    marcado(e.contextoIsolado) ||
    marcado(e.contextoBairroSocial) ||
    marcado(e.contextoMeioUrbano) ||
    marcado(e.contextoMeioRural) ||
    marcado(e.segurancaCaes) ||
    marcado(e.segurancaPortaBlindada) ||
    marcado(e.segurancaOutrasMedidas);

  // Basta enviar a classificação manual: a base de dados recalcula a pontuação
  // a partir dos critérios já gravados.
  const handleSaveNeop = () => {
    if (!selectedNeop) return;
    updateMutation.mutate({ id: evaluation.id, neopManual: selectedNeop });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="no-print sticky top-0 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button onClick={() => navigate("/")} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setSelectedNeop(e.neop || "");
                setIsEditingNeop(true);
              }}
              variant="outline"
              size="sm"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar NEOP
            </Button>
            <Button onClick={() => window.print()} size="sm" style={{ background: "#1a472a" }}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div id="form-container" className="bg-white p-8 rounded-lg print:rounded-none print:p-0">
          <FormHeader subtitulo="Avaliação de Pedido de Apoio" />

          <Bloco titulo="POC e despacho">
            <div className="grid grid-cols-3 gap-4 mb-4">
              {e.pocPosto && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Posto/função</div>
                  <div className="text-sm">{e.pocPosto}</div>
                </div>
              )}
              {e.pocNome && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Nome</div>
                  <div className="text-sm">{e.pocNome}</div>
                </div>
              )}
              {e.pocContacto && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Contacto</div>
                  <div className="text-sm">{e.pocContacto}</div>
                </div>
              )}
            </div>
            {e.nuipc && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-600 mb-1">NUIPC</div>
                <div className="text-sm">{e.nuipc}</div>
              </div>
            )}
            {e.despacho && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-600 mb-1">Despacho</div>
                <div className="text-sm whitespace-pre-wrap">{e.despacho}</div>
              </div>
            )}
            {cter && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">CTer requerente</div>
                <div className="text-sm">{cter}</div>
              </div>
            )}
          </Bloco>

          {temSuspeitos && (
            <Bloco titulo="Suspeitos">
              {marcado(e.mandadoDetencao) && <Marca>Mandado de detenção</Marca>}
              {marcado(e.mandadoBusca) && <Marca>Mandado de busca</Marca>}
              {e.quantidadeSuspeitos && e.quantidadeSuspeitos !== "1" && (
                <div className="text-sm mb-4">
                  Quantidade: {QTD_LABELS[e.quantidadeSuspeitos] || e.quantidadeSuspeitos}
                </div>
              )}
              {suspects.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-semibold mb-3">Identificação dos suspeitos</div>
                  {suspects.map((suspect: any, index: number) => (
                    <div key={suspect.id ?? index} className="mb-4 p-3 bg-white rounded border border-gray-200">
                      <div className="text-sm font-semibold mb-2">Suspeito {index + 1}</div>
                      {suspect.nome && (
                        <div className="text-sm">
                          <strong>Nome:</strong> {suspect.nome}
                        </div>
                      )}
                      {suspect.dataNascimento && (
                        <div className="text-sm">
                          <strong>Data de nascimento:</strong> {suspect.dataNascimento}
                        </div>
                      )}
                      {suspect.nacionalidade && (
                        <div className="text-sm">
                          <strong>Nacionalidade:</strong> {suspect.nacionalidade}
                        </div>
                      )}
                      {suspect.nif && (
                        <div className="text-sm">
                          <strong>NIF:</strong> {suspect.nif}
                        </div>
                      )}
                      {suspect.cc && (
                        <div className="text-sm">
                          <strong>CC:</strong> {suspect.cc}
                        </div>
                      )}
                      {suspect.morada && (
                        <div className="text-sm">
                          <strong>Morada:</strong> {suspect.morada}
                        </div>
                      )}
                      {suspect.observacoes && (
                        <div className="text-sm">
                          <strong>Observações:</strong> {suspect.observacoes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Bloco>
          )}

          {temAtividadeCriminal && (
            <Bloco titulo="Atividade criminal">
              {marcado(e.modalidadeIsolado) && <Marca>Modalidade: isolado</Marca>}
              {marcado(e.modalidadeAssociacao) && <Marca>Modalidade: associação criminosa</Marca>}
              {e.tipoCriminal && (
                <div className="text-sm mb-2">
                  Tipo criminal:{" "}
                  {e.tipoCriminal
                    .split(",")
                    .map((tipo: string) => TIPO_LABELS[tipo.trim()] || tipo.trim())
                    .join(", ")}
                </div>
              )}
              {marcado(e.antecedentesContraPessoas) && <Marca>Antecedentes contra pessoas</Marca>}
              {marcado(e.antecedentesContraPatrimonio) && (
                <Marca>Antecedentes contra o património</Marca>
              )}
              {marcado(e.antecedentesOutros) && <Marca>Outros antecedentes</Marca>}
              {e.antecedentesFss && (
                <div className="text-sm">
                  Antecedentes contra FSS: {e.antecedentesFss === "sim" ? "Sim" : "Não"}
                </div>
              )}
            </Bloco>
          )}

          {temMeios && (
            <Bloco titulo="Meios">
              {e.posseArma && (
                <div className="text-sm mb-2">
                  Posse de arma: {POSSE_LABELS[e.posseArma] || e.posseArma}
                </div>
              )}
              {e.usoArma && (
                <div className="text-sm">Uso de arma: {USO_LABELS[e.usoArma] || e.usoArma}</div>
              )}
            </Bloco>
          )}

          {temLocal && (
            <Bloco titulo="Local">
              {marcado(e.tipologiaApartamento) && <Marca>Tipologia: apartamento</Marca>}
              {marcado(e.tipologiaMoradia) && <Marca>Tipologia: moradia</Marca>}
              {marcado(e.tipologiaOutro) && <Marca>Tipologia: outro</Marca>}
              {marcado(e.contextoIsolado) && <Marca>Contexto: isolado</Marca>}
              {marcado(e.contextoBairroSocial) && <Marca>Contexto: bairro social</Marca>}
              {marcado(e.contextoMeioUrbano) && <Marca>Contexto: meio urbano</Marca>}
              {marcado(e.contextoMeioRural) && <Marca>Contexto: meio rural</Marca>}
              {marcado(e.segurancaCaes) && <Marca>Segurança: cães</Marca>}
              {marcado(e.segurancaPortaBlindada) && <Marca>Segurança: porta blindada</Marca>}
              {marcado(e.segurancaOutrasMedidas) && <Marca>Segurança: outras medidas</Marca>}
            </Bloco>
          )}

          {e.observacoes && (
            <Bloco>
              <div className="text-sm font-semibold text-gray-600 mb-2">Observações</div>
              <div className="text-sm whitespace-pre-wrap">{e.observacoes}</div>
            </Bloco>
          )}

          <Bloco titulo="Avaliação">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Pontuação</div>
                <div className="text-2xl font-bold" style={{ color: "#1a472a" }}>
                  {e.pontuacao}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">NEOP</div>
                <div
                  className="px-3 py-1 rounded-full text-white text-sm font-bold inline-block"
                  style={{ background: NEOP_COLORS[e.neop] || "#1a472a" }}
                >
                  {e.neop}
                </div>
                {e.neopManual ? (
                  <div className="text-xs text-gray-500 mt-1">Classificação definida manualmente</div>
                ) : null}
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Data</div>
                <div className="text-sm">{e.dataAvaliacao || "—"}</div>
              </div>
            </div>
            {e.avaliador && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-600 mb-1">Avaliador</div>
                <div className="text-sm">{e.avaliador}</div>
              </div>
            )}
            {e.outrasObservacoes && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-600 mb-1">Outras observações</div>
                <div className="text-sm whitespace-pre-wrap">{e.outrasObservacoes}</div>
              </div>
            )}
            {e.parecer && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Parecer</div>
                <div className="text-sm whitespace-pre-wrap">
                  {e.parecer.replace(/^\s*\[[^\]]+\]\s*/, "")}
                </div>
              </div>
            )}
          </Bloco>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white; margin: 0; padding: 0; }
          #form-container { box-shadow: none; border: none; page-break-inside: avoid; }
          .bg-gray-50 { background: #f9fafb !important; }
          .border-l-4 { border-left: 4px solid #1a472a !important; }
          .rounded-xl { border-radius: 0; }
          .max-w-4xl { max-width: 100%; }
        }
      `}</style>

      <Dialog open={isEditingNeop} onOpenChange={setIsEditingNeop}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar NEOP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">NEOP atual: {e.neop}</p>
            <Select value={selectedNeop} onValueChange={setSelectedNeop}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um NEOP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2º NEOP">2º NEOP</SelectItem>
                <SelectItem value="3º NEOP">3º NEOP</SelectItem>
                <SelectItem value="4º NEOP">4º NEOP</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              A pontuação não muda: continua a resultar dos critérios preenchidos. Só a
              classificação é substituída.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingNeop(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveNeop}
              disabled={updateMutation.isPending || !selectedNeop}
              style={{ background: "#1a472a" }}
            >
              {updateMutation.isPending ? "A guardar..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
