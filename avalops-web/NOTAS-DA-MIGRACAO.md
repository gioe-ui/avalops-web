# Notas da migração

O que mudou em relação à aplicação original, porquê, e o que fica por decidir.

## O que foi removido

A aplicação anterior tinha sido gerada numa plataforma no-code e trazia a infraestrutura dessa
plataforma agarrada ao código. Saiu tudo:

O servidor Express com tRPC (`server/`), o Drizzle e o MySQL, o portal OAuth externo e o SDK de
sessões, o cliente de LLM e o assistente de IA que dependia dele, o armazenamento em S3, o script de
analytics injetado no `index.html`, o plugin de runtime no Vite, e as variáveis de ambiente
associadas.

Saiu também código morto que nunca esteve ligado a nada: o `DashboardLayout` com menus "Page 1" e
"Page 2" e um ecrã de login em inglês, o `ManusDialog`, e a página de migração de administração.

O logótipo e as imagens vinham de um CDN da plataforma. Passam a ser servidos pela própria
aplicação, a partir de `client/public/`.

## O que substituiu o servidor

Não há servidor. O que ele fazia passou para dois sítios:

**Autorização → Row Level Security.** O `protectedProcedure` do tRPC verificava a sessão e, a partir
de certa altura, também a aprovação. Isso agora são políticas SQL: só utilizadores autenticados e
aprovados leem ou escrevem, cada um só altera o que é seu, e os administradores é que aprovam e
promovem. Um trigger impede que alguém se dê a si próprio o papel de administrador ou a aprovação,
porque as políticas RLS não distinguem colunas.

**Lógica de negócio → base de dados e cliente.** O cálculo da pontuação e da classificação NEOP, que
corria no servidor, passou a correr num trigger em PostgreSQL. É importante que seja assim: sem
servidor, se o cálculo vivesse só no browser, qualquer pessoa podia gravar a classificação que lhe
apetecesse chamando a API do Supabase diretamente. O trigger recalcula sempre e ignora o que o
cliente enviar nesses campos. A classificação manual continua a existir, mas por uma coluna dedicada
(`neopManual`), não por sobreposição do valor calculado.

A camada `client/src/lib/api.ts` faz o resto das consultas diretamente ao Supabase, e
`client/src/lib/trpc.ts` mantém a forma da API antiga (`trpc.evaluations.list.useQuery(...)`) para
que as páginas não tivessem de ser reescritas de raiz.

## Segurança

**A autenticação original não verificava a password.** O procedimento de login procurava o
utilizador pelo email e emitia a sessão — o campo `password` nunca era comparado com nada, apesar de
a biblioteca de hashing estar instalada. Na prática, bastava saber um endereço `@gnr.pt` registado
para entrar com a conta dessa pessoa. Isto passa agora pelo Supabase Auth, que faz a verificação a
sério.

Como consequência, foram acrescentados a recuperação de password no ecrã de entrada e a alteração de
password no perfil. Não existiam antes porque não faziam sentido num sistema onde a password não era
verificada.

**A restrição a `@gnr.pt` era apenas de formulário.** Agora é imposta por um trigger na base de
dados, que rejeita o registo independentemente do que o cliente enviar.

**O primeiro administrador deixou de estar escrito no código.** Era `teixeira.vls@gnr.pt`, fixo em
`server/auth.ts`. Passa a ser uma operação explícita (`supabase/04_seed_admin.sql`), feita uma vez.

### Verificação feita

O SQL foi corrido num PostgreSQL 16 local, com o esquema `auth` do Supabase reproduzido, e testado
pelo comportamento e não apenas pela sintaxe. Quinze verificações passam: utilizador por aprovar não
lê nem cria nada, ninguém cria avaliações em nome de outro, auto-promoção e auto-aprovação
bloqueadas, ninguém apaga registos alheios, administrador consegue aprovar e apagar, terceiros não
acrescentam suspeitos a avaliações alheias, e a pontuação enviada pelo cliente é ignorada e
recalculada.

O cálculo NEOP foi comparado em 5000 casos aleatórios entre a implementação TypeScript e a SQL,
incluindo valores fora das listas previstas, para confirmar que ambos aplicam os mesmos valores por
omissão. Concordam em todos.

## Erros encontrados e corrigidos

**O CTer nunca aparecia.** O formulário guardava o Comando Territorial dentro do texto do parecer, no
formato `[CT Lisboa]`, mas o histórico e o filtro procuravam-no com o padrão `CTer:`. Como nunca
coincidiam, a coluna CTer aparecia sempre vazia e o filtro não tinha opções. Existe uma coluna
`cterRequerente` para isto, que não estava a ser usada — passou a ser. A leitura aceita também os
dois formatos antigos, para não perder registos anteriores.

