# Vida Plena Archives — Frontend

Interface web em React, TypeScript e Vite para consumir a API ASP.NET Core do projeto.

## Funcionalidades
- Envio de documentos para `POST /api/archives/archive`.
- Definição do prazo de retenção em dias.
- Listagem paginada por `GET /api/archives/`.
- Busca local por nome de arquivo.
- Exibição de tamanho, data de envio e expiração.
- Abertura do conteúdo por `GET /api/archives/{id}/content`, servido diretamente pela API. PDFs, texto e imagens comuns abrem no navegador; outros formatos são baixados.

## Requisitos
- Node.js 20 ou superior (recomendado).
- API ASP.NET Core em execução e conectada ao Google Cloud Storage.

A API acessa o bucket privado com as credenciais do Google Cloud. Não é necessário configurar CDN, URL pública do bucket ou chave de assinatura. Documentos expirados ou inexistentes retornam 404.

## Como executar

Para executar o frontend e a API juntos com Docker Compose, siga as instruções no [README da raiz](../README.md#run-both-projects-with-docker-compose). O container usa Nginx para servir a interface e encaminhar `/api/` para a API. O valor `VITE_API_BASE_URL=/` seleciona a origem atual do navegador e já é definido no Dockerfile.

No terminal, entre nesta pasta:

```bash
cd frontend
npm install
```

Crie o arquivo `.env` copiando `.env.example`.

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

Linux/macOS:
```bash
cp .env.example .env
```

Mantenha `.env` com a origem atual. O proxy do Vite encaminha `/api` para `http://localhost:5254`, a porta do perfil HTTP da API:

```env
VITE_API_BASE_URL=/
```

Inicie o frontend:

```bash
npm run dev
```

Abra o endereço local exibido pelo Vite (normalmente `http://localhost:5173`).

Para gerar a versão de produção:

```bash
npm run build
```

Os arquivos gerados ficam em `dist/`.

## Integração
Inicie a API com `dotnet run --project VidaPlenaArchives.WebApi --launch-profile http` na raiz, configurando `GoogleStorage__BucketName` e as credenciais do Google Cloud no ambiente. O `.env` da raiz é lido pelo Docker Compose; `dotnet run` não o carrega automaticamente. Se usar outra porta HTTP, ajuste o destino do proxy em `vite.config.ts`. Tanto no Vite quanto no Docker, o navegador usa a mesma origem e não precisa de configuração CORS.

A API aceita arquivos de até 20 MB e exige os campos multipart `file` e `days` no envio.
