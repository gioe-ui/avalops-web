-- =============================================================================
-- GIOE — Primeiro administrador
--
-- Na aplicação original o administrador estava escrito no código. Aqui é uma
-- operação explícita: regista-se a conta pela aplicação, como qualquer militar,
-- e depois corre-se este script uma vez no SQL Editor do Supabase.
--
-- Substituir o email abaixo antes de correr. O endereço real NÃO deve ser
-- gravado no repositório: alterar apenas na cópia colada no SQL Editor.
-- =============================================================================

do $$
declare
  alvo constant text := 'nome.apelido@gnr.pt';  -- <<< alterar aqui (só no SQL Editor)
  n    integer;
begin
  if alvo = 'nome.apelido@gnr.pt' then
    raise exception 'Substitua o email de exemplo pelo do primeiro administrador antes de correr o script.';
  end if;

  update public.profiles
     set "role" = 'admin', approved = 1, active = 1
   where lower(email) = lower(alvo);

  get diagnostics n = row_count;

  if n = 0 then
    raise exception
      'Não existe nenhum perfil com o email %. Registe primeiro a conta na aplicação e volte a correr este script.',
      alvo;
  end if;

  raise notice 'O utilizador % é agora administrador e está aprovado.', alvo;
end $$;

-- Conferir quem tem privilégios de administrador:
select email, "name", "rank", "role", approved, "createdAt"
from public.profiles
where "role" = 'admin'
order by "createdAt";
