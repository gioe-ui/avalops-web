-- =============================================================================
-- GIOE — Sistema de Avaliação de Pedidos de Apoio
-- Esquema PostgreSQL para Supabase
--
-- Executar no SQL Editor do Supabase, por ordem:
--   01_schema.sql   <-- este ficheiro
--   02_policies.sql
--   03_seed_admin.sql
--
-- Nota sobre nomes de colunas: são mantidos em camelCase entre aspas para que
-- o código do frontend use exatamente os mesmos nomes de campo da aplicação
-- original. É deliberado — evita uma camada de mapeamento em 21 páginas.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Substitui a tabela `users`. A identidade e a password são geridas pelo
-- Supabase Auth (auth.users); aqui ficam apenas os dados de perfil do militar.
create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  "name"                text,
  email                 varchar(320) not null,
  "role"                text not null default 'user' check ("role" in ('user', 'admin')),
  approved              smallint not null default 0,
  "phoneNumber"         varchar(20),
  "mecanographicNumber" varchar(10),
  "rank"                varchar(50),
  "createdAt"           timestamptz not null default now(),
  "updatedAt"           timestamptz not null default now(),
  "lastSignedIn"        timestamptz not null default now()
);

create index if not exists profiles_approved_idx on public.profiles (approved);
create index if not exists profiles_role_idx on public.profiles ("role");

-- ─── evaluations ─────────────────────────────────────────────────────────────
create table if not exists public.evaluations (
  id                             integer generated always as identity primary key,
  "userId"                       uuid not null references public.profiles (id) on delete cascade,

  -- Identificação do pedido
  "cterRequerente"               varchar(50),
  nuipc                          varchar(50),
  "entidadeSolicitadora"         varchar(100),
  "refFiledoc"                   varchar(255),
  email                          varchar(320),
  "ordemVerbal"                  varchar(255),

  -- POC / despacho
  "pocPosto"                     varchar(255),
  "pocNome"                      varchar(255),
  "pocContacto"                  varchar(255),
  despacho                       text,

  -- Mandados
  "mandadoDetencao"              smallint default 0,
  "mandadoBusca"                 smallint default 0,

  -- Suspeitos
  "quantidadeSuspeitos"          varchar(10),
  "modalidadeIsolado"            smallint default 0,
  "modalidadeAssociacao"         smallint default 0,

  -- Atividade criminal
  "tipoCriminal"                 varchar(255),
  "antecedentesContraPessoas"    smallint default 0,
  "antecedentesContraPatrimonio" smallint default 0,
  "antecedentesOutros"           smallint default 0,
  "antecedentesFss"              varchar(10),

  -- Meios
  "posseArma"                    varchar(50),
  "usoArma"                      varchar(50),

  -- Tipologia do local
  "tipologiaApartamento"         smallint default 0,
  "tipologiaMoradia"             smallint default 0,
  "tipologiaOutro"               smallint default 0,

  -- Contexto
  "contextoIsolado"              smallint default 0,
  "contextoBairroSocial"         smallint default 0,
  "contextoMeioUrbano"           smallint default 0,
  "contextoMeioRural"            smallint default 0,

  -- Medidas de segurança
  "segurancaCaes"                smallint default 0,
  "segurancaPortaBlindada"       smallint default 0,
  "segurancaOutrasMedidas"       smallint default 0,

  -- Parecer
  avaliador                      varchar(255),
  "dataAvaliacao"                varchar(20),
  parecer                        text,
  observacoes                    text,
  "outrasObservacoes"            text,

  -- Resultado (pontuacao e neop são calculados por trigger — ver 03_scoring.sql)
  pontuacao                      integer not null default 0,
  neop                           varchar(20) not null default '2º NEOP',
  "neopManual"                   varchar(20),

  -- Auditoria
  "updatedBy"                    text,
  "updatedAt"                    timestamptz default now(),
  "createdAt"                    timestamptz not null default now()
);

create index if not exists evaluations_user_idx on public.evaluations ("userId");
create index if not exists evaluations_neop_idx on public.evaluations (neop);
create index if not exists evaluations_cter_idx on public.evaluations ("cterRequerente");
create index if not exists evaluations_created_idx on public.evaluations ("createdAt");

-- ─── suspects ────────────────────────────────────────────────────────────────
create table if not exists public.suspects (
  id               integer generated always as identity primary key,
  "evaluationId"   integer not null references public.evaluations (id) on delete cascade,
  nome             varchar(255),
  "dataNascimento" varchar(20),
  nacionalidade    varchar(100),
  nif              varchar(20),
  cc               varchar(20),
  morada           text,
  observacoes      text,
  "createdAt"      timestamptz not null default now()
);

create index if not exists suspects_evaluation_idx on public.suspects ("evaluationId");
create index if not exists suspects_nome_idx on public.suspects (nome);

