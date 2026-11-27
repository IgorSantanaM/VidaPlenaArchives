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
- `GOOGLE_STORAGE_CDN_BASE_URL`: your HTTPS Cloud CDN origin, such as `https://documents.example.com`, without a path, query, or custom port.
- `GOOGLE_STORAGE_CDN_KEY_NAME` and `GOOGLE_STORAGE_CDN_SIGNING_KEY`: the key name and base64url-encoded 16-byte signing key configured on your Cloud CDN backend.

Docker Compose mounts the credentials read-only into the API container. The root `.env` supplies API settings; the frontend Docker build uses `/` as its API URL and does not need `frontend/.env`. The bucket, CDN, signing key, and Google credentials must already exist; Compose runs the two application projects.

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
