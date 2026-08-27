# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

OfficeTool is a NestJS API providing document-processing tools for Vietnamese office workers, grouped into 4 domains: **PDF** (merge, split, compress, to-image, watermark, page-numbers), **Office** (word-to-pdf, excel-to-pdf, pdf-to-word, excel-merge — via LibreOffice headless + exceljs), **Image** (compress, convert, resize — via sharp), **OCR** (image-to-text, Vietnamese — via the `tesseract` CLI). User-facing strings (Swagger descriptions, error messages) are in Vietnamese. The API code lives in `api/`; the repo root holds `docker-compose.yml` (Redis + API) and `.env.example` for production deploy config.

## Commands

All commands run from `api/`:

- `npm run start:dev` — start the API with hot reload (default port 3000)
- `npm run build` — compile with `nest build`
- `npm run lint` — ESLint with `--fix` over `src`, `apps`, `libs`, `test`
- `npm run format` — Prettier over `src/**/*.ts` and `test/**/*.ts`
- `npm test` — run unit tests (Jest, looks for `*.spec.ts` under `src`)
- `npm run test:watch` — watch mode
- `npm run test:cov` — coverage report
- `npm run test:e2e` — e2e tests via `test/jest-e2e.json`
- Run a single test file: `npx jest path/to/file.spec.ts` (or `npx jest -t "test name"` to filter by name)

Requires a running Redis instance (see `api/.env.example` for `REDIS_HOST`/`REDIS_PORT`, defaults to `localhost:6379`). `docker-compose up` from the repo root brings up Redis + the API together, storage persisted in a named volume.

Swagger UI is served at `/docs` once the app is running.

## Architecture

The API processes files asynchronously via a job queue rather than handling them synchronously in the request. Each domain (`pdf`, `office`, `image`, `ocr`) is a fully self-contained NestJS module mirroring the same shape: its own BullMQ queue, controller, service, and processor.

1. **Upload** — each domain controller (e.g. `PdfController` at `api/src/pdf/pdf.controller.ts`) accepts multipart uploads via Multer's `diskStorage`, writing into `StorageService`'s uploads directory with randomized filenames (UUID + original extension). Shared upload helpers live in `api/src/uploads/upload.util.ts`: `singleFileUpload(fieldName)` (FileInterceptor + diskStorage factory) and `assertMimetype(file, allowedMimetypes[], errorMessage)` (Vietnamese-message mimetype guard). Multi-file endpoints (`pdf/merge`, `office/excel-merge`) use `FilesInterceptor` directly instead.
2. **Queue** — each domain's `XService` has one `queueX` method per tool, enqueuing a BullMQ job with its own data shape (see the per-domain job-data interfaces in `api/src/jobs/jobs.constants.ts`) and returning `{ jobId: "<domain>:<bullmqId>" }` — the domain prefix is required because BullMQ job IDs are only unique *within* a queue, and job status/download is looked up across all 4 queues from one shared endpoint (see below).
3. **Process** — each domain's `XProcessor` (a BullMQ `WorkerHost`) switches on `job.name` to a private handler. PDF tools use `pdf-lib`/`pdf-to-img`/`archiver`. Office tools shell out to LibreOffice headless via `api/src/office/libreoffice.util.ts`'s `convertWithLibreOffice(inputPath, outputDir, targetFormat, { inFilter?, timeoutMs? })` — each call gets its own temp `-env:UserInstallation` profile dir to avoid known LibreOffice headless concurrency issues; **`pdf-to-word` requires `inFilter: 'writer_pdf_import'`** or LibreOffice fails to recognize the PDF as an importable document (surfaces as a vague "no export filter" or file-write error otherwise) — `office/excel-merge` instead uses pure-JS `exceljs` (values-only copy, no styles/merged-cells). Image tools use `sharp`. OCR shells out to the `tesseract` CLI with `-l vie` (requires the `tesseract-ocr-vie` apt package, not bundled with base `tesseract-ocr`).
4. **Poll/Download** — job status and file download are NOT per-domain routes. `JobsController` (`api/src/jobs/jobs.controller.ts`, no route prefix) exposes `GET /jobs/:jobId` and `GET /download/:fileName` for every domain. `JobsService` injects all 4 named queues, parses the domain prefix off `jobId`, and looks up the right queue.

