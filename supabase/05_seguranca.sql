-- =============================================================================
-- GIOE — Endurecimento de segurança
--
-- Executar no SQL Editor do Supabase DEPOIS de 01_schema.sql, 02_policies.sql
-- e 03_scoring.sql. Pode ser corrido mais de uma vez: cada passo verifica o
-- que já existe. Corre numa única transação — ou entra tudo, ou nada.
--
-- O que muda, em resumo:
--   1. Utilizadores desativam-se em vez de se eliminarem; o trabalho de um
--      militar nunca é apagado por causa da conta dele.
--   2. Autenticação de dois fatores (TOTP) obrigatória para ler ou escrever
--      dados.
--   3. Domínio @gnr.pt imposto também quando o email da conta muda.
--   4. Avaliações: data de criação, autor e "alterado por" definidos pelo
--      servidor; NEOP manual só aceita os três valores válidos.
--   5. Operações: só o autor da avaliação (ou um administrador) cria o
--      relatório; o autor e o militar atribuído preenchem-no; só
--      administradores mudam o dono, a avaliação e a atribuição. O estado de
--      preenchimento é calculado pelo servidor.
--   6. Notificações: geradas pelo servidor a partir da operação, só pelo autor
--      da avaliação ou por um administrador.
--   7. Nunca ficar sem administradores.
--   8. Registo de auditoria de todas as alterações, só legível por
--      administradores e imutável a partir da aplicação.
--   9. Gravação atómica de uma avaliação com os seus suspeitos.
-- =============================================================================

begin;

-- ─── 0. Funções existentes com search_path fixo ──────────────────────────────
-- Sem isto, uma função pode resolver nomes num esquema controlado por quem a
-- chama. É também o que o linter do Supabase assinala.
alter function public.touch_updated_at() set search_path = public;
alter function public.gioe_calc_score(public.evaluations) set search_path = public;
alter function public.evaluations_apply_score() set search_path = public;

-- ─── 1. Perfis: ativo / desativado ───────────────────────────────────────────
alter table public.profiles add column if not exists active smallint not null default 1;

do $$ begin
  alter table public.profiles add constraint profiles_active_chk check (active in (0, 1));
exception when duplicate_object then null; end $$;

-- ─── 2. Autenticação de dois fatores ─────────────────────────────────────────
-- O Supabase põe no token o nível de garantia da sessão: "aal1" depois da
-- password, "aal2" depois do código TOTP. Sem aal2 não há acesso a dados.
--
-- Para desligar temporariamente esta exigência (por exemplo, se o MFA estiver
-- desativado no projeto), substituir o corpo por `select true;`. Fica
-- registado aqui de propósito, para não ser feito às escondidas.
create or replace function public.mfa_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mfa_ok() and exists (
    select 1 from public.profiles
    where id = auth.uid() and approved = 1 and active = 1
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mfa_ok() and exists (
    select 1 from public.profiles
    where id = auth.uid() and approved = 1 and active = 1 and "role" = 'admin'
  );
$$;

revoke execute on function public.mfa_ok() from public, anon;
revoke execute on function public.is_approved() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.mfa_ok() to authenticated;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ─── 3. O trabalho de um militar não se apaga com a conta dele ───────────────
-- Antes, eliminar um perfil apagava em cascata as avaliações, os suspeitos e as
-- operações dessa pessoa. Agora a eliminação é recusada enquanto houver
-- registos ligados; o caminho normal é desativar a conta.
--
-- Os nomes das restrições mantêm-se, porque a aplicação os usa nas consultas
-- (profiles!operations_assignedUserId_fkey).
alter table public.evaluations drop constraint if exists "evaluations_userId_fkey";
alter table public.evaluations
  add constraint "evaluations_userId_fkey"
  foreign key ("userId") references public.profiles (id) on delete restrict;

alter table public.operations drop constraint if exists "operations_userId_fkey";
alter table public.operations
  add constraint "operations_userId_fkey"
  foreign key ("userId") references public.profiles (id) on delete restrict;

alter table public.operations drop constraint if exists "operations_assignedUserId_fkey";
alter table public.operations
  add constraint "operations_assignedUserId_fkey"
  foreign key ("assignedUserId") references public.profiles (id) on delete restrict;

alter table public.notifications drop constraint if exists "notifications_userId_fkey";
alter table public.notifications
  add constraint "notifications_userId_fkey"
  foreign key ("userId") references public.profiles (id) on delete restrict;

-- Só se elimina um registo por aprovar (é o "rejeitar"). Contas aprovadas
-- desativam-se.
drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin() and approved = 0 and id <> auth.uid());

