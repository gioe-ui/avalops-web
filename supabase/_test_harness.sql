-- Apenas para validação local do SQL — NÃO executar no Supabase.
-- Recria o mínimo do ambiente Supabase (schema auth, auth.uid(), auth.jwt(),
-- roles) para que 01/02/03/05 possam ser testados num PostgreSQL normal.

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               varchar(320),
  raw_user_meta_data  jsonb default '{}'::jsonb
);

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

grant usage on schema auth to anon, authenticated;

-- No Supabase, as claims do token chegam em request.jwt.claims.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

grant execute on function auth.jwt() to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Simula a sessão de um utilizador. Por omissão, uma sessão já com o segundo
-- fator (aal2); passar 'aal1' para simular quem só introduziu a password.
drop function if exists public.set_current_user(uuid);
create or replace function public.set_current_user(u uuid, aal text default 'aal2')
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    case when u is null then '' else json_build_object('sub', u, 'aal', aal)::text end,
    false
  );
$$;

grant execute on function public.set_current_user(uuid, text) to anon, authenticated;
