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
      {suspects.map((suspect, index) => (
        <Card key={suspect.id ?? `novo-${index}`} className="p-4 border border-ral-200 bg-white shadow-none">
          <div className="flex items-center justify-between mb-4">
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

          {expandedIndex === index && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-ral-700 mb-1 block">Nome</Label>
                  <Input
                    placeholder="Nome completo"
                    value={suspect.nome}
                    onChange={(e) => updateSuspect(index, "nome", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-ral-700 mb-1 block">
                    Data de nascimento
                  </Label>
                  <Input
                    placeholder="DD/MM/AAAA"
                    value={suspect.dataNascimento}
                    onChange={(e) => updateSuspect(index, "dataNascimento", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-ral-700 mb-1 block">
                    Nacionalidade
                  </Label>
                  <Input
                    placeholder="Nacionalidade"
                    value={suspect.nacionalidade}
                    onChange={(e) => updateSuspect(index, "nacionalidade", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-ral-700 mb-1 block">NIF</Label>
                  <Input
                    placeholder="NIF"
                    value={suspect.nif}
                    onChange={(e) => updateSuspect(index, "nif", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-ral-700 mb-1 block">CC</Label>
                  <Input
                    placeholder="Cartão de cidadão"
                    value={suspect.cc}
                    onChange={(e) => updateSuspect(index, "cc", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-ral-700 mb-1 block">Morada</Label>
                <Textarea
                  placeholder="Morada completa"
                  value={suspect.morada}
                  onChange={(e) => updateSuspect(index, "morada", e.target.value)}
                  disabled={readOnly}
                  className="min-h-[60px]"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-ral-700 mb-1 block">
                  Observações
                </Label>
                <Textarea
                  placeholder="Observações sobre o suspeito..."
                  value={suspect.observacoes}
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