To add a new tool within an existing domain: add a job name + data interface to `jobs.constants.ts`, a controller endpoint (reusing `singleFileUpload`/`assertMimetype`), a `queueX` method on the domain service (must prefix the returned jobId with the domain name), and a handler case in the domain processor. To add a whole new domain: mirror the `office`/`image`/`ocr` module shape exactly (queue constant, module, controller, service, processor), register the module in `app.module.ts`, and add its queue to `JobsModule`'s `BullModule.registerQueue(...)` list so `JobsService` can look it up.

**Storage lifecycle**: `StorageService` (`api/src/storage/storage.service.ts`) is a global module (`@Global()`) providing `uploadsDir`/`outputsDir` under `STORAGE_DIR`, created on module init. `CleanupScheduler` runs every 10 minutes (`@nestjs/schedule`) and deletes files older than `FILE_TTL_MINUTES` from both directories — there is no per-job cleanup, expiry is purely mtime-based and periodic.

**Config**: all env vars are centralized in `api/src/config/app.config.ts` and loaded globally via `ConfigModule.forRoot({ isGlobal: true })`; access via `ConfigService.get()` with dotted keys (`redis.host`, `storage.dir`, etc.), not `process.env` directly (except in `main.ts` bootstrap and Multer destinations, which run before DI is available).

**BullMQ/Redis connection**: configured once in `AppModule` via `BullModule.forRootAsync`; individual feature modules only need `BullModule.registerQueue({ name: QUEUE_NAME })` — registering the same queue name from multiple modules (each domain module + `JobsModule`) is safe and idiomatic, they share the same underlying queue/connection.

## Deployment

CI (`.github/workflows/docker-publish.yml`) builds and pushes the API image to `ghcr.io/tayeumi/officetool` on every push to `main` touching `api/**` (tagged `latest` and by commit SHA). The image name is lowercased explicitly — `github.repository` resolves to `tayeumi/OfficeTool` with a capital letter, and Docker/GHCR reject uppercase image refs.

Production runs via a Portainer Stack pulling that image (`docker-compose.yml` uses `image: ${OFFICETOOL_IMAGE:-ghcr.io/tayeumi/officetool:latest}`, not `build:`). Two env vars are meant to be set in Portainer's "Environment variables" form at deploy time (see root `.env.example`):
- `OFFICETOOL_IMAGE` — override to a specific commit-SHA tag to pin/rollback without editing the compose file.
- `OFFICETOOL_PORT` — host port the container's internal port 3000 is mapped to (default `30003`). The container's internal `PORT=3000` is fixed in `docker-compose.yml` and never needs to change.

In production the API sits behind a reverse proxy (Nginx Proxy Manager) at `https://ams.vienthongact.vn/tools/office/` — the proxy strips that path prefix and forwards the bare routes (`/pdf/merge`, `/office/word-to-pdf`, `/jobs/:jobId`, etc.) to the container on `OFFICETOOL_PORT`; the NestJS app itself has no knowledge of the `/tools/office` prefix and must never have `app.setGlobalPrefix(...)` added for it. The `ams` frontend's `VITE_OFFICETOOL_API_URL` must point at that same public URL in production.

CORS is wide-open (`app.enableCors()` in `main.ts`, no origin/credentials config) since the API has no auth yet — any client-side axios instance calling it **must not** set `withCredentials: true`, or browsers will hard-block every response (wildcard `Access-Control-Allow-Origin` is incompatible with credentialed requests per the CORS spec; curl-based testing won't catch this since curl doesn't send credentials).
