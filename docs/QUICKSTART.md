# Início rápido

Este guia parte de um clone limpo e inicia o frontend. Os serviços Python são opcionais porque a interface identifica e usa fallbacks quando eles estão indisponíveis.

## Requisitos

- Node.js 22 e npm
- Python 3.10–3.12 para OCR e anomalias
- Docker com Compose, caso prefira containers
- URL e chave pública de um projeto Supabase

## Frontend

```bash
npm ci
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

No PowerShell, use:

```powershell
npm ci
Copy-Item apps/web/.env.example apps/web/.env.local
npm run dev
```

Antes de iniciar, edite `apps/web/.env.local` e defina pelo menos:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

A aplicação abre em `http://localhost:5173`. Credenciais de avaliação não ficam no Git e devem ser compartilhadas separadamente.

## Stack completa local

Para criar os ambientes virtuais e instalar as dependências Python:

```bash
npm run python:setup
./start-all.sh
```

No Windows:

```powershell
npm run python:setup
.\start-all.bat
```

Serviços disponíveis:

| Serviço | URL |
| --- | --- |
| Web | `http://localhost:5173` |
| OCR | `http://localhost:8000/docs` |
| Anomalias | `http://localhost:8001/docs` |

## Docker Compose

O Compose também lê `apps/web/.env.local`, portanto crie esse arquivo antes de executar:

```bash
docker compose up --build
```

Para encerrar:

```bash
docker compose down
```

## Verificação

Depois de configurar os ambientes Node e Python:

```bash
npm run env:check
npm run typecheck
npm run lint
npm run test
npm run build
```

Se quiser avaliar somente o frontend, use `npm run lint --workspace @forzy/web`, `npm run test:run --workspace @forzy/web` e `npm run build --workspace @forzy/web`.

## Problemas comuns

- **Configuração do Supabase ausente:** confirme que o arquivo é `apps/web/.env.local`, não apenas `.env.example`.
- **Porta ocupada:** libere 5173, 8000 ou 8001 antes de iniciar a stack.
- **OCR lento na primeira execução:** o EasyOCR pode preparar modelos na primeira inicialização.
- **Fallback visível:** confirme que as APIs respondem em `/health` e que as URLs do frontend apontam para as portas corretas.
