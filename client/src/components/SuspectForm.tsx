import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

export type Suspect = {
  id?: number;
  nome: string;
  dataNascimento: string;
  nacionalidade: string;
  nif: string;
  cc: string;
  morada: string;
  observacoes: string;
};

export const SUSPEITO_VAZIO: Suspect = {
  nome: "",
  dataNascimento: "",
  nacionalidade: "",
  nif: "",
  cc: "",
  morada: "",
  observacoes: "",
};

interface SuspectFormProps {
  suspects: Suspect[];
  onSuspectsChange: (suspects: Suspect[]) => void;
  readOnly?: boolean;
}

export function SuspectForm({ suspects, onSuspectsChange, readOnly = false }: SuspectFormProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  // Em consulta o formulário está dentro de um fieldset desativado, que
  // desativaria também o botão de abrir: por isso ficam todos abertos.
  const aberto = (index: number) => readOnly || expandedIndex === index;

  const addSuspect = () => {
    onSuspectsChange([...suspects, { ...SUSPEITO_VAZIO }]);
    setExpandedIndex(suspects.length);
  };

  const removeSuspect = (index: number) => {
    onSuspectsChange(suspects.filter((_, i) => i !== index));
    if (expandedIndex === index) {
      setExpandedIndex(index > 0 ? index - 1 : null);
    }
  };

  const updateSuspect = (index: number, field: keyof Suspect, value: string) => {
    const updated = [...suspects];
    updated[index] = { ...updated[index], [field]: value };
    onSuspectsChange(updated);
  };

  return (
    <div className="space-y-4">
      {readOnly && suspects.length === 0 && (
        <p className="text-sm text-ral-500">Sem suspeitos registados.</p>
      )}
      {suspects.map((suspect, index) => (
        <Card key={suspect.id ?? `novo-${index}`} className="p-4 border border-ral-200 bg-white shadow-none">
          <div className="flex items-center justify-between mb-4">
            {readOnly ? (
              <h4 className="font-semibold text-ral-800">
                Suspeito {index + 1}: {suspect.nome || "(sem nome)"}
              </h4>
            ) : (
              <button
                type="button"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="flex items-center gap-2 w-full text-left font-semibold text-ral-800 hover:text-ral-950"
                aria-expanded={expandedIndex === index}
              >
                {expandedIndex === index ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <span>
                  Suspeito {index + 1}: {suspect.nome || "(sem nome)"}
                </span>
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeSuspect(index)}
                className="ml-2 p-2 text-erro hover:bg-erro-claro rounded"
                aria-label={`Remover suspeito ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {aberto(index) && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`suspeito-${index}-nome`} className="text-sm font-semibold text-ral-700 mb-1 block">Nome</Label>
                  <Input
                    placeholder="Nome completo"
                    value={suspect.nome}
                    id={`suspeito-${index}-nome`}
                    onChange={(e) => updateSuspect(index, "nome", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor={`suspeito-${index}-dataNascimento`} className="text-sm font-semibold text-ral-700 mb-1 block">
                    Data de nascimento
                  </Label>
                  <Input
                    placeholder="DD/MM/AAAA"
                    value={suspect.dataNascimento}
                    id={`suspeito-${index}-dataNascimento`}
                    onChange={(e) => updateSuspect(index, "dataNascimento", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`suspeito-${index}-nacionalidade`} className="text-sm font-semibold text-ral-700 mb-1 block">
                    Nacionalidade
                  </Label>
                  <Input
                    placeholder="Nacionalidade"
                    value={suspect.nacionalidade}
                    id={`suspeito-${index}-nacionalidade`}
                    onChange={(e) => updateSuspect(index, "nacionalidade", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor={`suspeito-${index}-nif`} className="text-sm font-semibold text-ral-700 mb-1 block">NIF</Label>
                  <Input
                    placeholder="NIF"
                    value={suspect.nif}
                    id={`suspeito-${index}-nif`}
                    onChange={(e) => updateSuspect(index, "nif", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label htmlFor={`suspeito-${index}-cc`} className="text-sm font-semibold text-ral-700 mb-1 block">CC</Label>
                  <Input
                    placeholder="Cartão de cidadão"
                    value={suspect.cc}
                    id={`suspeito-${index}-cc`}
                    onChange={(e) => updateSuspect(index, "cc", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={`suspeito-${index}-morada`} className="text-sm font-semibold text-ral-700 mb-1 block">Morada</Label>
                <Textarea
                  placeholder="Morada completa"
                  value={suspect.morada}
                  id={`suspeito-${index}-morada`}
                    onChange={(e) => updateSuspect(index, "morada", e.target.value)}
                  disabled={readOnly}
                  className="min-h-[60px]"
                />
              </div>

              <div>
                <Label htmlFor={`suspeito-${index}-observacoes`} className="text-sm font-semibold text-ral-700 mb-1 block">
                  Observações
                </Label>
                <Textarea
                  placeholder="Observações sobre o suspeito..."
                  value={suspect.observacoes}
                  id={`suspeito-${index}-observacoes`}
                    onChange={(e) => updateSuspect(index, "observacoes", e.target.value)}
                  disabled={readOnly}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}
        </Card>
      ))}

      {!readOnly && (
        <Button
          type="button"
          onClick={addSuspect}
          variant="outline"
          className="w-full border-2 border-dashed border-ral-400 bg-white text-ral-700 hover:bg-ral-600 hover:text-white hover:border-ral-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar suspeito
        </Button>
      )}
    </div>
  );
}