-- O próprio perfil só se edita depois do segundo fator; os administradores
-- editam qualquer um.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using ((id = auth.uid() and public.mfa_ok()) or public.is_admin())
  with check ((id = auth.uid() and public.mfa_ok()) or public.is_admin());

-- ─── 4. Privilégios dos perfis ───────────────────────────────────────────────
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.id := old.id;
  new."createdAt" := old."createdAt";

  -- A hora da última entrada é a do servidor, não a que o cliente disser.
  if new."lastSignedIn" is distinct from old."lastSignedIn" then
    new."lastSignedIn" := now();
  end if;

  -- auth.uid() nulo: pedido do lado do servidor (SQL Editor, migração, ou o
  -- próprio Supabase Auth a sincronizar o email). O `anon` não chega aqui.
  if auth.uid() is null then
    return new;
  end if;

  -- O email só muda pela conta de autenticação: a cópia para o perfil é feita
  -- pelo trigger handle_user_email_sync, ou seja, de dentro de outro trigger
  -- (pg_trigger_depth() > 1). Um pedido do cliente chega sempre com
  -- profundidade 1.
  if new.email is distinct from old.email and pg_trigger_depth() <= 1 then
    raise exception 'O email não pode ser alterado';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new."role" is distinct from old."role" then
    raise exception 'Apenas administradores podem alterar o papel de um utilizador';
  end if;

  if new.approved is distinct from old.approved then
    raise exception 'Apenas administradores podem aprovar utilizadores';
  end if;

  if new.active is distinct from old.active then
    raise exception 'Apenas administradores podem ativar ou desativar utilizadores';
  end if;

  return new;
end;
$$;

-- Nunca ficar sem nenhum administrador ativo.
create or replace function public.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old."role" = 'admin' and old.approved = 1 and old.active = 1
     and (tg_op = 'DELETE' or not (new."role" = 'admin' and new.approved = 1 and new.active = 1))
     and not exists (
       select 1 from public.profiles
       where "role" = 'admin' and approved = 1 and active = 1 and id <> old.id
     )
  then
    raise exception 'Não é possível retirar o último administrador ativo';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_last_admin on public.profiles;
create trigger profiles_guard_last_admin
  before update or delete on public.profiles
  for each row execute function public.guard_last_admin();

