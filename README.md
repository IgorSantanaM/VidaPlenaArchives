# VidaPlenaArchives
A simple solution for uploading documents to GCP Cloud Storage with Object Lifecycle Management

## Run both projects with Docker Compose

Install Docker with Docker Compose and enable Linux containers. From the repository root, copy the example configuration:

```powershell
Copy-Item .env.example .env
```

On Linux/macOS, use `cp .env.example .env`.

Edit the root `.env` and set:

- `GOOGLE_APPLICATION_CREDENTIALS`: the path to your existing Google Application Default Credentials or service-account JSON file, with access to the storage bucket. Use forward slashes in Windows paths, for example `C:/Users/your-user/AppData/Roaming/gcloud/application_default_credentials.json`. Alternatively, place your credentials at `secrets/google-application-credentials.json` as shown in the example. The `secrets/` folder is ignored by Git and Docker builds.
- `GOOGLE_STORAGE_BUCKET_NAME`: your existing Google Cloud Storage bucket.

Docker Compose mounts the credentials read-only into the API container. The root `.env` supplies API settings; the frontend Docker build uses `/` as its API URL and does not need `frontend/.env`. Only the bucket and Google credentials must already exist. The API reads and writes the private bucket using these credentials and serves document content itself; no Cloud CDN, public bucket access, or signing key is required. The credential identity needs `storage.objects.create`, `storage.objects.get`, and `storage.objects.list` on the bucket.

Build and start both projects:

```bash
docker compose up --build -d
```

Open the frontend at [http://localhost:5173](http://localhost:5173). Nginx forwards `/api/` requests to the API container, so the browser uses the same origin. The API is also available directly at [http://localhost:8080/api/archives/?pageSize=20](http://localhost:8080/api/archives/?pageSize=20). This local setup uses HTTP; it does not require development HTTPS certificates.

You can change `FRONTEND_PORT` and `API_PORT` in the root `.env`.

View logs or stop both projects:

```bash
docker compose logs -f
docker compose down
```

## Run locally without Docker

Install the .NET 10 SDK and Node.js 20 or later. Authenticate with Google Cloud and configure the API bucket from the repository root:

```bash
gcloud auth application-default login
dotnet user-secrets set "GoogleStorage:BucketName" "YOUR_BUCKET_NAME" --project VidaPlenaArchives.WebApi
dotnet run --project VidaPlenaArchives.WebApi --launch-profile http
```

The API uses your local Application Default Credentials. To use a service-account JSON instead, set `GOOGLE_APPLICATION_CREDENTIALS` in the API process environment. The root `.env` is loaded by Docker Compose, not by `dotnet run`.

In another terminal, follow the [frontend instructions](frontend/README.md#como-executar). Its Vite proxy forwards `/api` to the API at `http://localhost:5254`; the Docker frontend uses Nginx to forward the same paths to the API container.

## Tests

The API integration tests use in-memory Google Storage substitutes and require no Google credentials or bucket:

```bash
dotnet restore VidaPlenaArchives.WebApi.slnx --source https://api.nuget.org/v3/index.json
dotnet test VidaPlenaArchives.WebApi.slnx --no-restore
```

## Document access

- `POST /api/archives/archive`: upload a multipart `file` (up to 20 MiB) and retention `days` (1–36500).
- `GET /api/archives/?pageSize=20`: list active documents, with an optional `pageToken`. `pageSize` defaults to 20 when omitted and accepts values from 1 to 100.
- `GET /api/archives/{id}`: get active document metadata.
- `GET /api/archives/{id}/content`: return the file bytes through the API, including support for range requests. PDFs, plain text, and common raster images open inline; other formats download as attachments.

Upload, list, and detail responses include a relative `url` pointing to the content endpoint. Clients on a different origin should resolve it against the API base URL. Missing and expired documents return 404 for details and content and are excluded from listings. Document responses use `Cache-Control: no-store`. Downloads are buffered in API memory before the response begins to support range requests and return clean errors if an object disappears during download.

The API stores each document's expiry in the object's `customTime`. Configure a bucket lifecycle Delete rule for the `documents/` prefix with `daysSinceCustomTime: 0`; the API checks expiry immediately even while bucket lifecycle processing is pending.

The API's Google credentials authenticate access to Cloud Storage. The application currently has no end-user authentication, so anyone who can reach its endpoints can list, upload, and retrieve active documents.
