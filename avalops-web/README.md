# GIOE — Sistema de Avaliação de Pedidos de Apoio

Aplicação web para o GIOE (Grupo de Intervenção de Operações Especiais) da GNR. Permite registar e
avaliar pedidos de apoio operacional, calculando a pontuação de risco e a classificação NEOP, e
acompanhar as operações, os suspeitos, os utilizadores e as estatísticas.

Acesso restrito a contas `@gnr.pt`, com aprovação por administrador.

Esta é uma reconstrução da aplicação anterior, sem qualquer ligação à plataforma onde tinha sido
gerada. Não há servidor próprio: o site é estático, publicado no GitHub Pages, e fala diretamente
com o Supabase. Ver [NOTAS-DA-MIGRACAO.md](NOTAS-DA-MIGRACAO.md) para o que mudou e porquê.

## Como funciona

O browser carrega ficheiros estáticos do GitHub Pages e comunica diretamente com o Supabase, que
trata da autenticação e dos dados. Não existe camada intermédia.

Por isso, **a autorização vive toda na base de dados**, em políticas de Row Level Security. Um
utilizador não aprovado não lê nem escreve nada, ninguém grava registos em nome de outro, ninguém
se promove a administrador, e a pontuação de risco é recalculada pelo servidor de base de dados,
ignorando o que o browser enviar. Nada disto depende do código do site — depende do SQL em
`supabase/`.

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
│       ├── hooks/              # useAuth e utilitários de impressão/exportação
│       ├── contexts/           # ThemeContext
│       └── lib/
│           ├── supabase.ts     # Cliente Supabase
│           ├── api.ts          # Camada de dados (substitui o servidor tRPC)
│           ├── trpc.ts         # Fachada com a forma da API antiga
│           └── scoring.ts      # Cálculo NEOP (espelhado em SQL)
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
```

Os ficheiros começados por `_` são para validação local e **não** devem ser executados no Supabase.

Em Authentication → Providers, manter o email ativo. Se a confirmação de email estiver ligada, os
militares têm de confirmar o endereço antes de entrar — a aplicação avisa disso no registo.

Em Authentication → URL Configuration, acrescentar o endereço do site (por exemplo
`https://<utilizador>.github.io/<repositório>/`) às *Redirect URLs*, para a recuperação de password
funcionar.

### 2. Primeiro administrador

Registar a conta pela aplicação, como qualquer militar, e depois correr `supabase/04_seed_admin.sql`
depois de substituir o email lá dentro. A partir daí as aprovações fazem-se pela interface.

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
sozinho, por isso funciona em qualquer repositório sem alterações.

## Comandos

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção para `dist/` |
| `pnpm preview` | Serve o build localmente |
| `pnpm check` | Verificação de tipos |
| `pnpm verify:scoring` | Compara o cálculo NEOP em TypeScript com o SQL |

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
avaliação), `operations` (relatório da operação), `notifications` (mensagens de WhatsApp geradas).

Os nomes das colunas estão em camelCase entre aspas, o que não é idiomático em PostgreSQL. É
deliberado: mantém os nomes dos campos iguais aos da aplicação e evitou uma camada de tradução em
todas as páginas.
