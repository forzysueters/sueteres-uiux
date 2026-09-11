# Arquitetura do repositório

Este repositório é um monorepo com três aplicações executáveis e uma camada de infraestrutura.

| Componente | Diretório | Porta | Responsabilidade |
| --- | --- | ---: | --- |
| Web | `apps/web` | 5173 | Interface React/Vite |
| OCR | `services/ocr` | 8000 | Extração de placas com FastAPI |
| Anomalia | `services/anomaly` | 8001 | Pontuação de saúde com FastAPI |
| Supabase | `supabase` | remoto | Banco, autenticação e Edge Functions |

## Contratos de ambiente

- `apps/web/.env.example`: valores públicos enviados ao browser. Copie para `.env.local`.
- `.env.ops.example`: credenciais locais dos scripts administrativos. Copie para `.env.local` na raiz.
- `services/*/.env.example`: ajustes de cada serviço. Os padrões permitem iniciar sem arquivo local.
- `supabase/.env.example`: inventário dos secrets cadastrados no projeto Supabase.

Somente arquivos `*.example` são versionados. Nunca coloque chaves secretas em variáveis `VITE_*`.

## Dados e modelos

Fixtures pequenas e o baseline necessário para a demonstração podem ser versionados. Dados brutos,
novos modelos treinados e conteúdo de `storage/` são artefatos locais e permanecem ignorados. Artefatos
grandes devem usar armazenamento de objetos ou um registry de modelos, e não o histórico Git.

## Comandos da raiz

- `npm run bootstrap`: instala Node e cria os ambientes Python.
- `npm run dev`: valida o ambiente e inicia a aplicação web.
- `npm run check`: executa lint, testes e build.
- `npm run services:start`: constrói e inicia os três componentes com Docker Compose.
