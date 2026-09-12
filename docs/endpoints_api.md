# Endpoints da fonte IoT

Os endereços do laboratório são temporários e não devem ser gravados no repositório. Solicite a URL base ativa ao responsável pela avaliação.

Com uma URL base em `IOT_BASE_URL`, valide as duas fontes:

```bash
curl "$IOT_BASE_URL/get_s1"
curl "$IOT_BASE_URL/get_s2"
```

No PowerShell:

```powershell
Invoke-RestMethod "$env:IOT_BASE_URL/get_s1"
Invoke-RestMethod "$env:IOT_BASE_URL/get_s2"
```

Para configurar e iniciar o coletor do projeto:

```bash
npm run collector -- url both "$IOT_BASE_URL"
npm run collector:status
npm run collector:test
```

Túneis rápidos do Cloudflare são efêmeros. Quando a URL mudar, atualize a configuração do coletor; não faça commit do endereço ativo nem de tokens de acesso.
