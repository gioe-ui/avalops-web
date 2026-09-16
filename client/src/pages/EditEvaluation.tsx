import { useCallback, useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Printer, Loader2 } from "lucide-react";
import { EvaluationFields } from "@/components/EvaluationFields";
import { FormHeader } from "@/components/FormHeader";
import type { Suspect } from "@/components/SuspectForm";
import {
  DEFAULT_FORM,
  deRegistoParaFormulario,
  paraRegistoDeAvaliacao,
  type FormState,
} from "./evaluationFormModel";

export default function EditEvaluation() {
  const [, params] = useRoute("/edit-evaluation/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const utils = trpc.useUtils();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [carregado, setCarregado] = useState(false);

  const { data: evaluation, isLoading, error } = trpc.evaluations.getById.useQuery(
    { id },
    { enabled: Number.isFinite(id) },
  );

  const { data: suspeitosGravados } = trpc.suspects.getByEvaluationId.useQuery(
    { evaluationId: id },
    { enabled: Number.isFinite(id) },
  );

  useEffect(() => {
    if (!evaluation || carregado) return;
    setForm(deRegistoParaFormulario(evaluation));
    setCarregado(true);
  }, [evaluation, carregado]);

  useEffect(() => {
    if (!suspeitosGravados) return;
    setSuspects(
      suspeitosGravados.map((s: any) => ({
        id: s.id,
        nome: s.nome ?? "",
        dataNascimento: s.dataNascimento ?? "",
        nacionalidade: s.nacionalidade ?? "",
        nif: s.nif ?? "",
        cc: s.cc ?? "",
        morada: s.morada ?? "",
        observacoes: s.observacoes ?? "",
      })),
    );
  }, [suspeitosGravados]);

  const suspectsDelete = trpc.suspects.deleteByEvaluationId.useMutation();
  const suspectsCreate = trpc.suspects.createBatch.useMutation();

  const updateMutation = trpc.evaluations.update.useMutation({
    onSuccess: async (result) => {
      // Os suspeitos são substituídos em bloco: é o que corresponde à edição
      // livre da lista no formulário (adicionar, remover, reordenar).
      try {
        await suspectsDelete.mutateAsync({ evaluationId: id });
        if (suspects.length > 0) {
          await suspectsCreate.mutateAsync({
            evaluationId: id,
            suspects: suspects.map((s) => ({
              nome: s.nome || null,
              dataNascimento: s.dataNascimento || null,
              nacionalidade: s.nacionalidade || null,
              nif: s.nif || null,
              cc: s.cc || null,
              morada: s.morada || null,
              observacoes: s.observacoes || null,
            })),
          });
        }
      } catch (e) {
        toast.error(
          "A avaliação foi guardada, mas houve um erro ao atualizar os suspeitos: " +
            (e instanceof Error ? e.message : "erro desconhecido"),
        );
      }

      toast.success(`Avaliação atualizada — ${result.pontuacao}/100, ${result.neop}.`);

      utils.evaluations.list.invalidate();
      utils.evaluations.getById.invalidate({ id });
      utils.evaluations.getCters.invalidate();
      utils.suspects.getByEvaluationId.invalidate({ evaluationId: id });
      utils.statistics.get.invalidate();
      utils.statistics.neop4ByCter.invalidate();

      navigate("/");
    },
    onError: (e) => toast.error("Erro ao guardar: " + e.message),
  });

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (!Number.isFinite(id)) {
    return <div className="p-8 text-center text-gray-500">Avaliação inválida.</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Avaliação não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6 no-print">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-xl font-bold" style={{ color: "#1a472a" }}>
                Editar avaliação
              </h2>
              {evaluation.updatedBy ? (
                <p className="text-xs text-gray-500">
                  Última alteração por {evaluation.updatedBy}
                  {evaluation.updatedAt
                    ? ` em ${new Date(evaluation.updatedAt).toLocaleString("pt-PT")}`
                    : ""}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="text-orange-600 border-orange-600 hover:bg-orange-50 border-2"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <FormHeader subtitulo={`Avaliação n.º ${evaluation.id}`} />

          <EvaluationFields
            form={form}
            set={set}
            suspects={suspects}
            onSuspectsChange={setSuspects}
          />

          <div className="flex gap-3 no-print">
            <Button variant="outline" className="flex-1 py-6" onClick={() => navigate("/")}>
              Cancelar
            </Button>
            <Button
              className="flex-1 py-6 text-base font-bold"
              style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)" }}
              onClick={() => updateMutation.mutate({ id, ...paraRegistoDeAvaliacao(form) })}
              disabled={updateMutation.isPending}
            >
              <Save className="w-5 h-5 mr-2" />
              {updateMutation.isPending ? "A guardar..." : "Guardar alterações"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
