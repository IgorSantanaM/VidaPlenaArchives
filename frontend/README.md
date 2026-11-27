# Vida Plena Archives — Frontend

Interface web em React, TypeScript e Vite para consumir a API ASP.NET Core do projeto.

## Funcionalidades
- Envio de documentos para `POST /api/archives/archive`.
- Definição do prazo de retenção em dias.
- Listagem paginada por `GET /api/archives/`.
- Busca local por nome de arquivo.
- Exibição de tamanho, data de envio e expiração.
- Abertura do conteúdo por `GET /api/archives/{id}/content`.

## Requisitos
- Node.js 20 ou superior (recomendado).
- API ASP.NET Core em execução e conectada ao Google Cloud Storage.

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

Edite `.env` e informe a URL base da API, sem barra no final. Use a porta HTTPS exibida quando a API ASP.NET Core iniciar:

```env
VITE_API_BASE_URL=https://localhost:7001
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

## Integração e CORS
O navegador precisa conseguir acessar a API a partir da origem do Vite. Se aparecer erro de CORS, configure uma política CORS na API ASP.NET Core permitindo a origem local do Vite (normalmente `http://localhost:5173`). Não habilite acesso irrestrito em produção.

A API aceita arquivos de até 20 MB e exige os campos multipart `file` e `days` no envio.
