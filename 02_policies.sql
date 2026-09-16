-- =============================================================================
-- GIOE — Row Level Security
--
-- Substitui o `protectedProcedure` do tRPC. Na aplicação original a autorização
-- vivia no servidor Express; aqui vive na base de dados, que é a única camada
-- que o browser não consegue contornar.
--
-- Regra base: só utilizadores autenticados E aprovados leem ou escrevem seja o
-- que for. A aprovação é dada por um administrador.
-- =============================================================================

alter table public.profiles      enable row level security;
alter table public.evaluations   enable row level security;
alter table public.suspects      enable row level security;
alter table public.operations    enable row level security;
alter table public.notifications enable row level security;

-- ─── Funções auxiliares ──────────────────────────────────────────────────────
-- SECURITY DEFINER para que a leitura de `profiles` feita aqui dentro não volte
-- a passar pelas políticas de `profiles` (evita recursão infinita).

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approved = 1
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approved = 1 and "role" = 'admin'
  );
$$;

revoke execute on function public.is_approved() from anon;
revoke execute on function public.is_admin() from anon;

-- ─── Privilégios ─────────────────────────────────────────────────────────────
-- O RLS só decide depois de haver privilégio. Utilizadores não autenticados
-- não têm acesso nenhum a estas tabelas.

grant usage on schema public to authenticated;

revoke all on public.profiles, public.evaluations, public.suspects,
              public.operations, public.notifications from anon;

grant select, insert, update, delete
  on public.evaluations, public.suspects, public.operations, public.notifications
  to authenticated;

grant select, update, delete on public.profiles to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Cada utilizador vê sempre o próprio perfil (precisa disso para saber se já
-- foi aprovado). Utilizadores aprovados veem os restantes militares — a
-- aplicação lista-os para atribuir operações.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_approved());

-- O perfil é criado pelo trigger handle_new_user, não pelo cliente.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- Um utilizador pode editar o próprio perfil, mas NÃO pode dar-se a si mesmo
-- aprovação ou o papel de administrador. As políticas RLS não distinguem
-- colunas, por isso a proteção é feita por trigger.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo significa que o pedido não vem de uma sessão de utilizador:
  -- é o SQL Editor, uma migração ou a service_role key (todos do lado do
  -- servidor). O `anon` nunca chega aqui porque não tem privilégios na tabela.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new."role" is distinct from old."role" then
    raise exception 'Apenas administradores podem alterar o papel de um utilizador';
  end if;

  if new.approved is distinct from old.approved then
    raise exception 'Apenas administradores podem aprovar utilizadores';
  end if;

  if new.email is distinct from old.email then
    raise exception 'O email não pode ser alterado';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ─── evaluations ─────────────────────────────────────────────────────────────
--
-- DECISÃO A CONFIRMAR: qualquer utilizador aprovado lê todas as avaliações.
-- É o comportamento da aplicação original (getById e as estatísticas liam a
-- tabela inteira para qualquer sessão; só a listagem do Dashboard é que
-- filtrava por autor). A listagem continua a filtrar no cliente.
--
-- Para restringir a leitura ao próprio autor, substituir a política
-- evaluations_select por:
--   using (public.is_approved() and ("userId" = auth.uid() or public.is_admin()))
-- Nesse caso as estatísticas globais deixam de funcionar para não-admins e
-- passam a precisar de uma função SECURITY DEFINER dedicada.

drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select to authenticated
  using (public.is_approved());

drop policy if exists evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert to authenticated
  with check (public.is_approved() and "userId" = auth.uid());

drop policy if exists evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update to authenticated
  using (public.is_approved() and ("userId" = auth.uid() or public.is_admin()))
  with check (public.is_approved() and ("userId" = auth.uid() or public.is_admin()));

drop policy if exists evaluations_delete on public.evaluations;
create policy evaluations_delete on public.evaluations
  for delete to authenticated
  using (public.is_approved() and ("userId" = auth.uid() or public.is_admin()));

-- A pontuação e a classificação NEOP são recalculadas no servidor de base de
-- dados a partir dos critérios, para que um cliente não possa gravar um valor
-- arbitrário. A regra está em 04_scoring.sql.

-- ─── suspects ────────────────────────────────────────────────────────────────
-- Acompanham a avaliação a que pertencem.

drop policy if exists suspects_select on public.suspects;
create policy suspects_select on public.suspects
  for select to authenticated
  using (public.is_approved());

drop policy if exists suspects_write on public.suspects;
create policy suspects_write on public.suspects
  for all to authenticated
  using (
    public.is_approved() and exists (
      select 1 from public.evaluations e
      where e.id = "evaluationId"
        and (e."userId" = auth.uid() or public.is_admin())
    )
  )
  with check (
    public.is_approved() and exists (
      select 1 from public.evaluations e
      where e.id = "evaluationId"
        and (e."userId" = auth.uid() or public.is_admin())
    )
  );

-- ─── operations ──────────────────────────────────────────────────────────────
-- O autor da avaliação, o militar a quem a operação foi atribuída e os
-- administradores podem escrever. Todos os aprovados podem ler.

drop policy if exists operations_select on public.operations;
create policy operations_select on public.operations
  for select to authenticated
  using (public.is_approved());

drop policy if exists operations_insert on public.operations;
create policy operations_insert on public.operations
  for insert to authenticated
  with check (public.is_approved());

drop policy if exists operations_update on public.operations;
create policy operations_update on public.operations
  for update to authenticated
  using (
    public.is_approved() and (
      "userId" = auth.uid()
      or "assignedUserId" = auth.uid()
      or public.is_admin()
    )
  )
  with check (
    public.is_approved() and (
      "userId" = auth.uid()
      or "assignedUserId" = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists operations_delete on public.operations;
create policy operations_delete on public.operations
  for delete to authenticated
  using (public.is_approved() and ("userId" = auth.uid() or public.is_admin()));

-- ─── notifications ───────────────────────────────────────────────────────────

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (public.is_approved() and ("userId" = auth.uid() or public.is_admin()));

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (public.is_approved());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (public.is_approved() and ("userId" = auth.uid() or public.is_admin()))
  with check (public.is_approved() and ("userId" = auth.uid() or public.is_admin()));
