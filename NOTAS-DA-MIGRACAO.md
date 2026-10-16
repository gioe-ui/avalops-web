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

**O primeiro administrador deixou de estar escrito no código.** Estava fixo em `server/auth.ts`.
Passa a ser uma operação explícita (`supabase/04_seed_admin.sql`), feita uma vez.

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

**Quem pode ler as avaliações.** Qualquer utilizador aprovado lê todas as avaliações e todos os
suspeitos. Foi uma decisão tomada conscientemente na revisão de outubro de 2026 (manter a leitura
global), com o registo de auditoria como controlo compensatório. `supabase/02_policies.sql` tem, em
comentário, a política alternativa que restringe a leitura ao autor.

**Eliminar utilizadores.** Deixou de ser possível: eliminava em cascata tudo o que o militar tinha
registado. Contas aprovadas desativam-se (acesso retirado de imediato, registos intactos); só os
registos por aprovar se eliminam (rejeitar). Mesmo no painel do Supabase, apagar a conta de
autenticação de quem tem trabalho registado é recusado pela base de dados.

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
aplicação da lei. O tratamento para fins de prevenção e investigação criminal enquadra-se, em
princípio, na Diretiva (UE) 2016/680, transposta pela Lei n.º 59/2019, e não apenas no RGPD — o que
implica, entre outras coisas, registos de quem recolhe, altera, consulta e apaga dados. O registo de
auditoria cobre as alterações, exportações e impressões, mas **não as consultas**. Vale uma
verificação com o encarregado de proteção de dados antes de entrar em produção, incluindo a região
onde o projeto Supabase está alojado e o facto de o GitHub Pages ser público.

## Uma nota sobre o `trpc.ts`

O ficheiro `client/src/lib/trpc.ts` já não tem nada a ver com tRPC: é uma fachada com a mesma forma,
por cima do Supabase e do TanStack Query. Existe para que a migração não obrigasse a reescrever as
dezassete páginas. Se um dia fizer sentido limpar, cada `trpc.x.y.useQuery(input)` troca-se por um
`useQuery({ queryKey, queryFn: () => api.x.y(input) })` sem mais nada mudar.

## Revisão de segurança (outubro de 2026)

Revisão completa do código e do SQL, com cada ataque reproduzido num PostgreSQL local antes e
depois da correção (`supabase/_test_05_seguranca.sql`). O essencial está em `05_seguranca.sql`.

**Base de dados.**

- Eliminar um utilizador apagava em cascata as avaliações, os suspeitos e as operações dele. Agora
  as contas desativam-se e as chaves estrangeiras recusam a eliminação de quem tem trabalho.
- Qualquer aprovado criava relatórios de operação em avaliações alheias, em nome de outra pessoa, e
  vários por avaliação. Agora só o autor da avaliação (ou um administrador) cria; o autor e o
  militar atribuído preenchem; só administradores mudam o dono, a avaliação e a atribuição; há no
  máximo um relatório por avaliação.
- O militar atribuído podia apropriar-se da operação e retirar a sinalização. Bloqueado.
- Qualquer aprovado registava notificações para qualquer pessoa, com uma ligação arbitrária
  (aceitava `javascript:`). Agora o cliente envia só a operação; destinatário, telefone, mensagem
  e ligação são gerados pela base de dados.
- O NEOP manual aceitava qualquer texto; a data de criação e o "alterado por" vinham do browser;
  podia ficar-se sem administradores; o domínio `@gnr.pt` só era verificado no registo. Corrigido.
- O estado de preenchimento dos relatórios era calculado no browser, com critérios diferentes em
  duas páginas. Passou para a base de dados.
- Segundo fator (TOTP) obrigatório para qualquer acesso a dados.
- Registo de auditoria imutável a partir da aplicação, só legível por administradores.
- Gravação de avaliação e suspeitos numa só transação.

**Aplicação.**

- A ligação de recuperação de password entrava diretamente na aplicação sem pedir a nova password.
- Sem Content-Security-Policy, sem política de referrer e sem proteção contra clickjacking.
- Mudar a password não pedia a atual; a sessão não expirava por inatividade (agora 30 minutos).
- Ações recusadas pela base de dados apareciam como bem-sucedidas.
- Páginas com endereço próprio abriam sem sessão; passam todas pelo mesmo portão de acesso.
- 34 dependências que não eram usadas (algumas com vulnerabilidades) foram removidas; o pacote
  `xlsx` 0.18.5, vulnerável e sem correções no npm, foi substituído por `write-excel-file`.
- Actions do GitHub fixadas por commit, permissões mínimas por job, `pnpm audit` e testes no CI.

**Funcionalidades.** Mês e horas da estatística de operações, sinalização de incompletas, impressão
da avaliação sem ligação, militares por aprovar na lista de atribuição, datas em UTC, limite
silencioso de 1000 linhas, GDH no formato `151630OUT26`, marca RESERVADO em impressões e
exportações, nova paleta institucional (RAL 7013).

**Por decidir fora do código.** O repositório é público e expõe o método de pontuação NEOP; o email
real do primeiro administrador continua no histórico do git; a conta GitHub que publica o site
deve ter 2FA e o ramo `main` protegido; e o site partilha a origem `<conta>.github.io` com qualquer
outro site Pages da conta, que conseguiria ler a sessão guardada no browser — a solução é um
domínio próprio (ver README).