**Vários campos da operação nunca gravavam.** O código escrevia `gdhSaidaUI`, `gdhEntradaUI`,
`gdhChegadaUIOperacao`, `gdhInicioITP`, `gdhFimITP`, `obsSECOp`, `regSECOp`, `excelSECOp`,
`municoesRevolverASP`, `municoesArmasAuto9mm`, `municoesArmasAuto762mm` e `municoesArmasAuto556mm`,
mas as colunas chamam-se `gdhSaidaUi`, `obsSecOp`, `municoesRevolverAsp`, e assim por diante. Está
tudo uniformizado pelos nomes reais das colunas.

**O perfil abria vazio.** O formulário de edição era inicializado antes de os dados do utilizador
chegarem, por isso ao entrar em modo de edição os campos apareciam em branco.

**Dois botões de PDF não funcionavam.** Em `OperationDetail` e `OperationForm`, a geração de PDF
procurava um elemento `#print-operation-content` que não existe em nenhuma das páginas, por isso
falhava sempre. Passam a abrir o relatório imprimível, que já existia.

**A janela de notificação mostrava sempre "N/A".** A listagem de operações não carregava os dados do
militar atribuído, pelo que o nome e o telefone chegavam vazios à mensagem de WhatsApp. Os dados
passam a vir na mesma consulta.

**O título do mapa aparecia duas vezes**, uma no cartão e outra dentro do próprio componente.

**A exportação para Excel dependia de um CDN externo**, carregado em tempo de execução. Passa a vir
do pacote instalado.

## Alterações que vale a pena confirmar

**Perfis de suspeitos.** A página com este nome não lia suspeitos nenhuns: construía a lista a partir
das avaliações, usando o NUIPC no lugar do nome e o CTer no lugar do NIF, com um comentário do
gerador a assumir que era provisório. Como a tabela de suspeitos existe e é preenchida pelo
formulário de avaliação, a página passou a usá-la. Confirme que o agrupamento (por nome, NIF e CC)
corresponde ao que espera.

**Quem pode ler as avaliações.** Qualquer utilizador aprovado lê todas as avaliações. É o
comportamento da aplicação original — a consulta por identificador e as estatísticas liam a tabela
inteira para qualquer sessão; só a listagem do histórico filtrava por autor. Mantive assim para não
alterar o funcionamento, mas num sistema com dados desta natureza é uma decisão a tomar
conscientemente. `supabase/02_policies.sql` tem, em comentário, a política alternativa que restringe
a leitura ao autor, e a nota do que isso implica para as estatísticas.

**Eliminar utilizadores.** A interface elimina o perfil, o que retira imediatamente todo o acesso.
A conta de autenticação em si só pode ser removida no painel do Supabase (Authentication → Users),
porque isso exige a `service_role` key, que não pode existir num site estático.

**Métodos de entrada asiáticos.** Os campos de texto traziam uma camada de composição para línguas
como o chinês e o japonês, ligada a um contexto exportado pela caixa de diálogo. Foi removida.

**Mensagem removida no ecrã de espera.** Dizia "será notificado por email assim que a sua conta for
aprovada", mas não há nada que envie esse email. Foi substituída por uma descrição do que acontece
de facto.

## Pontos a ter em conta

**O mapa usa tiles do OpenStreetMap.** O browser de cada utilizador faz pedidos a um servidor externo
enquanto o mapa está aberto. Se isso não for aceitável, substituir a camada de tiles por uma interna
ou por uma imagem estática.

**O assistente de IA não foi reconstruído.** Dependia da API de LLM da plataforma anterior. Num site
estático não há onde guardar uma chave de API em segurança; o substituto natural é uma Edge Function
do Supabase, que é backend outra vez e merece decisão própria.

**O upload de ficheiros não foi reconstruído.** Usava S3 através do servidor. O equivalente aqui é o
Supabase Storage, com políticas próprias.

**Obrigações legais.** A aplicação trata dados pessoais de suspeitos e de militares num contexto de
aplicação da lei. Num site publicamente acessível, isto tem implicações de RGPD que valem uma
verificação com o encarregado de proteção de dados da instituição antes de entrar em produção —
nomeadamente o facto de o GitHub Pages ser público e de qualquer pessoa poder chegar ao ecrã de
entrada.

## Uma nota sobre o `trpc.ts`

O ficheiro `client/src/lib/trpc.ts` já não tem nada a ver com tRPC: é uma fachada com a mesma forma,
por cima do Supabase e do TanStack Query. Existe para que a migração não obrigasse a reescrever as
dezassete páginas. Se um dia fizer sentido limpar, cada `trpc.x.y.useQuery(input)` troca-se por um
`useQuery({ queryKey, queryFn: () => api.x.y(input) })` sem mais nada mudar.