-- ─── 5. Domínio @gnr.pt, no registo e na mudança de email ────────────────────
create or replace function public.gioe_email_valido(e text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select e is not null and lower(e) ~ '^[^@[:space:]]+@gnr\.pt$';
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.gioe_email_valido(new.email) then
    raise exception 'O registo está restrito a endereços @gnr.pt';
  end if;

  insert into public.profiles (id, email, "name", "phoneNumber", "mecanographicNumber", "rank")
  values (
    new.id,
    lower(new.email),
    left(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 200),
    left(nullif(btrim(new.raw_user_meta_data ->> 'phoneNumber'), ''), 20),
    left(nullif(btrim(new.raw_user_meta_data ->> 'mecanographicNumber'), ''), 10),
    left(nullif(btrim(new.raw_user_meta_data ->> 'rank'), ''), 50)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_user_email_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email and not public.gioe_email_valido(new.email) then
    raise exception 'O email da conta tem de ser um endereço @gnr.pt';
  end if;
  return new;
end;
$$;

create or replace function public.handle_user_email_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_auth_user_email_check on auth.users;
create trigger on_auth_user_email_check
  before update of email on auth.users
  for each row execute function public.handle_user_email_check();

drop trigger if exists on_auth_user_email_sync on auth.users;
create trigger on_auth_user_email_sync
  after update of email on auth.users
  for each row execute function public.handle_user_email_sync();

-- ─── 6. Avaliações ───────────────────────────────────────────────────────────
do $$ begin
  -- NOT VALID: não rejeita registos antigos, mas toda a escrita nova é
  -- verificada.
  alter table public.evaluations
    add constraint evaluations_neop_manual_chk
    check ("neopManual" is null or "neopManual" in ('2º NEOP', '3º NEOP', '4º NEOP'))
    not valid;
exception when duplicate_object then null; end $$;

-- Substitui evaluations_stamp_editor (03_scoring.sql): passa a correr também
-- na criação, e a data de criação deixa de vir do cliente.
create or replace function public.evaluations_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  new."neopManual" := nullif(btrim(new."neopManual"), '');

  if tg_op = 'INSERT' then
    new."createdAt" := now();
    -- O autor é quem está autenticado. Um valor diferente é recusado pela
    -- política evaluations_insert.
    new."userId" := coalesce(new."userId", auth.uid());
    new."updatedBy" := null;
  else
    new."createdAt" := old."createdAt";
    if new."userId" is distinct from old."userId"
       and auth.uid() is not null and not public.is_admin() then
      raise exception 'Apenas administradores podem mudar o autor de uma avaliação';
    end if;
  end if;

  new."updatedAt" := now();

  select "name", "rank" into p from public.profiles where id = auth.uid();
  if found then
    new."updatedBy" := coalesce(p."name", 'Desconhecido') || ' (' || coalesce(p."rank", 'N/D') || ')';
  end if;

  return new;
end;
$$;

drop trigger if exists evaluations_stamp on public.evaluations;
drop trigger if exists evaluations_guard on public.evaluations;
-- O nome garante que corre antes de evaluations_score (ordem alfabética), para
-- que o NEOP manual já chegue normalizado ao cálculo.
create trigger evaluations_guard
  before insert or update on public.evaluations
  for each row execute function public.evaluations_guard();

drop function if exists public.evaluations_stamp_editor();

-- ─── 7. Operações ────────────────────────────────────────────────────────────
-- Uma avaliação tem, no máximo, um relatório de operação. Se já houver
-- duplicados, o índice não é criado e fica um aviso: resolver primeiro com a
-- consulta que está no README.
do $$
begin
  if exists (
    select 1 from public.operations group by "evaluationId" having count(*) > 1
  ) then
    raise warning 'Há avaliações com mais de um relatório de operação. O índice único operations_evaluation_unique NÃO foi criado.';
  else
    create unique index if not exists operations_evaluation_unique
      on public.operations ("evaluationId");
  end if;
end $$;

drop policy if exists operations_insert on public.operations;
create policy operations_insert on public.operations
  for insert to authenticated
  with check (
    public.is_approved() and (
      public.is_admin()
      or exists (
        select 1 from public.evaluations e
        where e.id = operations."evaluationId" and e."userId" = auth.uid()
      )
    )
  );

drop policy if exists operations_update on public.operations;
create policy operations_update on public.operations
  for update to authenticated
  using (
    public.is_approved() and (
      public.is_admin()
      or operations."assignedUserId" = auth.uid()
      or exists (
        select 1 from public.evaluations e
        where e.id = operations."evaluationId" and e."userId" = auth.uid()
      )
    )
  )
  with check (
    public.is_approved() and (
      public.is_admin()
      or operations."assignedUserId" = auth.uid()
      or exists (
        select 1 from public.evaluations e
        where e.id = operations."evaluationId" and e."userId" = auth.uid()
      )
    )
  );

drop policy if exists operations_delete on public.operations;
create policy operations_delete on public.operations
  for delete to authenticated
  using (
    public.is_approved() and (
      public.is_admin()
      or exists (
        select 1 from public.evaluations e
        where e.id = operations."evaluationId" and e."userId" = auth.uid()
      )
    )
  );

create or replace function public.operations_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  servidor_ou_admin boolean := auth.uid() is null or public.is_admin();
  preenchido text;
begin
  if tg_op = 'INSERT' then
    new."createdAt" := now();
    if auth.uid() is not null then
      new."userId" := auth.uid();
    end if;
    if not servidor_ou_admin then
      if new."assignedUserId" is not null or new."scheduledDate" is not null then
        raise exception 'Apenas administradores atribuem operações';
      end if;
      new."flaggedForCompletion" := 0;
      new."flaggedAt" := null;
    end if;
  else
    new."createdAt" := old."createdAt";
    if not servidor_ou_admin then
      if new."userId" is distinct from old."userId"
         or new."evaluationId" is distinct from old."evaluationId" then
        raise exception 'Apenas administradores podem mudar o autor ou a avaliação de uma operação';
      end if;
      if new."assignedUserId" is distinct from old."assignedUserId"
         or new."scheduledDate" is distinct from old."scheduledDate" then
        raise exception 'Apenas administradores atribuem operações';
      end if;
      if new."flaggedForCompletion" is distinct from old."flaggedForCompletion"
         or new."flaggedAt" is distinct from old."flaggedAt" then
        raise exception 'Apenas administradores sinalizam operações';
      end if;
    end if;
  end if;

  if new."assignedUserId" is not null
     and (tg_op = 'INSERT' or new."assignedUserId" is distinct from old."assignedUserId")
     and not exists (
       select 1 from public.profiles
       where id = new."assignedUserId" and approved = 1 and active = 1
     )
  then
    raise exception 'O militar atribuído tem de ser um utilizador aprovado e ativo';
  end if;

  -- Estado de preenchimento: calculado aqui, para que todas as páginas (e
  -- qualquer chamada direta à API) deem o mesmo resultado.
  new."operacaoPreenchida" := case when
      coalesce(btrim(new."cterOperacao"), '') <> ''
      or coalesce(btrim(new."dterOperacao"), '') <> ''
      or coalesce(btrim(new."pterZaOperacao"), '') <> ''
      or coalesce(btrim(new."gdhInicioOperacao"), '') <> ''
    then 1 else 0 end;

  -- Uma operação sem consumos também fica preenchida se isso for dito nas
  -- observações de consumos ("sem consumos").
  new."consumosPreenchidos" := case when
      coalesce((
        select bool_or(coalesce(v, 0) > 0)
        from unnest(array[
          new."municoesArmasAuto762", new."municoesArmasAuto9Mm",
          new."municoesArmasAuto762Mm", new."municoesArmasAuto556Mm",
          new."municoesArmasAuto556", new."municoesCacadeiraBarracha",
          new."municoesCacadeiraChumbo", new."municoesCacadeiraBeamBag",
          new."municoesCacadeiraZagalote", new."municoesCacadeiraZinco",
          new."municoesRevolverAsp", new."taserCargaX26",
          new."taserGranadaFlashBang1Estalo", new."taserGranadaFlashBang1Estalo2Bang",
          new."taserGranadaFlashBang2Estalos2Bangs", new."taserGranadaFlashBangMultiplos"
        ]) as v
      ), false)
      or coalesce(btrim(new."taserAlgemas"), '') <> ''
      or coalesce(btrim(new."obsConsumos"), '') <> ''
    then 1 else 0 end;

  new."observacoesPreenchidas" := case when
      coalesce(btrim(new."obsSecOp"), '') <> ''
      or coalesce(btrim(new."apontamentosNotas"), '') <> ''
    then 1 else 0 end;

  -- Relatório completo deixa de estar sinalizado.
  if new."operacaoPreenchida" = 1 and new."consumosPreenchidos" = 1
     and new."observacoesPreenchidas" = 1 then
    new."flaggedForCompletion" := 0;
    new."flaggedAt" := null;
  end if;

  return new;
end;
$$;

drop trigger if exists operations_guard on public.operations;
create trigger operations_guard
  before insert or update on public.operations
  for each row execute function public.operations_guard();

do $$ begin
  alter table public.operations
    add constraint operations_consumos_nao_negativos_chk check (
      coalesce("municoesArmasAuto762", 0) >= 0 and coalesce("municoesArmasAuto9Mm", 0) >= 0
      and coalesce("municoesArmasAuto762Mm", 0) >= 0 and coalesce("municoesArmasAuto556Mm", 0) >= 0
      and coalesce("municoesArmasAuto556", 0) >= 0 and coalesce("municoesCacadeiraBarracha", 0) >= 0
      and coalesce("municoesCacadeiraChumbo", 0) >= 0 and coalesce("municoesCacadeiraBeamBag", 0) >= 0
      and coalesce("municoesCacadeiraZagalote", 0) >= 0 and coalesce("municoesCacadeiraZinco", 0) >= 0
      and coalesce("municoesRevolverAsp", 0) >= 0 and coalesce("taserCargaX26", 0) >= 0
      and coalesce("taserGranadaFlashBang1Estalo", 0) >= 0
      and coalesce("taserGranadaFlashBang1Estalo2Bang", 0) >= 0
      and coalesce("taserGranadaFlashBang2Estalos2Bangs", 0) >= 0
      and coalesce("taserGranadaFlashBangMultiplos", 0) >= 0
      and coalesce("viaturasCaracterizadasReuniao", 0) >= 0
      and coalesce("viaturasDescaracterizadasReuniao", 0) >= 0
      and coalesce("viaturasEspeciaisReuniao", 0) >= 0
      and coalesce("viaturasCaracterizadasOperacao", 0) >= 0
      and coalesce("viaturasDescaracterizadasOperacao", 0) >= 0
      and coalesce("viaturasEspeciaisOperacao", 0) >= 0
      and coalesce("forcaTitularInqueritos", 0) >= 0
    ) not valid;
exception when duplicate_object then null; end $$;

-- ─── 7b. Suspeitos ───────────────────────────────────────────────────────────
-- Data de criação definida pelo servidor, e no máximo 50 suspeitos por
-- avaliação em QUALQUER caminho de escrita (a gravação atómica já o verificava,
-- mas a escrita direta na tabela continua a ser possível para o autor).
create or replace function public.suspects_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new."createdAt" := now();
  else
    new."createdAt" := old."createdAt";
  end if;
  return new;
end;
$$;

drop trigger if exists suspects_guard on public.suspects;
create trigger suspects_guard
  before insert or update on public.suspects
  for each row execute function public.suspects_guard();

-- Por instrução e depois de escrita: vê o lote inteiro de uma vez (um INSERT
-- com 200 linhas é recusado como um todo).
create or replace function public.suspects_limite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.suspects s
    where s."evaluationId" in (select distinct "evaluationId" from novas)
    group by s."evaluationId"
    having count(*) > 50
  ) then
    raise exception 'Demasiados suspeitos numa só avaliação (máximo 50)';
  end if;
  return null;
end;
$$;

drop trigger if exists suspects_limite_insert on public.suspects;
create trigger suspects_limite_insert
  after insert on public.suspects
  referencing new table as novas
  for each statement execute function public.suspects_limite();

drop trigger if exists suspects_limite_update on public.suspects;
create trigger suspects_limite_update
  after update on public.suspects
  referencing new table as novas
  for each statement execute function public.suspects_limite();

-- ─── 8. Notificações ─────────────────────────────────────────────────────────
-- O cliente envia apenas a operação. O militar, o telefone, a mensagem e a
-- ligação wa.me são preenchidos aqui, a partir dos dados gravados — não há
-- como registar uma notificação para outra pessoa nem com outra ligação.

create or replace function public.gioe_urlencode(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(string_agg(
    case
      when b between 48 and 57 or b between 65 and 90 or b between 97 and 122
           or b in (45, 46, 95, 126)
        then chr(b)
      else '%' || upper(lpad(to_hex(b), 2, '0'))
    end, '' order by i), '')
  from (
    select i, get_byte(convert_to(t, 'UTF8'), i) as b
    from generate_series(0, octet_length(convert_to(t, 'UTF8')) - 1) as i
  ) as bytes;
$$;

create or replace function public.notifications_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  op record;
  militar record;
  telefone text;
  data_prevista text;
begin
  if tg_op = 'UPDATE' then
    if new."operationId" is distinct from old."operationId"
       or new."userId" is distinct from old."userId"
       or new."phoneNumber" is distinct from old."phoneNumber"
       or new.message is distinct from old.message
       or new."whatsappLink" is distinct from old."whatsappLink" then
      raise exception 'Uma notificação registada não pode ser alterada';
    end if;
    new."createdAt" := old."createdAt";
    if new.sent = 1 and coalesce(old.sent, 0) = 0 then
      new."sentAt" := now();
    elsif new.sent is distinct from old.sent then
      new."sentAt" := null;
    else
      new."sentAt" := old."sentAt";
    end if;
    return new;
  end if;

  select o.id, o."assignedUserId", o."scheduledDate" into op
  from public.operations o where o.id = new."operationId";
  if not found then
    raise exception 'Operação inexistente';
  end if;
  if op."assignedUserId" is null then
    raise exception 'A operação não tem militar atribuído';
  end if;

  select "name", "rank", "phoneNumber" into militar
  from public.profiles where id = op."assignedUserId";

  telefone := regexp_replace(coalesce(militar."phoneNumber", ''), '[^0-9]', '', 'g');
  if telefone = '' then
    raise exception 'O militar atribuído não tem telefone registado';
  end if;
  -- Números nacionais de 9 dígitos levam o indicativo de Portugal.
  if length(telefone) = 9 then
    telefone := '351' || telefone;
  end if;

  data_prevista := case
    when op."scheduledDate" ~ '^\d{4}-\d{2}-\d{2}$'
      then to_char(op."scheduledDate"::date, 'DD/MM/YYYY')
    else coalesce(op."scheduledDate", 'a definir')
  end;

  new."userId" := op."assignedUserId";
  new."phoneNumber" := left(coalesce(militar."phoneNumber", telefone), 20);
  new.message :=
    'Olá ' || btrim(coalesce(militar."rank", '') || ' ' || coalesce(militar."name", '')) || ',' || E'\n\n' ||
    'Foi-lhe atribuída uma operação GIOE para a data de ' || data_prevista || '.' || E'\n\n' ||
    'Por favor, preencha o relatório da operação no sistema.' || E'\n\n' ||
    'Obrigado!';
  new."whatsappLink" := 'https://wa.me/' || telefone || '?text=' || public.gioe_urlencode(new.message);
  new.sent := 0;
  new."sentAt" := null;
  new."createdAt" := now();

  return new;
end;
$$;

drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard
  before insert or update on public.notifications
  for each row execute function public.notifications_guard();

do $$ begin
  alter table public.notifications
    add constraint notifications_link_chk
    check ("whatsappLink" ~ '^https://wa\.me/[0-9]+\?text=')
    not valid;
exception when duplicate_object then null; end $$;

-- Quem regista a notificação (autor da avaliação) tem de a conseguir ler de
-- volta — o pedido de criação devolve a ligação gerada.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    public.is_approved() and (
      notifications."userId" = auth.uid()
      or public.is_admin()
      or exists (
        select 1
        from public.operations o
        join public.evaluations e on e.id = o."evaluationId"
        where o.id = notifications."operationId" and e."userId" = auth.uid()
      )
    )
  );

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (
    public.is_approved() and exists (
      select 1
      from public.operations o
      join public.evaluations e on e.id = o."evaluationId"
      where o.id = notifications."operationId"
        and o."assignedUserId" = notifications."userId"
        and (public.is_admin() or e."userId" = auth.uid())
    )
  );

-- ─── 9. Registo de auditoria ─────────────────────────────────────────────────
-- Quem fez o quê, quando, e o que mudou. Só os administradores leem; ninguém
-- escreve, altera ou apaga a partir da aplicação — as linhas entram apenas
-- pelos triggers abaixo e pela função registar_evento.
--
-- Limitação: as consultas (leituras) não são registadas. Um trigger não vê
-- SELECTs; para isso seria preciso ler através de funções próprias ou ativar
-- uma extensão de auditoria no servidor.
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  "occurredAt" timestamptz not null default now(),
  "actorId"    uuid,
  "actorEmail" text,
  "tableName"  text not null,
  "recordId"   text,
  action       text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'EXPORT', 'PRINT')),
  "oldData"    jsonb,
  "newData"    jsonb
);

