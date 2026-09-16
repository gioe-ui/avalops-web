import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, AlertTriangle, Crosshair, MapPin, ClipboardList } from "lucide-react";
import { SuspectForm, type Suspect } from "@/components/SuspectForm";
import { CTERS, avaliarFormulario, type FormState } from "@/pages/evaluationFormModel";

/**
 * Os campos da avaliação, partilhados entre a criação e a edição.
 *
 * Na versão anterior este bloco existia duas vezes, uma em cada página, com as
 * diferenças habituais de quem copia e cola: o formulário de edição tinha o seu
 * próprio cálculo NEOP e as suas próprias listas de CTer.
 */

const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <span style={{ color: "#1a472a" }}>{icon}</span>
    <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#1a472a" }}>
      {title}
    </h3>
  </div>
);

const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-gray-50 rounded-xl p-5 mb-5 border-l-4" style={{ borderColor: "#1a472a" }}>
    {children}
  </div>
);

const CheckItem = ({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) => (
  <div className="flex items-center gap-2 py-1">
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      className="data-[state=checked]:bg-[#1a472a] data-[state=checked]:border-[#1a472a]"
    />
    <label htmlFor={id} className="text-sm cursor-pointer text-gray-700">
      {label}
    </label>
  </div>
);

const TIPOS_CRIME: { id: string; label: string }[] = [
  { id: "trafico", label: "Tráfico de droga (+7)" },
  { id: "assalto", label: "Assalto/Roubo (+6)" },
  { id: "homicidio", label: "Homicídio (+10)" },
  { id: "sequestro", label: "Sequestro (+9)" },
  { id: "violencia", label: "Violência grave (+8)" },
  { id: "outro", label: "Outro (+4)" },
];

interface EvaluationFieldsProps {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  suspects: Suspect[];
  onSuspectsChange: (suspects: Suspect[]) => void;
}

export function EvaluationFields({
  form,
  set,
  suspects,
  onSuspectsChange,
}: EvaluationFieldsProps) {
  const { pontuacao, neop, complexidade, descricao, neopColor } = avaliarFormulario(form);

  const toggleCrime = (tipo: string, marcado: boolean) => {
    if (marcado) {
      if (!form.tipoCriminal.includes(tipo)) set("tipoCriminal", [...form.tipoCriminal, tipo]);
    } else {
      set(
        "tipoCriminal",
        form.tipoCriminal.filter((t) => t !== tipo),
      );
    }
  };

  return (
    <>
      <Section>
        <SectionTitle
          icon={<Crosshair className="w-4 h-4" />}
          title="Identificação e entidade solicitadora"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">NUIPC</Label>
            <Input
              placeholder="Número de identificação"
              value={form.nuipc}
              onChange={(e) => set("nuipc", e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">
              Entidade solicitadora
            </Label>
            <div className="space-y-2">
              {["CO", "CTer", "PSP", "PJ", "Outra"].map((entity) => (
                <div key={entity} className="flex items-center">
                  <Checkbox
                    id={`entity-${entity}`}
                    checked={form.entidadeSolicitadora === entity}
                    onCheckedChange={() =>
                      set(
                        "entidadeSolicitadora",
                        form.entidadeSolicitadora === entity ? "" : entity,
                      )
                    }
                  />
                  <label htmlFor={`entity-${entity}`} className="ml-2 text-sm cursor-pointer">
                    {entity}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">Ref. Filedoc</Label>
            <Input
              placeholder="Referência do Filedoc"
              value={form.refFiledoc}
              onChange={(e) => set("refFiledoc", e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">Email</Label>
            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">Ordem verbal</Label>
            <Input
              placeholder="Ordem verbal"
              value={form.ordemVerbal}
              onChange={(e) => set("ordemVerbal", e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle icon={<User className="w-4 h-4" />} title="POC e despacho" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">Posto/função</Label>
            <Input
              placeholder="Ex.: Sargento"
              value={form.pocPosto}
              onChange={(e) => set("pocPosto", e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">Nome</Label>
            <Input
              placeholder="Nome completo"
              value={form.pocNome}
              onChange={(e) => set("pocNome", e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">Contacto</Label>
            <Input
              placeholder="Telefone ou email"
              value={form.pocContacto}
              onChange={(e) => set("pocContacto", e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
        </div>
        <div className="mb-4">
          <Label className="text-sm font-semibold text-gray-600 mb-1 block">Despacho</Label>
          <Textarea
            placeholder="Registo do despacho..."
            value={form.despacho}
            onChange={(e) => set("despacho", e.target.value)}
            className="min-h-[80px] border-2 focus:border-[#1a472a]"
          />
        </div>
        <div>
          <Label className="text-sm font-semibold text-gray-600 mb-1 block">
            Comando Territorial requerente
          </Label>
          <Select value={form.cterRequerente} onValueChange={(v) => set("cterRequerente", v)}>
            <SelectTrigger className="border-2 focus:border-[#1a472a]">
              <SelectValue placeholder="Selecione um CTer" />
            </SelectTrigger>
            <SelectContent>
              {CTERS.map((cter) => (
                <SelectItem key={cter} value={cter}>
                  {cter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section>
        <SectionTitle icon={<AlertTriangle className="w-4 h-4" />} title="Suspeito(s)" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">Mandados</Label>
            <CheckItem
              id="mandadoDetencao"
              label="Mandado de detenção (+5)"
              checked={form.mandadoDetencao}
              onCheckedChange={(v) => set("mandadoDetencao", v)}
            />
            <CheckItem
              id="mandadoBusca"
              label="Mandado de busca (+3)"
              checked={form.mandadoBusca}
              onCheckedChange={(v) => set("mandadoBusca", v)}
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">
              Quantidade de suspeitos
            </Label>
            <Select
              value={form.quantidadeSuspeitos}
              onValueChange={(v) => set("quantidadeSuspeitos", v)}
            >
              <SelectTrigger className="border-2 focus:border-[#1a472a]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 suspeito (+1)</SelectItem>
                <SelectItem value="2">2 suspeitos (+2)</SelectItem>
                <SelectItem value="3">3 suspeitos (+4)</SelectItem>
                <SelectItem value="4+">4 ou mais suspeitos (+6)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="border-t pt-6">
          <SuspectForm suspects={suspects} onSuspectsChange={onSuspectsChange} />
        </div>
      </Section>

      <Section>
        <SectionTitle icon={<Crosshair className="w-4 h-4" />} title="Atividade criminal" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">Modalidade</Label>
            <CheckItem
              id="isolado"
              label="Isolado (+2)"
              checked={form.modalidadeIsolado}
              onCheckedChange={(v) => {
                set("modalidadeIsolado", v);
                if (v) set("modalidadeAssociacao", false);
              }}
            />
            <CheckItem
              id="associacao"
              label="Associação criminosa (+8)"
              checked={form.modalidadeAssociacao}
              onCheckedChange={(v) => {
                set("modalidadeAssociacao", v);
                if (v) set("modalidadeIsolado", false);
              }}
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">
              Tipo de atividade
            </Label>
            <div className="space-y-2">
              {TIPOS_CRIME.map((tipo) => (
                <CheckItem
                  key={tipo.id}
                  id={tipo.id}
                  label={tipo.label}
                  checked={form.tipoCriminal.includes(tipo.id)}
                  onCheckedChange={(v) => toggleCrime(tipo.id, v)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">
              Antecedentes criminais
            </Label>
            <CheckItem
              id="contraPessoas"
              label="Contra pessoas (+8)"
              checked={form.antecedentesContraPessoas}
              onCheckedChange={(v) => set("antecedentesContraPessoas", v)}
            />
            <CheckItem
              id="contraPatrimonio"
              label="Contra o património (+5)"
              checked={form.antecedentesContraPatrimonio}
              onCheckedChange={(v) => set("antecedentesContraPatrimonio", v)}
            />
            <CheckItem
              id="outrosAntecedentes"
              label="Outros (+3)"
              checked={form.antecedentesOutros}
              onCheckedChange={(v) => set("antecedentesOutros", v)}
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">
              Antecedentes contra FSS
            </Label>
            <RadioGroup
              value={form.antecedentesFss}
              onValueChange={(v) => set("antecedentesFss", v)}
              className="gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="sim" id="fssSim" className="border-[#1a472a] text-[#1a472a]" />
                <label htmlFor="fssSim" className="text-sm cursor-pointer text-gray-700">
                  Sim (+9)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="nao" id="fssNao" className="border-[#1a472a] text-[#1a472a]" />
                <label htmlFor="fssNao" className="text-sm cursor-pointer text-gray-700">
                  Não
                </label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle icon={<Crosshair className="w-4 h-4" />} title="Meios" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">
              Posse de arma de fogo
            </Label>
            <Select value={form.posseArma} onValueChange={(v) => set("posseArma", v)}>
              <SelectTrigger className="border-2 focus:border-[#1a472a]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="registada">Registada (+8)</SelectItem>
                <SelectItem value="provavel">Provável (+6)</SelectItem>
                <SelectItem value="improvavel">Improvável (+2)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">
              Uso efetivo de arma de fogo
            </Label>
            <Select value={form.usoArma} onValueChange={(v) => set("usoArma", v)}>
              <SelectTrigger className="border-2 focus:border-[#1a472a]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="haRegisto">Há registo (+10)</SelectItem>
                <SelectItem value="naoHaRegisto">Não há registo (+3)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle icon={<MapPin className="w-4 h-4" />} title="Local" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">Tipologia</Label>
            <CheckItem
              id="apartamento"
              label="Apartamento (+3)"
              checked={form.tipologiaApartamento}
              onCheckedChange={(v) => {
                set("tipologiaApartamento", v);
                if (v) {
                  set("tipologiaMoradia", false);
                  set("tipologiaOutro", false);
                }
              }}
            />
            <CheckItem
              id="moradia"
              label="Moradia (+4)"
              checked={form.tipologiaMoradia}
              onCheckedChange={(v) => {
                set("tipologiaMoradia", v);
                if (v) {
                  set("tipologiaApartamento", false);
                  set("tipologiaOutro", false);
                }
              }}
            />
            <CheckItem
              id="outroLocal"
              label="Outro (+5)"
              checked={form.tipologiaOutro}
              onCheckedChange={(v) => {
                set("tipologiaOutro", v);
                if (v) {
                  set("tipologiaApartamento", false);
                  set("tipologiaMoradia", false);
                }
              }}
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">Contexto</Label>
            <CheckItem
              id="isoladoLocal"
              label="Isolado (+2)"
              checked={form.contextoIsolado}
              onCheckedChange={(v) => set("contextoIsolado", v)}
            />
            <CheckItem
              id="bairroSocial"
              label="Bairro social (+7)"
              checked={form.contextoBairroSocial}
              onCheckedChange={(v) => set("contextoBairroSocial", v)}
            />
            <CheckItem
              id="meioUrbano"
              label="Meio urbano (+5)"
              checked={form.contextoMeioUrbano}
              onCheckedChange={(v) => set("contextoMeioUrbano", v)}
            />
            <CheckItem
              id="meioRural"
              label="Meio rural (+3)"
              checked={form.contextoMeioRural}
              onCheckedChange={(v) => set("contextoMeioRural", v)}
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">
              Características de segurança
            </Label>
            <CheckItem
              id="caes"
              label="Cães (+4)"
              checked={form.segurancaCaes}
              onCheckedChange={(v) => set("segurancaCaes", v)}
            />
            <CheckItem
              id="portaBlindada"
              label="Porta blindada (+6)"
              checked={form.segurancaPortaBlindada}
              onCheckedChange={(v) => set("segurancaPortaBlindada", v)}
            />
            <CheckItem
              id="outrasMedidas"
              label="Outras medidas (+5)"
              checked={form.segurancaOutrasMedidas}
              onCheckedChange={(v) => set("segurancaOutrasMedidas", v)}
            />
          </div>
        </div>
      </Section>

      <Section>
        <Label className="text-sm font-semibold text-gray-600 mb-1 block">Observações</Label>
        <Textarea
          placeholder="Observações sobre o local..."
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          className="min-h-[80px] border-2 focus:border-[#1a472a]"
        />
      </Section>

      <Section>
        <SectionTitle icon={<ClipboardList className="w-4 h-4" />} title="Avaliação" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">
              Avaliador (posto e nome)
            </Label>
            <Input
              placeholder="Posto e nome do avaliador"
              value={form.avaliador}
              onChange={(e) => set("avaliador", e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">Data</Label>
            <Input
              type="date"
              value={form.dataAvaliacao}
              onChange={(e) => set("dataAvaliacao", e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-1 block">
              NEOP manual (sobrepõe-se ao calculado)
            </Label>
            <Select value={form.neopManual} onValueChange={(v) => set("neopManual", v)}>
              <SelectTrigger className="border-2 focus:border-[#1a472a]">
                <SelectValue placeholder="Usar NEOP calculado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2º NEOP">2º NEOP</SelectItem>
                <SelectItem value="3º NEOP">3º NEOP</SelectItem>
                <SelectItem value="4º NEOP">4º NEOP</SelectItem>
              </SelectContent>
            </Select>
            {form.neopManual ? (
              <button
                type="button"
                onClick={() => set("neopManual", "")}
                className="text-xs text-gray-500 underline mt-1"
              >
                Voltar ao NEOP calculado
              </button>
            ) : null}
          </div>
        </div>
        <div className="mb-4">
          <Label className="text-sm font-semibold text-gray-600 mb-1 block">
            Outras observações
          </Label>
          <Textarea
            placeholder="Outras observações..."
            value={form.outrasObservacoes}
            onChange={(e) => set("outrasObservacoes", e.target.value)}
            className="min-h-[80px] border-2 focus:border-[#1a472a]"
          />
        </div>
        <div>
          <Label className="text-sm font-semibold text-gray-600 mb-1 block">Parecer</Label>
          <Textarea
            placeholder="Parecer do avaliador..."
            value={form.parecer}
            onChange={(e) => set("parecer", e.target.value)}
            className="min-h-[80px] border-2 focus:border-[#1a472a]"
          />
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div
          className="text-white text-center py-5 px-4 rounded-xl"
          style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)" }}
        >
          <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Pontuação total</p>
          <p className="text-4xl font-bold">
            {pontuacao}
            <span className="text-xl font-normal opacity-70">/100</span>
          </p>
        </div>
        <div
          className="text-white text-center py-5 px-4 rounded-xl"
          style={{ background: `linear-gradient(135deg, ${neopColor} 0%, ${neopColor}cc 100%)` }}
        >
          <p className="text-xs uppercase tracking-widest opacity-80 mb-1">
            {form.neopManual ? "Classificação manual" : "Classificação recomendada"}
          </p>
          <p className="text-3xl font-bold">{neop}</p>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Grau de complexidade</p>
          <span
            className="text-sm font-bold px-3 py-1 rounded-full"
            style={{
              background:
                neop === "4º NEOP" ? "#fee2e2" : neop === "3º NEOP" ? "#fef3c7" : "#dcfce7",
              color: neop === "4º NEOP" ? "#991b1b" : neop === "3º NEOP" ? "#92400e" : "#166534",
            }}
          >
            {complexidade}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: neop === "4º NEOP" ? "100%" : neop === "3º NEOP" ? "66%" : "33%",
              background:
                neop === "4º NEOP" ? "#dc2626" : neop === "3º NEOP" ? "#f59e0b" : "#22c55e",
            }}
          />
        </div>
        <p className="text-sm text-gray-600">{descricao}</p>
      </div>

    </>
  );
}
