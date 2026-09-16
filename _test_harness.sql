-- Apenas para validação local do SQL — NÃO executar no Supabase.
-- Recria o mínimo do ambiente Supabase (schema auth, auth.uid(), roles)
-- para que 01/02/03 possam ser testados num PostgreSQL normal.

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

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function public.set_current_user(u uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false);
$$;
