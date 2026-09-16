-- =============================================================================
-- GIOE — Cálculo da pontuação de risco e classificação NEOP
--
-- Porta a função calcScore() que vivia em server/routers.ts. Sem servidor
-- próprio, o cálculo passa a correr na base de dados por trigger: assim o
-- cliente não consegue gravar uma pontuação ou um NEOP arbitrários, mesmo
-- chamando a API do Supabase diretamente.
--
-- O mesmo cálculo existe também em TypeScript (client/src/lib/scoring.ts) para
-- a pré-visualização em tempo real no formulário. As duas implementações têm
-- de ser mantidas em sincronia — há um teste que compara as duas.
-- =============================================================================

create or replace function public.gioe_calc_score(e public.evaluations)
returns table (pontuacao integer, neop varchar(20))
language plpgsql
immutable
as $$
declare
  s              integer := 0;
  tipos          text[];
  tipo           text;
  tip_max        integer := 0;
  ctx_max        integer := 0;
  total          integer;
  classificacao  varchar(20);
  tem_crime_grave boolean := false;
  tem_arma_registada boolean;
  tem_arma_provavel  boolean;
  tem_uso_arma       boolean;
  tem_antec_fss      boolean;
begin
  -- Mandados
  if coalesce(e."mandadoDetencao", 0) <> 0 then s := s + 5; end if;
  if coalesce(e."mandadoBusca", 0) <> 0 then s := s + 3; end if;

  -- Quantidade de suspeitos
  s := s + case coalesce(e."quantidadeSuspeitos", '1')
             when '1'  then 1
             when '2'  then 2
             when '3'  then 4
             when '4+' then 6
             else 1
           end;

  -- Modalidade
  if coalesce(e."modalidadeIsolado", 0) <> 0 then s := s + 2; end if;
  if coalesce(e."modalidadeAssociacao", 0) <> 0 then s := s + 8; end if;

  -- Tipo(s) de crime — podem vir vários separados por vírgula, e somam-se
  tipos := string_to_array(coalesce(nullif(trim(e."tipoCriminal"), ''), 'outro'), ',');
  foreach tipo in array tipos loop
    tipo := trim(tipo);
    if tipo = '' then continue; end if;
    s := s + case tipo
               when 'trafico'   then 7
               when 'assalto'   then 6
               when 'homicidio' then 10
               when 'sequestro' then 9
               when 'violencia' then 8
               else 4
             end;
    if tipo in ('homicidio', 'sequestro', 'violencia') then
      tem_crime_grave := true;
    end if;
  end loop;

  -- Antecedentes
  if coalesce(e."antecedentesContraPessoas", 0) <> 0 then s := s + 8; end if;
  if coalesce(e."antecedentesContraPatrimonio", 0) <> 0 then s := s + 5; end if;
  if coalesce(e."antecedentesOutros", 0) <> 0 then s := s + 3; end if;
  if e."antecedentesFss" = 'sim' then s := s + 9; end if;

  -- Armas
  s := s + case coalesce(e."posseArma", 'improvavel')
             when 'registada'  then 8
             when 'provavel'   then 6
             when 'improvavel' then 2
             else 2
           end;
  s := s + case coalesce(e."usoArma", 'naoHaRegisto')
             when 'haRegisto'    then 10
             when 'naoHaRegisto' then 3
             else 3
           end;

  -- Tipologia do local: conta apenas o máximo
  if coalesce(e."tipologiaApartamento", 0) <> 0 then tip_max := greatest(tip_max, 3); end if;
  if coalesce(e."tipologiaMoradia", 0) <> 0     then tip_max := greatest(tip_max, 4); end if;
  if coalesce(e."tipologiaOutro", 0) <> 0       then tip_max := greatest(tip_max, 5); end if;
  s := s + tip_max;

  -- Contexto: conta apenas o máximo
  if coalesce(e."contextoIsolado", 0) <> 0      then ctx_max := greatest(ctx_max, 2); end if;
  if coalesce(e."contextoBairroSocial", 0) <> 0 then ctx_max := greatest(ctx_max, 7); end if;
  if coalesce(e."contextoMeioUrbano", 0) <> 0   then ctx_max := greatest(ctx_max, 5); end if;
  if coalesce(e."contextoMeioRural", 0) <> 0    then ctx_max := greatest(ctx_max, 3); end if;
  s := s + ctx_max;

  -- Medidas de segurança
  if coalesce(e."segurancaCaes", 0) <> 0          then s := s + 4; end if;
  if coalesce(e."segurancaPortaBlindada", 0) <> 0 then s := s + 6; end if;
  if coalesce(e."segurancaOutrasMedidas", 0) <> 0 then s := s + 5; end if;

  total := least(s, 100);

  classificacao := case
                     when total <= 25 then '2º NEOP'
                     when total <= 75 then '3º NEOP'
                     else '4º NEOP'
                   end;

  -- Critérios de elevação automática para 4º NEOP
  tem_arma_registada := e."posseArma" = 'registada';
  tem_arma_provavel  := e."posseArma" = 'provavel';
  tem_uso_arma       := e."usoArma" = 'haRegisto';
  tem_antec_fss      := e."antecedentesFss" = 'sim';

  -- 1: associação criminosa + posse ou probabilidade de arma de fogo
  if coalesce(e."modalidadeAssociacao", 0) <> 0
     and (tem_arma_registada or tem_arma_provavel) then
    classificacao := '4º NEOP';
  end if;

  -- 2: histórico de uso de arma de fogo + antecedentes de confronto com FSS
  if tem_uso_arma and tem_antec_fss then
    classificacao := '4º NEOP';
  end if;

  -- 3: arma registada + crime grave
  if tem_arma_registada and tem_crime_grave then
    classificacao := '4º NEOP';
  end if;

  -- 4: arma provável + uso com registo
  if tem_arma_provavel and tem_uso_arma then
    classificacao := '4º NEOP';
  end if;

  pontuacao := total;
  neop := classificacao;
  return next;
end;
$$;

-- ─── Trigger ─────────────────────────────────────────────────────────────────
-- Recalcula sempre, ignorando o que o cliente enviou nestes dois campos.
-- O NEOP manual continua a poder sobrepor-se, tal como na versão original,
-- mas apenas através da coluna dedicada "neopManual".

create or replace function public.evaluations_apply_score()
returns trigger
language plpgsql
as $$
declare
  calculado record;
begin
  select * into calculado from public.gioe_calc_score(new);

  new.pontuacao := calculado.pontuacao;
  new.neop := coalesce(nullif(new."neopManual", ''), calculado.neop);

  return new;
end;
$$;

drop trigger if exists evaluations_score on public.evaluations;
create trigger evaluations_score
  before insert or update on public.evaluations
  for each row execute function public.evaluations_apply_score();

-- ─── Auditoria de edição ─────────────────────────────────────────────────────
-- Substitui o `updatedBy` que era montado em server/routers.ts.

create or replace function public.evaluations_stamp_editor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  select "name", "rank" into p from public.profiles where id = auth.uid();
  if found then
    new."updatedBy" := coalesce(p."name", 'Desconhecido') || ' (' || coalesce(p."rank", 'N/D') || ')';
  end if;
  new."updatedAt" := now();
  return new;
end;
$$;

drop trigger if exists evaluations_stamp on public.evaluations;
create trigger evaluations_stamp
  before update on public.evaluations
  for each row execute function public.evaluations_stamp_editor();
