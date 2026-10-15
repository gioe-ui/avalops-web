# GIOE — Sistema de Avaliação de Pedidos de Apoio

Aplicação web para o GIOE (Grupo de Intervenção de Operações Especiais) da GNR. Permite registar e
avaliar pedidos de apoio operacional, calculando a pontuação de risco e a classificação NEOP, e
acompanhar as operações, os suspeitos, os utilizadores e as estatísticas.

Acesso restrito a contas `@gnr.pt`, com aprovação por administrador e segundo fator (TOTP)
obrigatório. Os documentos produzidos (impressões e exportações) são classificados **RESERVADO**.

Esta é uma reconstrução da aplicação anterior, sem qualquer ligação à plataforma onde tinha sido
gerada. Não há servidor próprio: o site é estático, publicado no GitHub Pages, e fala diretamente
com o Supabase. Ver [NOTAS-DA-MIGRACAO.md](NOTAS-DA-MIGRACAO.md) para o que mudou e porquê.

## Como funciona

O browser carrega ficheiros estáticos do GitHub Pages e comunica diretamente com o Supabase, que
trata da autenticação e dos dados. Não existe camada intermédia.

Por isso, **a autorização vive toda na base de dados**, em políticas de Row Level Security e
triggers. Sem o segundo fator, sem aprovação ou com a conta desativada não se lê nem escreve nada;
ninguém grava registos em nome de outro, ninguém se promove a administrador, só administradores
atribuem operações, a pontuação de risco e o estado dos relatórios são calculados pelo servidor, e
todas as alterações ficam num registo de auditoria que ninguém consegue apagar a partir da
aplicação. Nada disto depende do código do site — depende do SQL em `supabase/`.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), Wouter, TanStack Query, Recharts, Leaflet |
| Dados e autenticação | Supabase (PostgreSQL + Auth + Row Level Security) |
| Alojamento | GitHub Pages, via GitHub Actions |

## Estrutura

```
.
├── client/                     # Aplicação React (raiz do Vite)
│   ├── index.html
│   ├── public/                 # gioe-logo.webp vai aqui
│   └── src/
│       ├── pages/              # Páginas e o modelo do formulário de avaliação
│       ├── components/         # Componentes próprios + ui/ (shadcn)
│       ├── hooks/              # useAuth e exportação de gráficos
│       ├── contexts/           # ThemeContext
│       └── lib/
│           ├── supabase.ts     # Cliente Supabase, sessão, inatividade, recuperação
│           ├── api.ts          # Camada de dados (substitui o servidor tRPC)
│           ├── trpc.ts         # Fachada com a forma da API antiga
│           ├── scoring.ts      # Cálculo NEOP (espelhado em SQL)
│           ├── datas.ts        # Datas locais e GDH (151630OUT26)
│           ├── neop.tsx        # Cores e textos da classificação NEOP
│           ├── exportar.ts     # Exportação para Excel com marca RESERVADO
│           └── __tests__/      # Testes unitários (vitest)
├── supabase/                   # SQL a correr no Supabase, por ordem
├── scripts/verify-scoring.mjs  # Compara o cálculo em TypeScript com o SQL
└── .github/workflows/deploy.yml
```

## Instalação

### 1. Base de dados

No SQL Editor do Supabase, correr por esta ordem:

```
supabase/01_schema.sql      -- tabelas, índices, restrição @gnr.pt
supabase/02_policies.sql    -- Row Level Security e privilégios
supabase/03_scoring.sql     -- cálculo NEOP por trigger
supabase/05_seguranca.sql   -- endurecimento: MFA, desativação, auditoria, operações, notificações
```

Numa instalação existente, basta correr `05_seguranca.sql` (pode ser corrido mais de uma vez). Se
avisar que há avaliações com mais de um relatório de operação, resolver os duplicados com

```sql
select "evaluationId", array_agg(id order by id) from public.operations
group by "evaluationId" having count(*) > 1;
```

e voltar a correr o ficheiro, para que o índice único seja criado.

Os ficheiros começados por `_` são para validação local e **não** devem ser executados no Supabase.

#### Configuração obrigatória no painel do Supabase

A segurança depende também destas opções, que não estão no código:

| Onde | O quê | Porquê |
| --- | --- | --- |
| Authentication → Sign In / Providers → Email | **Confirm email** ligado | Sem isto, qualquer pessoa regista um `@gnr.pt` inventado sem ter a caixa de correio |
| Authentication → Sign In / Providers → Email | **Secure email change** e **Secure password change** ligados | Mudar email ou password exige confirmação |
| Authentication → Sign In / Providers → Email | Comprimento mínimo da password **12** | A aplicação pede 12, mas só o servidor o garante |
| Authentication → Multi-Factor | **TOTP** ativo | Sem isto ninguém consegue registar o segundo fator e ninguém acede a dados |
| Authentication → URL Configuration | Endereço do site nas *Redirect URLs* (ex.: `https://<utilizador>.github.io/<repositório>/`) | Confirmação de email e recuperação de password |
| Authentication → Rate Limits / Attack Protection | Limites de tentativas e CAPTCHA | Dificulta ataques de força bruta ao login |

