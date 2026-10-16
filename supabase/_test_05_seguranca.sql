-- Apenas para validação local — NÃO executar no Supabase.
-- Verifica o comportamento de 05_seguranca.sql: cada ataque que a migração
-- fecha é tentado aqui, e o teste falha ruidosamente se resultar.
--
-- Ordem: _test_harness, 01, 02, 03, 05 e depois este ficheiro.

\set ON_ERROR_STOP on
\timing off

begin;

-- ─── Utilitários (criados e descartados nesta transação) ─────────────────────
create or replace function public.t_ok(cond boolean, descricao text)
returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FALHA: %', descricao;
  end if;
  raise notice 'OK  %', descricao;
end $$;

-- Executa SQL que TEM de falhar. `padrao` é um excerto da mensagem ou um SQLSTATE.
create or replace function public.t_erro(p_sql text, padrao text, descricao text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = padrao or sqlerrm ilike '%' || padrao || '%' then
      raise notice 'OK  %', descricao;
      return;
    end if;
    raise exception 'FALHA (%): erro inesperado "%" [%]', descricao, sqlerrm, sqlstate;
  end;
  raise exception 'FALHA: % — a operação foi aceite', descricao;
end $$;

-- Executa SQL e devolve o número de linhas afetadas.
create or replace function public.t_linhas(p_sql text)
returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- ─── Utilizadores ────────────────────────────────────────────────────────────
-- 1 admin, 2 autor, 3 militar, 4 terceiro, 5 pendente, 6 segundo admin
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'admin@gnr.pt',    '{"name":"Admin","rank":"Capitão"}'),
  ('22222222-2222-2222-2222-222222222222', 'autor@gnr.pt',    '{"name":"Autor","rank":"Sargento"}'),
  ('33333333-3333-3333-3333-333333333333', 'militar@gnr.pt',  '{"name":"Militar","rank":"Cabo","phoneNumber":"912345678"}'),
  ('44444444-4444-4444-4444-444444444444', 'terceiro@gnr.pt', '{"name":"Terceiro","rank":"Guarda"}'),
  ('55555555-5555-5555-5555-555555555555', 'pendente@gnr.pt', '{"name":"Pendente","rank":"Guarda"}'),
  ('66666666-6666-6666-6666-666666666666', 'admin2@gnr.pt',   '{"name":"Admin2","rank":"Major"}');

update public.profiles set approved = 1, "role" = 'admin'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set approved = 1
  where id in ('22222222-2222-2222-2222-222222222222',
               '33333333-3333-3333-3333-333333333333',
               '44444444-4444-4444-4444-444444444444');

select public.t_erro(
  $q$insert into auth.users (email) values ('x@gnr.pt.evil.com')$q$,
  '@gnr.pt', 'domínio parecido com gnr.pt rejeitado no registo');

-- ─── MFA ─────────────────────────────────────────────────────────────────────
set local role authenticated;

select public.set_current_user('22222222-2222-2222-2222-222222222222');
insert into public.evaluations ("userId", nuipc, "tipoCriminal")
values ('22222222-2222-2222-2222-222222222222', 'AVAL-AUTOR', 'trafico');

select public.set_current_user('22222222-2222-2222-2222-222222222222', 'aal1');
select public.t_ok((select count(*) from public.evaluations) = 0,
  'sessão só com password (aal1) não lê avaliações');
select public.t_ok((select count(*) from public.profiles) = 1,
  'sessão aal1 vê apenas o próprio perfil');
select public.t_erro(
  $q$insert into public.evaluations ("userId", nuipc) values ('22222222-2222-2222-2222-222222222222', 'X')$q$,
  '42501', 'sessão aal1 não cria avaliações');
select public.t_ok(
  public.t_linhas($q$update public.profiles set "phoneNumber" = '000' where id = '22222222-2222-2222-2222-222222222222'$q$) = 0,
  'sessão aal1 não altera o próprio perfil');

select public.set_current_user('11111111-1111-1111-1111-111111111111', 'aal1');
select public.t_ok(
  public.t_linhas($q$update public.profiles set approved = 1 where id = '55555555-5555-5555-5555-555555555555'$q$) = 0,
  'administrador em aal1 não aprova ninguém');

