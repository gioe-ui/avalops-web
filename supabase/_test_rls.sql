-- Apenas para validação local — NÃO executar no Supabase.
-- Verifica que as políticas de 02_policies.sql fazem o que dizem.
-- Cada bloco falha ruidosamente se o comportamento não for o esperado.

\set ON_ERROR_STOP on
\timing off

begin;

-- ─── Utilizadores de teste ───────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'admin@gnr.pt',    '{"name":"Admin","rank":"Capitão"}'),
  ('22222222-2222-2222-2222-222222222222', 'aprovado@gnr.pt', '{"name":"Aprovado","rank":"Sargento"}'),
  ('33333333-3333-3333-3333-333333333333', 'pendente@gnr.pt', '{"name":"Pendente","rank":"Guarda"}');

update public.profiles set approved = 1, "role" = 'admin'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set approved = 1
  where id = '22222222-2222-2222-2222-222222222222';

do $$
begin
  if (select count(*) from public.profiles
      where id in ('11111111-1111-1111-1111-111111111111',
                   '22222222-2222-2222-2222-222222222222',
                   '33333333-3333-3333-3333-333333333333')) <> 3 then
    raise exception 'FALHA: o trigger handle_new_user não criou os 3 perfis';
  end if;
  raise notice 'OK  perfis criados automaticamente a partir de auth.users';
end $$;

-- ─── 1. Domínio @gnr.pt imposto pela base de dados ───────────────────────────
do $$
begin
  begin
    insert into auth.users (email) values ('alguem@gmail.com');
    raise exception 'FALHA: email fora de @gnr.pt foi aceite';
  exception
    when others then
      if sqlerrm like '%@gnr.pt%' then
        raise notice 'OK  registo fora de @gnr.pt rejeitado pela base de dados';
      else
        raise;
      end if;
  end;
end $$;

-- ─── 2. Utilizador por aprovar não lê nada ───────────────────────────────────
set local role authenticated;
do $$ begin perform public.set_current_user('22222222-2222-2222-2222-222222222222'); end $$;

insert into public.evaluations ("userId", nuipc, "tipoCriminal", "posseArma")
values ('22222222-2222-2222-2222-222222222222', 'NUIPC-A', 'trafico', 'registada');

do $$ begin perform public.set_current_user('33333333-3333-3333-3333-333333333333'); end $$;

do $$
begin
  if (select count(*) from public.evaluations) <> 0 then
    raise exception 'FALHA: utilizador por aprovar conseguiu ler avaliações';
  end if;
  raise notice 'OK  utilizador por aprovar não lê avaliações';
end $$;

do $$
begin
  begin
    insert into public.evaluations ("userId", nuipc)
    values ('33333333-3333-3333-3333-333333333333', 'NUIPC-X');
    raise exception 'FALHA: utilizador por aprovar conseguiu criar avaliação';
  exception
    when insufficient_privilege then
      raise notice 'OK  utilizador por aprovar não cria avaliações';
  end;
end $$;

-- ─── 3. Ninguém escreve em nome de outro ─────────────────────────────────────
do $$ begin perform public.set_current_user('22222222-2222-2222-2222-222222222222'); end $$;

do $$
begin
  begin
    insert into public.evaluations ("userId", nuipc)
    values ('11111111-1111-1111-1111-111111111111', 'NUIPC-FALSO');
    raise exception 'FALHA: foi possível criar uma avaliação em nome de outro utilizador';
  exception
    when insufficient_privilege then
      raise notice 'OK  não é possível criar avaliações em nome de outro utilizador';
  end;
end $$;

-- ─── 4. Auto-promoção e auto-aprovação bloqueadas ────────────────────────────
do $$
begin
  begin
    update public.profiles set "role" = 'admin'
    where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'FALHA: utilizador promoveu-se a administrador';
  exception
    when raise_exception then
      if sqlerrm like '%administradores%' then
        raise notice 'OK  auto-promoção a administrador bloqueada';
      else
        raise;
      end if;
  end;
end $$;

-- Aqui a política nem chega a abranger a linha de outro utilizador: o UPDATE
-- não dá erro, simplesmente não afeta nada. O que interessa é o resultado.
update public.profiles set approved = 1
where id = '33333333-3333-3333-3333-333333333333';

do $$
begin
  if (select approved from public.profiles
      where id = '33333333-3333-3333-3333-333333333333') <> 0 then
    raise exception 'FALHA: utilizador aprovou outro utilizador';
  end if;
  raise notice 'OK  aprovação por não-administrador não tem efeito';
end $$;

