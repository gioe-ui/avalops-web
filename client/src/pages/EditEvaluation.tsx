import { useCallback, useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Printer, Loader2, Lock } from "lucide-react";
import { EvaluationFields } from "@/components/EvaluationFields";
import { FormHeader } from "@/components/FormHeader";
import { MarcasImpressao } from "@/components/Classificacao";
import { useAuth } from "@/hooks/useAuth";
import { formatarDataHora } from "@/lib/datas";
import type { Suspect } from "@/components/SuspectForm";
import { deRegistoParaFormulario, novoFormulario, paraRegistoDeAvaliacao, type FormState } from "./evaluationFormModel";
import { paraRegistoDeSuspeitos } from "./EvaluationForm";

export default function EditEvaluation() {
  const [, params] = useRoute("/edit-evaluation/:id");
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const id = Number(params?.id);
  const valido = Number.isInteger(id) && id > 0;
  const utils = trpc.useUtils();

  const [form, setForm] = useState<FormState>(novoFormulario);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [carregado, setCarregado] = useState(false);

  const { data: evaluation, isLoading, error } = trpc.evaluations.getById.useQuery({ id }, { enabled: valido });

  const { data: suspeitosGravados } = trpc.suspects.getByEvaluationId.useQuery(
    { evaluationId: id },
    { enabled: valido },
  );

  // Só o autor ou um administrador alteram (imposto pela base de dados). Os
  // outros veem o formulário bloqueado, em vez de descobrirem ao gravar.
  const podeEditar = Boolean(evaluation && (isAdmin || evaluation.userId === user?.id));

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

  // Avaliação e suspeitos gravados numa só transação: se algo falhar, nada
  // muda (antes, os suspeitos eram apagados e reinseridos em pedidos separados).
  const guardar = trpc.evaluations.guardar.useMutation({
    onSuccess: (result) => {
      toast.success(`Avaliação atualizada — ${result.pontuacao}/100, ${result.neop}.`);
      void utils.evaluations.invalidate();
      void utils.suspects.invalidate();
      void utils.statistics.invalidate();
      void utils.suspectProfiles.invalidate();
      navigate("/");
    },
    onError: (e) => toast.error("Erro ao guardar: " + e.message),
  });

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (!valido) {
    return <div className="p-8 text-center text-ral-500">Avaliação inválida.</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ral-400" />
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4">
        <p className="text-ral-700">Avaliação não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background py-6">
      <MarcasImpressao utilizador={user} recurso="evaluations" id={evaluation.id} />
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between gap-3 mb-6 no-print flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/")} aria-label="Voltar">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-ral-800">
                {podeEditar ? "Editar avaliação" : "Consultar avaliação"} n.º {evaluation.id}
              </h1>
              {evaluation.updatedBy ? (
                <p className="text-xs text-ral-500">
                  Última alteração por {evaluation.updatedBy}
                  {evaluation.updatedAt ? ` em ${formatarDataHora(evaluation.updatedAt)}` : ""}
                </p>
              ) : null}
            </div>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>

        {!podeEditar && (
          <div className="no-print mb-4 flex items-center gap-2 rounded-lg border border-latao-300 bg-latao-100 px-4 py-3 text-sm text-ral-800">
            <Lock className="w-4 h-4 shrink-0 text-latao-700" />
            Só o autor desta avaliação ou um administrador a podem alterar.
          </div>
        )}

        <div className="bg-white p-4 sm:p-6 rounded-lg border border-ral-200 shadow-sm">
          <FormHeader subtitulo={`Avaliação n.º ${evaluation.id}`} />

          {/* fieldset desativado bloqueia todos os campos, incluindo os do Radix. */}
          <fieldset disabled={!podeEditar} className="min-w-0">
            <EvaluationFields form={form} set={set} suspects={suspects} onSuspectsChange={setSuspects} />
          </fieldset>

          <div className="flex gap-3 no-print">
            <Button variant="outline" className="flex-1 h-12" onClick={() => navigate("/")}>
              {podeEditar ? "Cancelar" : "Voltar"}
            </Button>
            {podeEditar && (
              <Button
                className="flex-1 h-12 text-base font-bold"
                onClick={() =>
                  guardar.mutate({
                    id,
                    dados: paraRegistoDeAvaliacao(form),
                    suspeitos: paraRegistoDeSuspeitos(suspects),
                  })
                }
                disabled={guardar.isPending}
              >
                <Save className="w-5 h-5" />
                {guardar.isPending ? "A guardar..." : "Guardar alterações"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