create index if not exists audit_log_occurred_idx on public.audit_log ("occurredAt" desc);
create index if not exists audit_log_table_record_idx on public.audit_log ("tableName", "recordId");
create index if not exists audit_log_actor_idx on public.audit_log ("actorId");

alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (public.is_admin());

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_email text;
  k text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  -- Numa alteração guarda-se só o que mudou.
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if (v_old -> k) is not distinct from (v_new -> k) then
        v_old := v_old - k;
        v_new := v_new - k;
      end if;
    end loop;
    if v_new = '{}'::jsonb then
      return null;
    end if;
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.audit_log ("actorId", "actorEmail", "tableName", "recordId", action, "oldData", "newData")
  values (
    auth.uid(),
    v_email,
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    tg_op,
    v_old,
    v_new
  );

  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'evaluations', 'suspects', 'operations', 'notifications'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()',
      t || '_audit', t
    );
  end loop;
end $$;

-- Exportações e impressões: a aplicação regista-as aqui. É um registo de boa
-- fé — quem quiser contornar a aplicação pode não o chamar —, mas fica o rasto
-- do uso normal.
create or replace function public.registar_evento(p_acao text, p_detalhe jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_approved() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_acao not in ('EXPORT', 'PRINT') then
    raise exception 'Ação inválida';
  end if;
  if octet_length(coalesce(p_detalhe, '{}'::jsonb)::text) > 4000 then
    raise exception 'Detalhe demasiado longo';
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.audit_log ("actorId", "actorEmail", "tableName", "recordId", action, "newData")
  values (
    auth.uid(),
    v_email,
    left(coalesce(p_detalhe ->> 'recurso', 'aplicacao'), 50),
    left(p_detalhe ->> 'id', 50),
    p_acao,
    p_detalhe
  );
end;
$$;

revoke execute on function public.registar_evento(text, jsonb) from public, anon;
grant execute on function public.registar_evento(text, jsonb) to authenticated;

-- ─── 10. Gravação atómica de avaliação + suspeitos ──────────────────────────
-- Antes, a avaliação e os suspeitos iam em pedidos separados; na edição os
-- suspeitos eram apagados e reinseridos, e uma falha a meio perdia-os. Aqui é
-- tudo uma transação. SECURITY INVOKER: as políticas aplicam-se a quem chama,
-- exatamente como num pedido direto.
create or replace function public.gioe_guardar_avaliacao(
  p_id integer,
  p_dados jsonb,
  p_suspeitos jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  d public.evaluations;
  r public.evaluations;
begin
  if p_suspeitos is not null and jsonb_typeof(p_suspeitos) <> 'array' then
    raise exception 'Lista de suspeitos inválida';
  end if;
  if p_suspeitos is not null and jsonb_array_length(p_suspeitos) > 50 then
    raise exception 'Demasiados suspeitos numa só avaliação (máximo 50)';
  end if;

  d := jsonb_populate_record(null::public.evaluations, p_dados);

  if p_id is null then
    insert into public.evaluations (
      "userId",
      "cterRequerente", nuipc, "entidadeSolicitadora", "refFiledoc", email, "ordemVerbal",
      "pocPosto", "pocNome", "pocContacto", despacho,
      "mandadoDetencao", "mandadoBusca", "quantidadeSuspeitos", "modalidadeIsolado", "modalidadeAssociacao",
      "tipoCriminal", "antecedentesContraPessoas", "antecedentesContraPatrimonio", "antecedentesOutros",
      "antecedentesFss", "posseArma", "usoArma",
      "tipologiaApartamento", "tipologiaMoradia", "tipologiaOutro",
      "contextoIsolado", "contextoBairroSocial", "contextoMeioUrbano", "contextoMeioRural",
      "segurancaCaes", "segurancaPortaBlindada", "segurancaOutrasMedidas",
      avaliador, "dataAvaliacao", parecer, observacoes, "outrasObservacoes", "neopManual"
    ) values (
      auth.uid(),
      d."cterRequerente", d.nuipc, d."entidadeSolicitadora", d."refFiledoc", d.email, d."ordemVerbal",
      d."pocPosto", d."pocNome", d."pocContacto", d.despacho,
      d."mandadoDetencao", d."mandadoBusca", d."quantidadeSuspeitos", d."modalidadeIsolado", d."modalidadeAssociacao",
      d."tipoCriminal", d."antecedentesContraPessoas", d."antecedentesContraPatrimonio", d."antecedentesOutros",
      d."antecedentesFss", d."posseArma", d."usoArma",
      d."tipologiaApartamento", d."tipologiaMoradia", d."tipologiaOutro",
      d."contextoIsolado", d."contextoBairroSocial", d."contextoMeioUrbano", d."contextoMeioRural",
      d."segurancaCaes", d."segurancaPortaBlindada", d."segurancaOutrasMedidas",
      d.avaliador, d."dataAvaliacao", d.parecer, d.observacoes, d."outrasObservacoes", d."neopManual"
    )
    returning * into r;
  else
    update public.evaluations as e set
      "cterRequerente" = d."cterRequerente", nuipc = d.nuipc,
      "entidadeSolicitadora" = d."entidadeSolicitadora", "refFiledoc" = d."refFiledoc",
      email = d.email, "ordemVerbal" = d."ordemVerbal",
      "pocPosto" = d."pocPosto", "pocNome" = d."pocNome", "pocContacto" = d."pocContacto",
      despacho = d.despacho,
      "mandadoDetencao" = d."mandadoDetencao", "mandadoBusca" = d."mandadoBusca",
      "quantidadeSuspeitos" = d."quantidadeSuspeitos",
      "modalidadeIsolado" = d."modalidadeIsolado", "modalidadeAssociacao" = d."modalidadeAssociacao",
      "tipoCriminal" = d."tipoCriminal",
      "antecedentesContraPessoas" = d."antecedentesContraPessoas",
      "antecedentesContraPatrimonio" = d."antecedentesContraPatrimonio",
      "antecedentesOutros" = d."antecedentesOutros", "antecedentesFss" = d."antecedentesFss",
      "posseArma" = d."posseArma", "usoArma" = d."usoArma",
      "tipologiaApartamento" = d."tipologiaApartamento", "tipologiaMoradia" = d."tipologiaMoradia",
      "tipologiaOutro" = d."tipologiaOutro",
      "contextoIsolado" = d."contextoIsolado", "contextoBairroSocial" = d."contextoBairroSocial",
      "contextoMeioUrbano" = d."contextoMeioUrbano", "contextoMeioRural" = d."contextoMeioRural",
      "segurancaCaes" = d."segurancaCaes", "segurancaPortaBlindada" = d."segurancaPortaBlindada",
      "segurancaOutrasMedidas" = d."segurancaOutrasMedidas",
      avaliador = d.avaliador, "dataAvaliacao" = d."dataAvaliacao", parecer = d.parecer,
      observacoes = d.observacoes, "outrasObservacoes" = d."outrasObservacoes",
      "neopManual" = d."neopManual"
    where e.id = p_id
    returning * into r;

    if not found then
      raise exception 'Avaliação inexistente ou sem permissão para a alterar' using errcode = '42501';
    end if;
  end if;

  if p_suspeitos is not null then
    delete from public.suspects where "evaluationId" = r.id;

    insert into public.suspects (
      "evaluationId", nome, "dataNascimento", nacionalidade, nif, cc, morada, observacoes
    )
    select
      r.id,
      nullif(btrim(s.nome), ''), nullif(btrim(s."dataNascimento"), ''),
      nullif(btrim(s.nacionalidade), ''), nullif(btrim(s.nif), ''),
      nullif(btrim(s.cc), ''), nullif(btrim(s.morada), ''), nullif(btrim(s.observacoes), '')
    from jsonb_to_recordset(p_suspeitos) as s(
      nome text, "dataNascimento" text, nacionalidade text, nif text,
      cc text, morada text, observacoes text
    );
  end if;

  return jsonb_build_object('id', r.id, 'pontuacao', r.pontuacao, 'neop', r.neop);
end;
$$;

revoke execute on function public.gioe_guardar_avaliacao(integer, jsonb, jsonb) from public, anon;
grant execute on function public.gioe_guardar_avaliacao(integer, jsonb, jsonb) to authenticated;

-- ─── 11. Funções de trigger não são chamáveis pela API ───────────────────────
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_check() from public, anon, authenticated;
revoke execute on function public.handle_user_email_sync() from public, anon, authenticated;
revoke execute on function public.guard_profile_privileges() from public, anon, authenticated;
revoke execute on function public.guard_last_admin() from public, anon, authenticated;
revoke execute on function public.evaluations_guard() from public, anon, authenticated;
revoke execute on function public.operations_guard() from public, anon, authenticated;
revoke execute on function public.notifications_guard() from public, anon, authenticated;
revoke execute on function public.audit_trigger() from public, anon, authenticated;
revoke execute on function public.suspects_guard() from public, anon, authenticated;
revoke execute on function public.suspects_limite() from public, anon, authenticated;

commit;
