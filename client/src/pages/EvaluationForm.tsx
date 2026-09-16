import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, Printer } from "lucide-react";
import { EvaluationFields } from "@/components/EvaluationFields";
import { FormHeader } from "@/components/FormHeader";
import type { Suspect } from "@/components/SuspectForm";
import {
  DEFAULT_FORM,
  avaliarFormulario,
  paraRegistoDeAvaliacao,
  type FormState,
} from "./evaluationFormModel";

export default function EvaluationForm() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showConfirm, setShowConfirm] = useState(false);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const utils = trpc.useUtils();

  const { pontuacao, neop, neopColor } = avaliarFormulario(form);

  const suspectsMutation = trpc.suspects.createBatch.useMutation({
    onError: (error) => toast.error("Erro ao guardar suspeitos: " + error.message),
  });

  const createMutation = trpc.evaluations.create.useMutation({
    onSuccess: (result) => {
      if (suspects.length > 0 && result?.evaluationId) {
        suspectsMutation.mutate({
          evaluationId: result.evaluationId,
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

      // Quem decide a pontuação é a base de dados; mostra-se o que ficou
      // gravado, não o que o formulário tinha calculado.
      toast.success(`Avaliação guardada — ${result.pontuacao}/100, ${result.neop}.`);

      setForm({ ...DEFAULT_FORM, dataAvaliacao: new Date().toISOString().split("T")[0] });
      setSuspects([]);
      setShowConfirm(false);
      utils.evaluations.list.invalidate();
      utils.evaluations.getCters.invalidate();
      utils.statistics.get.invalidate();
      utils.statistics.neop4ByCter.invalidate();
    },
    onError: (e) => toast.error("Erro ao guardar: " + e.message),
  });

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 no-print">
        <h2 className="text-xl font-bold" style={{ color: "#1a472a" }}>
          Novo Formulário de Avaliação
        </h2>
        <Button
          variant="outline"
          onClick={() => window.print()}
          className="text-orange-600 border-orange-600 hover:bg-orange-50 border-2"
        >
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      <div id="form-container" className="bg-white p-6 rounded-lg">
        <FormHeader subtitulo="Avaliação de Pedido de Apoio" />

        <EvaluationFields
          form={form}
          set={set}
          suspects={suspects}
          onSuspectsChange={setSuspects}
        />

        <Button
          className="w-full py-6 text-base font-bold no-print"
          style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)" }}
          onClick={() => setShowConfirm(true)}
        >
          <Save className="w-5 h-5 mr-2" />
          Guardar avaliação
        </Button>

        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle style={{ color: "#1a472a" }}>Confirmar submissão</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mb-3">Guardar esta avaliação?</p>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 border border-gray-200">
              <p>
                <strong>POC:</strong> {form.pocNome || "—"}
              </p>
              <p>
                <strong>CTer:</strong> {form.cterRequerente || "—"}
              </p>
              <p>
                <strong>Avaliador:</strong> {form.avaliador || "—"}
              </p>
              <p>
                <strong>Data:</strong> {form.dataAvaliacao}
              </p>
              <p>
                <strong>Pontuação:</strong> {pontuacao}/100
              </p>
              <p>
                <strong>NEOP:</strong>{" "}
                <span className="font-bold" style={{ color: neopColor }}>
                  {neop}
                </span>
              </p>
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => createMutation.mutate(paraRegistoDeAvaliacao(form))}
                disabled={createMutation.isPending}
                style={{ background: "#1a472a" }}
              >
                {createMutation.isPending ? "A guardar..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