Os nomes dos menus mudam com alguma frequência no Supabase; se algum não existir com este nome,
procurar a opção equivalente. Algumas (por exemplo, a deteção de passwords comprometidas ou o
limite de duração das sessões) podem depender do plano contratado — confirmar no painel.

#### Segundo fator (MFA)

Todos os militares registam uma aplicação autenticadora no primeiro acesso; a base de dados não
entrega dados a uma sessão sem segundo fator (`aal2`). Se alguém perder o telemóvel, um
administrador remove o fator dessa conta no painel do Supabase (Authentication → Users → utilizador
→ fatores MFA); no acesso seguinte é pedido um novo registo. Para desligar temporariamente a
exigência (por exemplo, numa avaria), ver o comentário da função `mfa_ok` em `05_seguranca.sql`.

#### Recuperação de password

Usa o fluxo PKCE: a ligação recebida por email tem de ser aberta **no mesmo browser** em que foi
pedida. Ao abri-la, a aplicação obriga a definir a nova password antes de mostrar qualquer outra
coisa.

### 2. Primeiro administrador

Registar a conta pela aplicação, como qualquer militar, e depois correr `supabase/04_seed_admin.sql`
depois de substituir o email lá dentro — **só na cópia colada no SQL Editor**, sem o gravar no
repositório. A partir daí as aprovações fazem-se pela interface. A base de dados não deixa ficar
sem nenhum administrador ativo.

### 3. Logótipo

Colocar o ficheiro do logótipo em `client/public/gioe-logo.webp`. Sem ele a aplicação funciona na
mesma — o espaço fica simplesmente vazio.

### 4. Desenvolvimento local

```bash
pnpm install
cp client/.env.example client/.env.local   # preencher com os valores do Supabase
pnpm dev                                    # http://localhost:3000
```

### 5. Publicação no GitHub Pages

No repositório, em Settings → Pages, escolher **GitHub Actions** como origem.

Em Settings → Secrets and variables → Actions → Variables, criar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Ambos estão em Supabase → Project Settings → API. São variáveis, não segredos: a chave anónima é
pública por natureza e vai dentro do bundle. **Nunca colocar aqui a `service_role` key** — essa
ignora todas as políticas de segurança.

Um push para `main` publica o site. O workflow deteta o nome do repositório e ajusta o caminho base
sozinho, por isso funciona em qualquer repositório sem alterações. Antes do build corre
`pnpm audit --prod`, a verificação de tipos e os testes; pull requests são verificados mas não
publicados.

O build acrescenta ao `index.html` uma Content-Security-Policy que só permite pedidos para o
endereço do Supabase configurado. Se o projeto Supabase mudar, basta mudar a variável e publicar
de novo.

## Comandos

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção para `dist/` |
| `pnpm preview` | Serve o build localmente |
| `pnpm check` | Verificação de tipos |
| `pnpm test` | Testes unitários (datas, GDH, cálculo NEOP, mensagens de erro) |
| `pnpm verify:scoring` | Compara o cálculo NEOP em TypeScript com o SQL |

### Testar o SQL localmente

Num PostgreSQL 16 descartável:

```bash
psql -d teste -f supabase/_test_harness.sql   # simula o ambiente do Supabase
for f in 01_schema 02_policies 03_scoring 05_seguranca; do psql -d teste -f supabase/$f.sql; done
psql -d teste -f supabase/_test_rls.sql          # políticas base
psql -d teste -f supabase/_test_05_seguranca.sql # cada ataque que 05 fecha
```

### Verificar o cálculo NEOP

O cálculo existe duas vezes: em TypeScript, para a pré-visualização em tempo real no formulário, e
em SQL, que é o que fica gravado. Se divergirem, o formulário mente ao avaliador. O script gera
casos aleatórios, insere-os e compara os dois resultados:

```bash
node --experimental-strip-types scripts/verify-scoring.mjs "postgres://...connection-string..."
```

Correr sempre contra uma base de dados descartável — o script insere e apaga registos.

## Modelo de dados

`profiles` (militares, ligada a `auth.users`), `evaluations` (avaliações), `suspects` (suspeitos por
avaliação), `operations` (relatório da operação, no máximo um por avaliação), `notifications`
(mensagens de WhatsApp, geradas pelo servidor), `audit_log` (registo de auditoria).

Os campos GDH (grupo data-hora) usam o formato `DDHHMMMESAA`, por exemplo `151630OUT26`.

Os nomes das colunas estão em camelCase entre aspas, o que não é idiomático em PostgreSQL. É
deliberado: mantém os nomes dos campos iguais aos da aplicação e evitou uma camada de tradução em
todas as páginas.