-- O próprio perfil continua editável nos campos normais.
update public.profiles set "phoneNumber" = '912345678'
where id = '22222222-2222-2222-2222-222222222222';
do $$ begin raise notice 'OK  utilizador edita o próprio perfil'; end $$;

-- ─── 5. Pontuação e NEOP não são aceites do cliente ──────────────────────────
insert into public.evaluations ("userId", nuipc, "tipoCriminal", "posseArma", "usoArma", pontuacao, neop)
values ('22222222-2222-2222-2222-222222222222', 'NUIPC-B', 'outro', 'improvavel', 'naoHaRegisto', 99, '4º NEOP');

do $$
declare
  p integer;
  n varchar(20);
begin
  select pontuacao, neop into p, n from public.evaluations where nuipc = 'NUIPC-B';
  -- outro(4) + qtd 1(1) + posse improvavel(2) + uso naoHaRegisto(3) = 10
  if p <> 10 or n <> '2º NEOP' then
    raise exception 'FALHA: pontuação/NEOP enviados pelo cliente foram aceites (p=%, n=%)', p, n;
  end if;
  raise notice 'OK  pontuação e NEOP recalculados pela base de dados, ignorando o cliente';
end $$;

-- O NEOP manual continua a poder sobrepor-se, pela coluna dedicada.
insert into public.evaluations ("userId", nuipc, "tipoCriminal", "neopManual")
values ('22222222-2222-2222-2222-222222222222', 'NUIPC-C', 'outro', '4º NEOP');

do $$
declare n varchar(20);
begin
  select neop into n from public.evaluations where nuipc = 'NUIPC-C';
  if n <> '4º NEOP' then
    raise exception 'FALHA: neopManual não foi respeitado (n=%)', n;
  end if;
  raise notice 'OK  NEOP manual sobrepõe-se ao calculado';
end $$;

-- ─── 6. Não se apaga o que é dos outros ──────────────────────────────────────
do $$ begin perform public.set_current_user('11111111-1111-1111-1111-111111111111'); end $$;
insert into public.evaluations ("userId", nuipc, "tipoCriminal")
values ('11111111-1111-1111-1111-111111111111', 'NUIPC-ADMIN', 'assalto');

do $$ begin perform public.set_current_user('22222222-2222-2222-2222-222222222222'); end $$;
delete from public.evaluations where nuipc = 'NUIPC-ADMIN';
do $$
begin
  if (select count(*) from public.evaluations where nuipc = 'NUIPC-ADMIN') <> 1 then
    raise exception 'FALHA: utilizador apagou a avaliação de outro';
  end if;
  raise notice 'OK  utilizador não apaga avaliações de outros';
end $$;

-- ─── 7. O administrador pode ────────────────────────────────────────────────
do $$ begin perform public.set_current_user('11111111-1111-1111-1111-111111111111'); end $$;
update public.profiles set approved = 1 where id = '33333333-3333-3333-3333-333333333333';
do $$
begin
  if (select approved from public.profiles where id = '33333333-3333-3333-3333-333333333333') <> 1 then
    raise exception 'FALHA: administrador não conseguiu aprovar';
  end if;
  raise notice 'OK  administrador aprova utilizadores';
end $$;

delete from public.evaluations where nuipc = 'NUIPC-A';
do $$
begin
  if (select count(*) from public.evaluations where nuipc = 'NUIPC-A') <> 0 then
    raise exception 'FALHA: administrador não conseguiu apagar';
  end if;
  raise notice 'OK  administrador apaga qualquer avaliação';
end $$;

-- ─── 8. Suspeitos acompanham a avaliação ────────────────────────────────────
do $$ begin perform public.set_current_user('22222222-2222-2222-2222-222222222222'); end $$;
insert into public.suspects ("evaluationId", nome)
select id, 'Suspeito de teste' from public.evaluations where nuipc = 'NUIPC-B';
do $$ begin raise notice 'OK  autor adiciona suspeitos à própria avaliação'; end $$;

do $$ begin perform public.set_current_user('33333333-3333-3333-3333-333333333333'); end $$;
do $$
begin
  begin
    insert into public.suspects ("evaluationId", nome)
    select id, 'Intruso' from public.evaluations where nuipc = 'NUIPC-B';
    if found then
      raise exception 'FALHA: terceiro adicionou suspeito a avaliação alheia';
    end if;
    raise notice 'OK  terceiro não adiciona suspeitos a avaliação alheia';
  exception
    when insufficient_privilege then
      raise notice 'OK  terceiro não adiciona suspeitos a avaliação alheia';
  end;
end $$;

reset role;
rollback;

\echo ''
\echo 'Todos os testes de RLS passaram.'
