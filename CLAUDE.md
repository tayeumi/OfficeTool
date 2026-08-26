# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

OfficeTool is a NestJS API providing PDF processing tools (merge, split, compress, to-image, watermark, page-numbers) for Vietnamese office workers. User-facing strings (Swagger descriptions, error messages) are in Vietnamese. The API code lives in `api/`; the repo root only holds `docker-compose.yml` for orchestrating the API alongside Redis.

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

Requires a running Redis instance (see `api/.env.example` for `REDIS_HOST`/`REDIS_PORT`, defaults to `localhost:6379`). `docker-compose up` from the repo root brings up Redis + the API together (API on port 3000, storage persisted in a named volume).

Swagger UI is served at `/docs` once the app is running.

## Architecture

The API processes files asynchronously via a job queue rather than handling them synchronously in the request:

1. **Upload** — `PdfController` (`api/src/pdf/pdf.controller.ts`) accepts multipart uploads via Multer's `diskStorage`, writing directly into `StorageService`'s uploads directory with randomized filenames (UUID + original extension). Validates file count/mimetype before queueing. `merge` accepts multiple files (`FilesInterceptor`); `split`/`compress`/`to-image`/`watermark`/`page-numbers` accept a single file (`FileInterceptor` via the shared `singlePdfUpload` interceptor + `assertIsPdf` guard).
2. **Queue** — `PdfService` has one `queueX` method per tool (`queueMerge`, `queueSplit`, `queueCompress`, `queueToImage`, `queueWatermark`, `queuePageNumbers`), each enqueuing a BullMQ job with its own data shape (see `PdfJobData` union in `api/src/jobs/jobs.constants.ts`) onto the `pdf` queue (`PDF_QUEUE`) and returning a `jobId` immediately. Output filenames are UUID-based (`.pdf`, except `to-image` which produces a `.zip`).
3. **Process** — `PdfProcessor` (a BullMQ `WorkerHost`) picks up jobs by `job.name`, switching over `PdfJobName` (`Merge`/`Split`/`Compress`/`ToImage`/`Watermark`/`PageNumbers`) to a private handler method, then writes output into `StorageService`'s outputs directory via the shared `saveOutput` helper (`to-image` streams pages to a zip archive instead). PDF manipulation uses `pdf-lib`; page-image rendering uses `pdf-to-img`; zipping uses `archiver`. `split` parses page-range strings (e.g. `"1-3,5,8-10"`) via `api/src/pdf/page-range.util.ts`.
4. **Poll/Download** — Clients poll `GET /pdf/jobs/:jobId` for status (`pending`/`active`/`completed`/`failed`) via `job.getState()`, then `GET /pdf/download/:fileName` to fetch the completed file once `state === 'completed'`.

To add a new tool (e.g. a new PDF/Office operation) that follows this pattern:
- Add a job name + data/result interfaces to `jobs.constants.ts` (or a parallel constants file if it's a different domain queue).
- Add a controller endpoint that validates input, saves uploads via `diskStorage`, and calls a service method that enqueues a job.
- Add/extend a `WorkerHost` processor with a `switch` on `job.name` for the new job type.
- Reuse `StorageService` for all file paths — do not construct upload/output paths manually.

**Storage lifecycle**: `StorageService` (`api/src/storage/storage.service.ts`) is a global module (`@Global()`) providing `uploadsDir`/`outputsDir` under `STORAGE_DIR`, created on module init. `CleanupScheduler` runs every 10 minutes (`@nestjs/schedule`) and deletes files older than `FILE_TTL_MINUTES` from both directories — there is no per-job cleanup, expiry is purely mtime-based and periodic.

**Config**: all env vars are centralized in `api/src/config/app.config.ts` and loaded globally via `ConfigModule.forRoot({ isGlobal: true })`; access via `ConfigService.get()` with dotted keys (`redis.host`, `storage.dir`, etc.), not `process.env` directly (except in `main.ts` bootstrap and the Multer destination in `pdf.controller.ts`, which run before DI is available).

**BullMQ/Redis connection**: configured once in `AppModule` via `BullModule.forRootAsync`; individual feature modules only need `BullModule.registerQueue({ name: QUEUE_NAME })`.
