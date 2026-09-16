-- =============================================================================
-- GIOE — Primeiro administrador
--
-- Na aplicação original o administrador estava escrito no código
-- (server/auth.ts fazia `input.email === "teixeira.vls@gnr.pt"`). Aqui é uma
-- operação explícita: regista-se a conta pela aplicação, como qualquer militar,
-- e depois corre-se este script uma vez no SQL Editor do Supabase.
--
-- Substituir o email abaixo antes de correr.
-- =============================================================================

do $$
declare
  alvo constant text := 'teixeira.vls@gnr.pt';  -- <<< alterar aqui
  n    integer;
begin
  update public.profiles
     set "role" = 'admin', approved = 1
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
