# Configuração e deploy

Este documento descreve os contratos de ambiente e os caminhos suportados para desenvolvimento e publicação.

## Ambientes

Somente modelos `*.example` são versionados. Crie os arquivos locais a partir deles e nunca faça commit de secrets.

| Origem | Arquivo local | Conteúdo |
| --- | --- | --- |
| `apps/web/.env.example` | `apps/web/.env.local` | Variáveis públicas do Vite e URLs dos serviços |
| `services/ocr/.env.example` | `services/ocr/.env` | Integração opcional de visão |
| `services/anomaly/.env.example` | `services/anomaly/.env` | Configuração do detector |
| `.env.ops.example` | `.env.local` na raiz | Acesso administrativo ao Supabase |
| `supabase/.env.example` | secrets remotos | Edge Functions |

Variáveis prefixadas com `VITE_` são incorporadas ao bundle e não podem conter segredo. A `service_role`, senha do banco e chaves de provedores pertencem apenas a processos administrativos ou Edge Functions.

Valide o frontend com:

```bash
npm run env:check
```

## Desenvolvimento local

```bash
npm ci
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

Para incluir OCR e anomalias:

```bash
npm run python:setup
./start-all.sh
```

Use `start-all.bat` no Windows. Consulte o [início rápido](QUICKSTART.md) para portas e solução de problemas.

## Banco Supabase

Os comandos abaixo exigem `.env.local` na raiz, criado a partir de `.env.ops.example`:

```bash
npm run db:migrate
npm run db:users
npm run db:seed
npm run db:types
npm run db:verify
```

`db:users` exige `DEMO_PASSWORD` com pelo menos 12 caracteres. Migrações e seed alteram o projeto configurado; revise o destino antes de executá-los.

Para publicar Edge Functions, configure os secrets descritos em `supabase/.env.example` no painel ou CLI do Supabase e faça deploy apenas das funções necessárias. Secrets nunca devem ser enviados em flags registradas no histórico do shell.

## Build web

```bash
npm ci
npm run typecheck
npm run test:run --workspace @forzy/web
npm run build
```

O artefato é gerado em `dist/` na raiz e não é versionado.

### Cloudflare Pages

Configuração esperada:

| Campo | Valor |
| --- | --- |
| Root directory | `/` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | 22 |

Cadastre `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_OCR_API_URL` e `VITE_ANOMALY_API_URL` nas variáveis do projeto. URLs locais não funcionam para visitantes de um deploy remoto.

## Containers

Depois de criar `apps/web/.env.local`:

```bash
docker compose up --build
```

O build web usa o `package-lock.json` da raiz com `npm ci`. As imagens Python instalam somente dependências de execução; pytest e Ruff permanecem nas listas de desenvolvimento usadas pela CI.

## Checklist antes de compartilhar

- `npm run check` conclui sem erros depois do bootstrap completo.
- `git status` não contém `.env`, credenciais, dados pessoais ou artefatos gerados.
- As credenciais de avaliação são temporárias e enviadas fora do repositório.
- URLs públicas dos serviços Python usam HTTPS e CORS restrito ao frontend publicado.
- Migrações `0001`–`0022` foram aplicadas no projeto de avaliação.
- O responsável definiu a licença do produto integrado antes de qualquer distribuição pública.