-- ─── Perfis: ativo, último administrador, eliminação ─────────────────────────
select public.set_current_user('22222222-2222-2222-2222-222222222222');
select public.t_erro(
  $q$update public.profiles set active = 0 where id = '22222222-2222-2222-2222-222222222222'$q$,
  'Apenas administradores', 'utilizador não altera o próprio estado ativo');
select public.t_erro(
  $q$update public.profiles set email = 'outro@gnr.pt' where id = '22222222-2222-2222-2222-222222222222'$q$,
  'email não pode', 'utilizador não altera o email do perfil');

update public.profiles set "lastSignedIn" = '2001-01-01' where id = '22222222-2222-2222-2222-222222222222';
select public.t_ok(
  (select "lastSignedIn" > now() - interval '1 minute' from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'lastSignedIn é a hora do servidor, não a do cliente');

select public.set_current_user('11111111-1111-1111-1111-111111111111');
select public.t_erro(
  $q$update public.profiles set "role" = 'user' where id = '11111111-1111-1111-1111-111111111111'$q$,
  'último administrador', 'único administrador não se pode despromover');
select public.t_erro(
  $q$update public.profiles set active = 0 where id = '11111111-1111-1111-1111-111111111111'$q$,
  'último administrador', 'único administrador não se pode desativar');

-- Desativar o autor: o trabalho fica, o acesso acaba.
update public.profiles set active = 0 where id = '22222222-2222-2222-2222-222222222222';
select public.t_ok(
  (select count(*) from public.evaluations where nuipc = 'AVAL-AUTOR') = 1,
  'desativar um utilizador mantém as avaliações dele');
select public.t_ok(
  public.t_linhas($q$delete from public.profiles where id = '22222222-2222-2222-2222-222222222222'$q$) = 0,
  'administrador não elimina contas aprovadas (só desativa)');

select public.set_current_user('22222222-2222-2222-2222-222222222222');
select public.t_ok((select count(*) from public.evaluations) = 0,
  'utilizador desativado não lê nada');
select public.t_ok(
  public.t_linhas($q$update public.profiles set "phoneNumber" = '000' where id = '22222222-2222-2222-2222-222222222222'$q$) = 0,
  'utilizador desativado não altera o próprio perfil');

select public.set_current_user('11111111-1111-1111-1111-111111111111');
update public.profiles set active = 1 where id = '22222222-2222-2222-2222-222222222222';

select public.t_ok(
  public.t_linhas($q$delete from public.profiles where id = '55555555-5555-5555-5555-555555555555'$q$) = 1,
  'administrador rejeita (elimina) um registo pendente');

-- Mesmo do lado do servidor, uma conta com trabalho não se apaga.
reset role;
select public.set_current_user(null);
select public.t_erro(
  $q$delete from auth.users where id = '22222222-2222-2222-2222-222222222222'$q$,
  '23503', 'apagar a conta de autenticação de quem tem trabalho é recusado');

-- Segundo administrador: agora o primeiro já pode deixar de o ser.
update public.profiles set approved = 1, "role" = 'admin'
  where id = '66666666-6666-6666-6666-666666666666';
set local role authenticated;
select public.set_current_user('66666666-6666-6666-6666-666666666666');
select public.t_ok(
  public.t_linhas($q$update public.profiles set "role" = 'user' where id = '66666666-6666-6666-6666-666666666666'$q$) = 1,
  'com outro administrador ativo, um administrador pode deixar de o ser');

-- ─── Email da conta ──────────────────────────────────────────────────────────
-- Do lado do servidor (Supabase Auth) não há sessão de utilizador.
reset role;
select public.set_current_user(null);
select public.t_erro(
  $q$update auth.users set email = 'autor@gmail.com' where id = '22222222-2222-2222-2222-222222222222'$q$,
  '@gnr.pt', 'mudança de email para fora de @gnr.pt recusada');
update auth.users set email = 'Autor.Novo@gnr.pt' where id = '22222222-2222-2222-2222-222222222222';
select public.t_ok(
  (select email from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'autor.novo@gnr.pt',
  'mudança de email válida é refletida no perfil');

-- ─── Avaliações ──────────────────────────────────────────────────────────────
set local role authenticated;
select public.set_current_user('22222222-2222-2222-2222-222222222222');

insert into public.evaluations ("userId", nuipc, "createdAt", "updatedBy")
values ('22222222-2222-2222-2222-222222222222', 'AVAL-DATA', '2001-01-01', 'Comandante-Geral');
select public.t_ok(
  (select "createdAt" > now() - interval '1 minute' and "updatedBy" = 'Autor (Sargento)'
   from public.evaluations where nuipc = 'AVAL-DATA'),
  'data de criação e "alterado por" definidos pelo servidor');

update public.evaluations set "createdAt" = '2001-01-01' where nuipc = 'AVAL-DATA';
select public.t_ok(
  (select "createdAt" > now() - interval '1 minute' from public.evaluations where nuipc = 'AVAL-DATA'),
  'data de criação não muda numa alteração');

select public.t_erro(
  $q$update public.evaluations set "neopManual" = '1º NEOP' where nuipc = 'AVAL-DATA'$q$,
  '23514', 'NEOP manual com valor inválido recusado');

update public.evaluations set "neopManual" = '' where nuipc = 'AVAL-DATA';
select public.t_ok(
  (select "neopManual" is null and neop = '2º NEOP' from public.evaluations where nuipc = 'AVAL-DATA'),
  'NEOP manual vazio volta ao calculado');

select public.t_erro(
  $q$update public.evaluations set "userId" = '44444444-4444-4444-4444-444444444444' where nuipc = 'AVAL-DATA'$q$,
  'Apenas administradores podem mudar o autor', 'autor não passa a avaliação para outro utilizador');

-- ─── Gravação atómica ────────────────────────────────────────────────────────
select public.t_ok(
  (public.gioe_guardar_avaliacao(
     null,
     '{"nuipc":"AVAL-RPC","tipoCriminal":"homicidio","posseArma":"registada","userId":"44444444-4444-4444-4444-444444444444"}',
     '[{"nome":"Suspeito A","nif":"123"},{"nome":"Suspeito B"}]'
   ) ->> 'neop') = '4º NEOP',
  'gravação atómica cria avaliação e devolve o NEOP calculado');
select public.t_ok(
  (select "userId" = '22222222-2222-2222-2222-222222222222' from public.evaluations where nuipc = 'AVAL-RPC'),
  'gravação atómica ignora o autor enviado pelo cliente');
select public.t_ok(
  (select count(*) from public.suspects s join public.evaluations e on e.id = s."evaluationId" where e.nuipc = 'AVAL-RPC') = 2,
  'gravação atómica grava os suspeitos');

-- Falha a meio (NIF demasiado longo): nada muda, nem a avaliação nem os suspeitos.
select public.t_erro(
  format(
    $q$select public.gioe_guardar_avaliacao(%s, '{"nuipc":"AVAL-RPC-ALTERADA","tipoCriminal":"outro"}', '[{"nome":"C","nif":"%s"}]')$q$,
    (select id from public.evaluations where nuipc = 'AVAL-RPC'), repeat('9', 30)),
  '22001', 'gravação com suspeito inválido é recusada por inteiro');
select public.t_ok(
  (select count(*) from public.suspects s join public.evaluations e on e.id = s."evaluationId" where e.nuipc = 'AVAL-RPC') = 2,
  'após falha, a avaliação e os suspeitos ficam como estavam');

select public.set_current_user('44444444-4444-4444-4444-444444444444');
select public.t_erro(
  format($q$select public.gioe_guardar_avaliacao(%s, '{"nuipc":"INVADIDA"}', '[]')$q$,
    (select id from public.evaluations where nuipc = 'AVAL-RPC')),
  '42501', 'terceiro não altera a avaliação de outro pela gravação atómica');

-- ─── Suspeitos: limite e data em todos os caminhos ───────────────────────────
select public.set_current_user('22222222-2222-2222-2222-222222222222');
select public.t_erro(
  $q$insert into public.suspects ("evaluationId", nome)
     select id, 'massa_' || g from public.evaluations, generate_series(1, 60) g where nuipc = 'AVAL-AUTOR'$q$,
  'máximo 50', 'escrita direta de mais de 50 suspeitos numa avaliação recusada');
select public.t_ok(
  (select count(*) from public.suspects s join public.evaluations e on e.id = s."evaluationId" where e.nuipc = 'AVAL-AUTOR') = 0,
  'o lote recusado não deixa nenhum suspeito para trás');
insert into public.suspects ("evaluationId", nome, "createdAt")
select id, 'Data forjada', '2001-01-01' from public.evaluations where nuipc = 'AVAL-AUTOR';
select public.t_ok(
  (select "createdAt" > now() - interval '1 minute' from public.suspects where nome = 'Data forjada'),
  'data de criação do suspeito definida pelo servidor');
delete from public.suspects where nome = 'Data forjada';
select public.t_ok(
  (public.gioe_guardar_avaliacao(
     (select id from public.evaluations where nuipc = 'AVAL-RPC'),
     '{"nuipc":"AVAL-RPC","tipoCriminal":"homicidio","posseArma":"registada"}',
     (select jsonb_agg(jsonb_build_object('nome', 'S' || g)) from generate_series(1, 50) g)
   ) ->> 'id') is not null,
  'gravação atómica com exatamente 50 suspeitos é aceite');
select public.t_ok(
  (public.gioe_guardar_avaliacao(
     (select id from public.evaluations where nuipc = 'AVAL-RPC'),
     '{"nuipc":"AVAL-RPC","tipoCriminal":"homicidio","posseArma":"registada"}',
     '[{"nome":"Suspeito A","nif":"123"},{"nome":"Suspeito B"}]'
   ) ->> 'id') is not null,
  'gravação atómica volta a 2 suspeitos (os 50 anteriores são substituídos)');

-- Os testes seguintes partem da sessão do terceiro.
select public.set_current_user('44444444-4444-4444-4444-444444444444');

-- ─── Operações ───────────────────────────────────────────────────────────────
select public.t_erro(
  $q$insert into public.operations ("evaluationId", missao)
     select id, 'intrusa' from public.evaluations where nuipc = 'AVAL-AUTOR'$q$,
  '42501', 'terceiro não cria relatório de operação em avaliação alheia');

select public.set_current_user('22222222-2222-2222-2222-222222222222');
insert into public.operations ("evaluationId", "userId", missao, "operacaoPreenchida", "consumosPreenchidos", "observacoesPreenchidas")
select id, '44444444-4444-4444-4444-444444444444', 'OP-AUTOR', 1, 1, 1
from public.evaluations where nuipc = 'AVAL-AUTOR';
select public.t_ok(
  (select "userId" = '22222222-2222-2222-2222-222222222222' from public.operations where missao = 'OP-AUTOR'),
  'dono da operação é quem a cria, não o que o cliente indica');
select public.t_ok(
  (select "operacaoPreenchida" + "consumosPreenchidos" + "observacoesPreenchidas" = 0 from public.operations where missao = 'OP-AUTOR'),
  'estado de preenchimento calculado pelo servidor');

select public.t_erro(
  $q$insert into public.operations ("evaluationId") select id from public.evaluations where nuipc = 'AVAL-AUTOR'$q$,
  '23505', 'segundo relatório para a mesma avaliação recusado');

select public.t_erro(
  $q$update public.operations set "assignedUserId" = '33333333-3333-3333-3333-333333333333' where missao = 'OP-AUTOR'$q$,
  'Apenas administradores atribuem', 'autor não atribui a operação (só administradores)');

-- Atribuir só a quem está aprovado e ativo.
reset role;
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'novo@gnr.pt');
set local role authenticated;

select public.set_current_user('11111111-1111-1111-1111-111111111111');
select public.t_erro(
  $q$update public.operations set "assignedUserId" = '77777777-7777-7777-7777-777777777777' where missao = 'OP-AUTOR'$q$,
  'aprovado e ativo', 'não se atribui operação a utilizador por aprovar');
update public.operations
   set "assignedUserId" = '33333333-3333-3333-3333-333333333333', "scheduledDate" = '2026-10-20'
 where missao = 'OP-AUTOR';
select public.t_ok(
  (select "assignedUserId" = '33333333-3333-3333-3333-333333333333' from public.operations where missao = 'OP-AUTOR'),
  'administrador atribui a operação');
update public.operations set "flaggedForCompletion" = 1, "flaggedAt" = now() where missao = 'OP-AUTOR';

-- O militar atribuído preenche, mas não mexe no que é do administrador.
select public.set_current_user('33333333-3333-3333-3333-333333333333');
select public.t_ok(
  public.t_linhas($q$update public.operations set "cterOperacao" = 'CT Lisboa', "obsSecOp" = 'ok' where missao = 'OP-AUTOR'$q$) = 1,
  'militar atribuído preenche o relatório');
select public.t_erro(
  $q$update public.operations set "assignedUserId" = null where missao = 'OP-AUTOR'$q$,
  'Apenas administradores atribuem', 'militar atribuído não se desatribui nem reatribui');
select public.t_erro(
  $q$update public.operations set "userId" = '33333333-3333-3333-3333-333333333333' where missao = 'OP-AUTOR'$q$,
  'Apenas administradores podem mudar o autor', 'militar atribuído não se apropria da operação');
select public.t_erro(
  $q$update public.operations set "evaluationId" = (select id from public.evaluations where nuipc = 'AVAL-RPC') where missao = 'OP-AUTOR'$q$,
  'Apenas administradores podem mudar o autor', 'militar atribuído não muda a avaliação da operação');
select public.t_erro(
  $q$update public.operations set "flaggedForCompletion" = 0 where missao = 'OP-AUTOR'$q$,
  'Apenas administradores sinalizam', 'militar atribuído não retira a sinalização à mão');

update public.operations set "obsConsumos" = 'Sem consumos' where missao = 'OP-AUTOR';
select public.t_ok(
  (select "operacaoPreenchida" = 1 and "consumosPreenchidos" = 1 and "observacoesPreenchidas" = 1
          and "flaggedForCompletion" = 0
   from public.operations where missao = 'OP-AUTOR'),
  'relatório completo (consumos declarados nas observações) deixa de estar sinalizado');

select public.t_erro(
  $q$update public.operations set "municoesArmasAuto9Mm" = -5 where missao = 'OP-AUTOR'$q$,
  '23514', 'consumos negativos recusados');

select public.set_current_user('44444444-4444-4444-4444-444444444444');
select public.t_ok(
  public.t_linhas($q$update public.operations set missao = 'alterada' where missao = 'OP-AUTOR'$q$) = 0,
  'terceiro não altera a operação');
select public.t_ok(
  public.t_linhas($q$delete from public.operations where missao = 'OP-AUTOR'$q$) = 0,
  'terceiro não elimina a operação');

-- Operação antiga com o estado calculado de outra forma (como o browser fazia):
-- a função que a migração corre recalcula-o e retira a sinalização.
reset role;
alter table public.operations disable trigger operations_guard;
update public.operations
   set "operacaoPreenchida" = 0, "consumosPreenchidos" = 0, "flaggedForCompletion" = 1, "flaggedAt" = now()
 where missao = 'OP-AUTOR';
alter table public.operations enable trigger operations_guard;
select public.set_current_user(null);
select public.t_ok(public.gioe_recalcular_operacoes() = 0, 'recálculo das operações corre sem falhas');
-- Uma linha antiga inválida (consumos negativos de antes da migração) não
-- impede o recálculo das outras: é contada e saltada.
alter table public.operations disable trigger operations_guard;
alter table public.operations drop constraint operations_consumos_nao_negativos_chk;
insert into public.operations ("evaluationId", "userId", missao, "municoesArmasAuto9Mm")
select id, '22222222-2222-2222-2222-222222222222', 'OP-ANTIGA', -3 from public.evaluations where nuipc = 'AVAL-RPC';
alter table public.operations
  add constraint operations_consumos_nao_negativos_chk check (coalesce("municoesArmasAuto9Mm", 0) >= 0) not valid;
alter table public.operations enable trigger operations_guard;
update public.operations set "operacaoPreenchida" = 0 where missao = 'OP-AUTOR';
select public.t_ok(public.gioe_recalcular_operacoes() = 1, 'recálculo salta e conta a operação antiga inválida');
delete from public.operations where missao = 'OP-ANTIGA';
select public.t_ok(
  (select "operacaoPreenchida" = 1 and "consumosPreenchidos" = 1 and "observacoesPreenchidas" = 1
          and "flaggedForCompletion" = 0 and "flaggedAt" is null
   from public.operations where missao = 'OP-AUTOR'),
  'recálculo corrige o estado de preenchimento das operações antigas');
set local role authenticated;
select public.set_current_user('44444444-4444-4444-4444-444444444444');

-- ─── Notificações ────────────────────────────────────────────────────────────
select public.t_erro(
  $q$insert into public.notifications ("operationId", "userId", "phoneNumber", message, "whatsappLink")
     select id, '44444444-4444-4444-4444-444444444444', '0', 'x', 'javascript:alert(1)'
     from public.operations where missao = 'OP-AUTOR'$q$,
  '42501', 'terceiro não regista notificações');

select public.set_current_user('22222222-2222-2222-2222-222222222222');
insert into public.notifications ("operationId", "userId", "phoneNumber", message, "whatsappLink")
select id, '44444444-4444-4444-4444-444444444444', '999', 'Clique em http://mal.example', 'javascript:alert(1)'
from public.operations where missao = 'OP-AUTOR';

-- Como a aplicação faz: só a operação, e com a linha devolvida.
do $$
declare ligacao text;
begin
  insert into public.notifications ("operationId")
  select id from public.operations where missao = 'OP-AUTOR'
  returning "whatsappLink" into ligacao;
  perform public.t_ok(ligacao like 'https://wa.me/351912345678?text=%',
    'autor regista notificação só com a operação e lê a ligação devolvida');
end $$;

reset role;
select public.t_ok(
  (select n."userId" = '33333333-3333-3333-3333-333333333333'
          and n."whatsappLink" like 'https://wa.me/351912345678?text=Ol%C3%A1%20Cabo%20Militar%2C%0A%0A%'
          and n.message like '%20/10/2026%'
          and n.message not like '%mal.example%'
   from public.notifications n where n.id = (select min(id) from public.notifications)),
  'notificação gerada pelo servidor: destinatário, telefone, mensagem e ligação');
set local role authenticated;
select public.set_current_user('22222222-2222-2222-2222-222222222222');

select public.set_current_user('33333333-3333-3333-3333-333333333333');
select public.t_erro(
  $q$update public.notifications set message = 'outra' where true$q$,
  'não pode ser alterada', 'notificação registada não se altera');
update public.notifications set sent = 1 where true;
select public.t_ok(
  (select bool_and(sent = 1 and "sentAt" is not null) from public.notifications),
  'destinatário marca a notificação como enviada');

-- ─── Auditoria ───────────────────────────────────────────────────────────────
select public.t_ok((select count(*) from public.audit_log) = 0,
  'não-administrador não lê o registo de auditoria');
select public.t_erro(
  $q$insert into public.audit_log ("tableName", action) values ('x', 'INSERT')$q$,
  '42501', 'ninguém escreve diretamente no registo de auditoria');

select public.registar_evento('EXPORT', '{"recurso":"evaluations","linhas":3}');
select public.t_erro(
  $q$select public.registar_evento('DELETE', '{}')$q$,
  'inválida', 'registar_evento só aceita EXPORT e PRINT');

select public.set_current_user('11111111-1111-1111-1111-111111111111');
select public.t_erro(
  $q$delete from public.audit_log$q$,
  '42501', 'nem administradores apagam o registo de auditoria');
select public.t_erro(
  $q$update public.audit_log set action = 'INSERT'$q$,
  '42501', 'nem administradores alteram o registo de auditoria');

select public.t_ok(
  (select count(*) > 0 from public.audit_log
   where "tableName" = 'operations' and action = 'UPDATE'
     and "actorId" = '33333333-3333-3333-3333-333333333333'
     and "newData" ? 'cterOperacao' and not ("newData" ? 'missao')),
  'auditoria regista quem alterou e apenas os campos que mudaram');
select public.t_ok(
  (select count(*) = 1 from public.audit_log where action = 'EXPORT'
     and "actorEmail" = 'militar@gnr.pt'),
  'auditoria regista exportações com o autor');
select public.t_ok(
  (select count(*) > 0 from public.audit_log where "tableName" = 'profiles' and action = 'DELETE'),
  'auditoria regista a rejeição de registos');

-- ─── Funções internas não são chamáveis pela API ─────────────────────────────
select public.t_erro($q$select public.audit_trigger()$q$, '42501',
  'funções de trigger não são executáveis por utilizadores');
select public.t_erro($q$select public.gioe_recalcular_operacoes()$q$, '42501',
  'recálculo das operações não é executável por utilizadores');

reset role;
set local role anon;
select public.t_erro($q$select public.registar_evento('EXPORT', '{}')$q$, '42501',
  'anónimo não executa registar_evento');
select public.t_erro($q$select public.gioe_guardar_avaliacao(null, '{}', null)$q$, '42501',
  'anónimo não executa a gravação atómica');
select public.t_erro($q$select count(*) from public.audit_log$q$, '42501',
  'anónimo não lê o registo de auditoria');

reset role;
rollback;

\echo ''
\echo 'Todos os testes de 05_seguranca passaram.'
