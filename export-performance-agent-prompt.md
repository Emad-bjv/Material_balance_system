# Implementation prompt: production-grade export performance overhaul — Jahanpars

You are a senior backend/full-stack engineer with full write access to this Django + Celery + React repository. Implement every task below directly in the codebase. No partial implementations, TODOs, or placeholders. Preserve existing functionality (auth/permissions, audit logging, signal-based balance recalculation, pause/cancel UX, RTL/Persian UI) unless a task explicitly says to replace it. After implementing, run the test suite, fix anything you break, add tests for new code paths, then produce the closing report specified at the end.

## Non-negotiable constraints
- No regressions to existing API contracts, URLs, or frontend components unless stated.
- No new Django migrations unless explicitly required below (none are).
- Every storage/queue change must work with MinIO/S3 env vars absent (local dev fallback) AND present (production).
- Any queryset expected to return >10k rows must use `.iterator(chunk_size=...)`.
- All new background-task code must update `ExportTask` status/progress/error_message using the patterns already in `balance/tasks.py`.

## Codebase map
- `balance/services.py` — Excel generation: `generate_global_material_balance_excel`, `_build_global_sheet`, `_build_contractor_sheet`, style helpers (`_apply_data_style`, `_apply_balance_style`, `_register_named_styles`), `get_global_material_balance_rows_data`.
- `balance/pdf_service.py` — PDF generation: `generate_global_material_balance_pdf`, `get_balance_pdf_response`.
- `balance/tasks.py` — Celery tasks wrapping the above, updating `ExportTask`.
- `balance/models.py` — `ExportTask`, `GlobalMaterialBalance` (precomputed balance table).
- `balance/views.py`, `balance/urls.py` — REST endpoints incl. `download_global_balance`, `download_global_pdf`.
- `jahanpars/settings.py`, `jahanpars/celery.py` — Django/Celery config.
- `frontend/src/contexts/DownloadContext.jsx` — task queueing/polling/download UX.
- `frontend/src/pages/Dashboard/DashboardOverview.jsx` — export trigger buttons.

## Phase 1 — Streaming Excel writer (highest priority)
In `balance/services.py`:
- Convert `_build_global_sheet` + `generate_global_material_balance_excel` to `Workbook(write_only=True)`. Build every row — including the title/info/header rows currently set via `ws.cell()` — as a list of `openpyxl.cell.WriteOnlyCell` objects appended via `ws.append(row)`. `merge_cells()` still works unchanged in write-only mode.
- Reuse existing `NamedStyle` names from `_register_named_styles` (`cell.style = "..."`); do not duplicate style logic.
- Add new write-only row-building helper(s) parallel to `_apply_data_style`/`_apply_balance_style`. Leave those two functions untouched — `_build_contractor_sheet` still uses normal `Workbook()` mode (bounded row counts) and depends on them as-is.
- **Resume behavior change (intentional):** write-only workbooks cannot be reopened, so the current temp-`.xlsx`-reload resume path is incompatible — remove it. On `resume_from`, regenerate the full export from row 0 instead (the streaming pipeline + DB cursor make a full 1M-row regeneration fast enough that skip-ahead is unnecessary). Keep the `resume_from` parameter for signature compatibility; treat it as a retry trigger, not a row offset. This change is Excel-only — PDF keeps its own resume mechanism (Phase 7).

## Phase 2 — Server-side cursor for the bulk read
In `balance/services.py::get_global_material_balance_rows_data`, in the `if page_size is None:` branch, change `qs_values = qs.values(...)` to `qs_values = qs.values(...).iterator(chunk_size=5000)`.

## Phase 3 — Block SQLite in production
In `jahanpars/settings.py`, immediately after the `DATABASES` block, add: if `not DEBUG` and `'sqlite' in DATABASES['default']['ENGINE']`, raise `django.core.exceptions.ImproperlyConfigured` stating Postgres is required via `DATABASE_URL`. Do not change the dev-mode SQLite default.

