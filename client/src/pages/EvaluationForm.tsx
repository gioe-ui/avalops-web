import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, Printer } from "lucide-react";
import { EvaluationFields } from "@/components/EvaluationFields";
import { FormHeader } from "@/components/FormHeader";
import { MarcasImpressao } from "@/components/Classificacao";
import { useAuth } from "@/hooks/useAuth";
import { formatarData } from "@/lib/datas";
import type { Suspect } from "@/components/SuspectForm";
import {
  avaliarFormulario,
  novoFormulario,
  paraRegistoDeAvaliacao,
  type FormState,
} from "./evaluationFormModel";

/** Suspeitos no formato que a base de dados grava. */
export const paraRegistoDeSuspeitos = (suspects: Suspect[]) =>
  suspects.map((s) => ({
    nome: s.nome,
    dataNascimento: s.dataNascimento,
    nacionalidade: s.nacionalidade,
    nif: s.nif,
    cc: s.cc,
    morada: s.morada,
    observacoes: s.observacoes,
  }));

export default function EvaluationForm() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(novoFormulario);
  const [showConfirm, setShowConfirm] = useState(false);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const utils = trpc.useUtils();

  const { pontuacao, neop, neopColor } = avaliarFormulario(form);

  const guardar = trpc.evaluations.guardar.useMutation({
    onSuccess: (result) => {
      // Quem decide a pontuação é a base de dados; mostra-se o que ficou
      // gravado, não o que o formulário tinha calculado.
      toast.success(`Avaliação guardada — ${result.pontuacao}/100, ${result.neop}.`);

      setForm(novoFormulario());
      setSuspects([]);
      setShowConfirm(false);
      void utils.evaluations.invalidate();
      void utils.statistics.invalidate();
      void utils.suspectProfiles.invalidate();
    },
    onError: (e) => toast.error("Erro ao guardar: " + e.message),
  });

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <MarcasImpressao utilizador={user} recurso="formulario-avaliacao" />

      <div className="flex items-center justify-between gap-3 mb-6 no-print flex-wrap">
        <h2 className="text-xl font-bold text-ral-800">Novo formulário de avaliação</h2>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="w-4 h-4" />
          Imprimir
        </Button>
      </div>

      <div id="form-container" className="bg-white p-4 sm:p-6 rounded-lg border border-ral-200 shadow-sm">
        <FormHeader subtitulo="Avaliação de Pedido de Apoio" />

        <EvaluationFields form={form} set={set} suspects={suspects} onSuspectsChange={setSuspects} />

        <Button className="w-full h-12 text-base font-bold no-print" onClick={() => setShowConfirm(true)}>
          <Save className="w-5 h-5" />
          Guardar avaliação
        </Button>

        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-ral-800">Confirmar submissão</DialogTitle>
              <DialogDescription>Confira os dados principais antes de guardar.</DialogDescription>
            </DialogHeader>
            <dl className="bg-ral-50 rounded-lg p-4 text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border border-ral-200">
              <dt className="font-semibold text-ral-700">POC</dt>
              <dd>{form.pocNome || "—"}</dd>
              <dt className="font-semibold text-ral-700">CTer</dt>
              <dd>{form.cterRequerente || "—"}</dd>
              <dt className="font-semibold text-ral-700">Avaliador</dt>
              <dd>{form.avaliador || "—"}</dd>
              <dt className="font-semibold text-ral-700">Data</dt>
              <dd>{formatarData(form.dataAvaliacao)}</dd>
              <dt className="font-semibold text-ral-700">Suspeitos</dt>
              <dd>{suspects.length}</dd>
              <dt className="font-semibold text-ral-700">Pontuação</dt>
              <dd>{pontuacao}/100</dd>
              <dt className="font-semibold text-ral-700">NEOP</dt>
              <dd className="font-bold" style={{ color: neopColor }}>
                {neop}
              </dd>
            </dl>
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() =>
                  guardar.mutate({
                    dados: paraRegistoDeAvaliacao(form),
                    suspeitos: paraRegistoDeSuspeitos(suspects),
                  })
                }
                disabled={guardar.isPending}
              >
                {guardar.isPending ? "A guardar..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