-- ─── operations ──────────────────────────────────────────────────────────────
create table if not exists public.operations (
  id                                    integer generated always as identity primary key,
  "evaluationId"                        integer not null references public.evaluations (id) on delete cascade,
  "userId"                              uuid references public.profiles (id) on delete set null,

  "refFiledoc"                          varchar(255),
  "operacaoNumero"                      varchar(50),
  "preenchimentoSecOp"                  varchar(50),
  "cmdtOp"                              varchar(255),
  "dataOp"                              varchar(20),
  "tipoEmpenho"                         varchar(50),
  missao                                text,
  "entidadeSolicitadora"                varchar(50),
  "local"                               text,

  -- Reunião
  "obsReuniao"                          text,
  "gdhSaidaUi"                          varchar(50),
  "gdhEntradaUi"                        varchar(50),
  "cmdtForcaReuniao"                    varchar(255),
  "indicativoRadioReuniao"              varchar(50),
  "efetivTotalReuniao"                  varchar(50),
  "viaturasCaracterizadasReuniao"       smallint default 0,
  "viaturasDescaracterizadasReuniao"    smallint default 0,
  "viaturasEspeciaisReuniao"            smallint default 0,
  "kmTotaisReuniao"                     varchar(50),

  -- Operação
  "cterOperacao"                        varchar(255),
  "dterOperacao"                        varchar(255),
  "pterZaOperacao"                      varchar(255),
  "gdhInicioOperacao"                   varchar(50),
  "gdhChegadaUiOperacao"                varchar(50),
  "cmdtForcaOperacao"                   varchar(255),
  "indicativoRadioOperacao"             varchar(50),
  "efetivTotalOperacao"                 varchar(50),
  "viaturasCaracterizadasOperacao"      smallint default 0,
  "viaturasDescaracterizadasOperacao"   smallint default 0,
  "viaturasEspeciaisOperacao"           smallint default 0,
  "kmTotaisOperacao"                    varchar(50),

  -- ITP
  "itpTipo"                             varchar(50),
  "gdhInicioItp"                        varchar(50),
  "gdhFimItp"                           varchar(50),
  "forcaTitularInqueritos"              smallint default 0,

  -- Custos
  "custosPortagens"                     text,
  "custosCombustiveis"                  text,
  "obsVisados"                          text,

  -- Consumos
  "municoesArmasAuto762"                integer default 0,
  "municoesArmasAuto9Mm"                integer default 0,
  "municoesArmasAuto762Mm"              integer default 0,
  "municoesArmasAuto556Mm"              integer default 0,
  "municoesArmasAuto556"                integer default 0,
  "municoesCacadeiraBarracha"           integer default 0,
  "municoesCacadeiraChumbo"             integer default 0,
  "municoesCacadeiraBeamBag"            integer default 0,
  "municoesCacadeiraZagalote"           integer default 0,
  "municoesCacadeiraZinco"              integer default 0,
  "municoesRevolverAsp"                 integer default 0,
  "taserCargaX26"                       integer default 0,
  "taserGranadaFlashBang1Estalo"        integer default 0,
  "taserGranadaFlashBang1Estalo2Bang"   integer default 0,
  "taserGranadaFlashBang2Estalos2Bangs" integer default 0,
  "taserGranadaFlashBangMultiplos"      integer default 0,
  "taserAlgemas"                        varchar(50),
  "obsConsumos"                         text,

  -- SEC Op
  "obsSecOp"                            text,
  "regSecOp"                            varchar(255),
  "excelSecOp"                          smallint default 0,
  "apontamentosNotas"                   text,
  croquis                               text,

  -- Atribuição e estado
  "assignedUserId"                      uuid references public.profiles (id) on delete set null,
  "scheduledDate"                       varchar(20),
  "operacaoPreenchida"                  smallint not null default 0,
  "consumosPreenchidos"                 smallint not null default 0,
  "observacoesPreenchidas"              smallint not null default 0,
  "flaggedForCompletion"                smallint not null default 0,
  "flaggedAt"                           timestamptz,

  "createdAt"                           timestamptz not null default now()
);

create index if not exists operations_evaluation_idx on public.operations ("evaluationId");
create index if not exists operations_assigned_idx on public.operations ("assignedUserId");
create index if not exists operations_flagged_idx on public.operations ("flaggedForCompletion");

-- ─── notifications ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id             integer generated always as identity primary key,
  "operationId"  integer not null references public.operations (id) on delete cascade,
  "userId"       uuid not null references public.profiles (id) on delete cascade,
  "phoneNumber"  varchar(20) not null,
  message        text not null,
  "whatsappLink" text not null,
  sent           smallint not null default 0,
  "sentAt"       timestamptz,
  "createdAt"    timestamptz not null default now()
);

create index if not exists notifications_operation_idx on public.notifications ("operationId");

-- ─── updatedAt automático ────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─── Restrição de domínio + criação automática do perfil ─────────────────────
-- Substitui o `emailValidator` do Zod. Ao contrário da validação no formulário,
-- esta corre na base de dados e não pode ser contornada pelo cliente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or lower(new.email) not like '%@gnr.pt' then
    raise exception 'O registo está restrito a endereços @gnr.pt';
  end if;

  insert into public.profiles (id, email, "name", "phoneNumber", "mecanographicNumber", "rank")
  values (
    new.id,
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'phoneNumber', ''),
    nullif(new.raw_user_meta_data ->> 'mecanographicNumber', ''),
    nullif(new.raw_user_meta_data ->> 'rank', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