## Phase 4 — Celery isolation & timeouts
In `jahanpars/celery.py`: add
```python
app.conf.task_routes = {'balance.tasks.*': {'queue': 'exports'}}
app.conf.task_acks_late = True
app.conf.worker_prefetch_multiplier = 1
```
In `balance/tasks.py`: add `soft_time_limit=1800, time_limit=1860` to both `@shared_task` decorators. `celery.exceptions.SoftTimeLimitExceeded` subclasses `BaseException`, not `Exception` — the existing `except Exception as e:` blocks will NOT catch it. Add an explicit `except SoftTimeLimitExceeded:` clause above the generic one that marks the `ExportTask` `FAILURE` with a clear timeout message, using the same `ExportTask.objects.filter(pk=task_id).update(...)` pattern already in the file.

## Phase 5 — Object storage + presigned downloads
Add `django-storages` and `boto3` to the dependency manifest.
In `jahanpars/settings.py`: read `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` from env. If all four are set, configure a dedicated storage instance (`storages.backends.s3.S3Storage`, `querystring_auth=True`, `querystring_expire=3600`, custom `endpoint_url`). If any are missing, fall back to the current local `MEDIA_ROOT`/`MEDIA_URL` behavior unchanged — MinIO must stay optional for local dev.
In `balance/tasks.py`, both export tasks: after the file bytes are produced, if the dedicated storage instance is configured, save through it and use its `.url(name)` as `file_url`; otherwise keep the current local-disk write + `MEDIA_URL` path exactly as-is.
In `docker-compose.yml`: add a `minio` service (image `minio/minio`, ports `9000:9000`/`9001:9001`, persisted volume, `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` env, `command: server /data --console-address ":9001"`).
No frontend changes needed — `DownloadContext.jsx` already treats `file_url` as an opaque downloadable href.

## Phase 6 — Raw CSV export (fastest path for full unfiltered data)
In `balance/views.py`: add a `global_balance_csv` view using `django.http.StreamingHttpResponse` + `csv.writer` over a generator pulling from `GlobalMaterialBalance` via `.values(...).iterator(chunk_size=5000)` (reuse the field list from `get_global_material_balance_rows_data`). Apply the same permission class already used by `download_global_balance`.
In `balance/urls.py`: add `path('balance/download-global-csv/', global_balance_csv, name='balance-download-global-csv')`.
In `frontend/src/contexts/DownloadContext.jsx`: add a `'global_csv'` branch in the endpoint switch inside `startQueuedTask` (treat as a synchronous blob download, same pattern as `warehouse_excel`) and in `getReportDisplayName`.
In `frontend/src/pages/Dashboard/DashboardOverview.jsx`: add a button next to the existing global-export button calling `triggerExport('global_csv', {}, 'خروجی CSV موازنه کل (کامل)')`.

## Phase 7 — PDF: cap size + chunk-and-merge
Add `pypdf` to the dependency manifest.
In `balance/pdf_service.py::generate_global_material_balance_pdf`: before building, if `total_rows > 50000`, raise `ValueError` with a Persian message directing the user to Excel/CSV (mirrors the existing `ValueError("توسط کاربر لغو شد.")` pattern already handled by `balance/tasks.py`'s except block).
Refactor the chunk loop: instead of appending every chunk `Table` into one `elements` list before a single `doc.build()`, render each ~1000-row chunk as its own `SimpleDocTemplate` into its own temp file under `media/temp_exports/chunks/{task_id}/chunk_{n}.pdf`. On resume, check which chunk files already exist and skip regenerating them. Once all chunks exist, merge in order with `pypdf.PdfWriter().append(chunk_path)`, write the final buffer, then delete the chunk directory. No signature change needed in `balance/tasks.py`.

## Validation
- Run `balance/tests.py`; all existing tests must still pass, including `test_global_excel_generation_no_error`, `test_pdf_generation_under_review`, `test_pdf_generation_multiple_filters`.
- Add tests covering: write-only global Excel export produces a valid non-empty `.xlsx` with the correct row count; the new CSV endpoint returns 200 with the correct row count; the PDF row-cap guard raises above the threshold.
- Confirm the app boots and exports work with MinIO env vars absent, and again with them present (mock or local MinIO container).

## Final report (required)
After implementation, report: (1) every file changed and why; (2) measured or estimated performance/memory improvement per phase; (3) any remaining bottlenecks identified but not fixed, and why; (4) manual actions required from a human (env vars to set, MinIO bucket creation, worker deployment command, dependency install).
