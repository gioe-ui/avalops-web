import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GDH_EXEMPLO, dataParaGdh, gdhValido, normalizarGdh } from "@/lib/datas";

/**
 * Campo GDH (grupo data-hora): dia, hora, minuto, mês e ano — 151630OUT26.
 * Normaliza o que se escreve e assinala logo se o valor não for válido.
 */
export function GdhInput({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
}) {
  const invalido = !gdhValido(value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(normalizarGdh(e.target.value))}
          placeholder={GDH_EXEMPLO}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={11}
          disabled={disabled}
          aria-invalid={invalido}
          aria-describedby={`${id}-ajuda`}
          className="font-mono uppercase tracking-wider"
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(dataParaGdh(new Date()))}
            className="shrink-0 rounded-md border border-ral-200 px-2 text-xs font-semibold text-ral-700 hover:bg-ral-100"
          >
            Agora
          </button>
        )}
      </div>
      <p id={`${id}-ajuda`} className={`text-xs ${invalido ? "text-erro font-semibold" : "text-muted-foreground"}`}>
        {invalido ? `Formato inválido — use DDHHMMMESAA, ex.: ${GDH_EXEMPLO}` : "Dia, hora, minuto, mês, ano"}
      </p>
    </div>
  );
}
