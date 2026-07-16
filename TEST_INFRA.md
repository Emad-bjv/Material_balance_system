# TEST_INFRA.md — Jahan Pars E2E Testing Suite Index

This document serves as the index and specifications guide for the comprehensive, requirement-driven, opaque-box End-to-End (E2E) testing suite for the Jahan Pars Optimization Project.

---

## 1. Test Philosophy & Methodology

The core testing philosophy of the Jahan Pars Optimization project is **genuine, opaque-box validation**. The test suite is designed to interface with the system via its external API endpoints and WebSocket protocol handlers to verify performance, data consistency, caching efficiency, and scalability guarantees.

### Key Principles:
1. **Opaque-Box Testing**: Testing is conducted primarily through Django and Django REST Framework (DRF) test clients or WebSocket communicators, querying the system exactly as a front-end client or external client would.
2. **Behavior Verification**: Tests assert functional and non-functional behavior (e.g. caching hit rates, query efficiency, pagination schema adherence, socket frames) rather than internal mock-heavy implementations.
3. **No Cheating**: Test asserts must verify real state transitions, authentic database query counts, actual Redis cache invalidation, and true file generation. No hardcoded or dummy returns are permitted.
4. **Performance Safety**: Regression checks are integrated into the test suite to guard against query regressions (N+1 queries), unnecessary data transfers (large base64 image field payloads), and thread-blocking file generation.

---

## 2. Feature Inventory

The Jahan Pars system optimization concentrates on six core backend and communication features:

| Feature ID | Feature Name | Description | Target DRF Endpoints / Protocols |
|---|---|---|---|
| **F1** | Dashboard Caching & Invalidation | Fetching dashboard charts data using condensed/conditional aggregate queries, cached in Redis, with signal-based cache invalidation when transactions are modified. | `GET /api/dashboard/charts/` |
| **F2** | Warehouse Transaction Image Deferral | Deferring large `bill_of_lading_image` and `exit_document_image` fields in transaction list queries to avoid sending heavy payloads unless single instance detail is requested. | `GET /api/transactions/`<br>`GET /api/transactions/<id>/` |
| **F3** | WorkCategory N+1 Optimization | Eliminating N+1 query loops when listing work categories by annotating `materials_count` in the viewset query instead of evaluating it dynamically per row. | `GET /api/categories/` |
| **F4** | Server-Side Pagination | Standard DRF pagination returns for inventory, contractors, material items, and system audit logs. | `GET /api/balance/inventory/`<br>`GET /api/contractors/`<br>`GET /api/materials/`<br>`GET /api/audit-logs/` |
| **F5** | Celery Excel Export Optimization | Optimization of background Excel report generation using openpyxl `write_only` mode, chunked query fetching (5,000 rows), and periodic temp file disk persistence (10,000 rows). | `POST /api/balance/download/`<br>`GET /api/balance/export-status/<uuid:task_id>/` |
| **F6** | WebSocket Progress Updates | Real-time task progress notifications pushed to the client using a Django Channels consumer instead of legacy HTTP polling. | `ws/export-progress/<uuid:task_id>/` |

---

## 3. Test Architecture

### 3.1 Test Runner & Invocation
All E2E test cases reside under the `balance/e2e_tests/` module directory. The test suite is invoked using Django's default test runner pointing to this directory:

```bash
python manage.py test balance.e2e_tests
```

### 3.2 Directory Layout
```
balance/e2e_tests/
├── __init__.py                   # Package initializer
├── helpers.py                    # Shared test helpers, JWT Auth, and custom assertions
├── test_f1_dashboard.py          # Dashboard caching and aggregation tests
├── test_f2_warehouse.py          # Warehouse transaction image deferral tests
├── test_f3_work_categories.py    # WorkCategory N+1 query optimization tests
├── test_f4_pagination.py         # Server-side pagination schema and limits tests
├── test_f5_excel_export.py       # Celery background Excel export optimization tests
├── test_f6_websocket.py          # Channels WebSocket consumer progress updates tests
├── test_tier3_cross_feature.py   # Multi-feature interaction tests (Tier 3)
└── test_tier4_real_world.py      # Real-world application scenario pipelines (Tier 4)
```

---

## 4. Real-World Application Scenarios (Tier 4)

Tier 4 tests consist of at least six pipeline scenarios simulating realistic day-to-day operations at Jahan Pars:

### Scenario 1: Contractor Onboarding, Materials Procurement, and First Inventory Dispatch
* **Goal**: Validate the complete workflow of introducing a new contractor, assigning work category materials, recording inventory inbound, executing an outbound dispatch, and verifying dashboard chart updates.
* **User Persona**: Technical Office Administrator and Warehouse Keeper.
* **Steps**:
  1. Admin registers a new Contractor (`ContractorViewSet`).
  2. Admin defines a new WorkCategory and links multiple MaterialItems to it.
  3. Warehouse Keeper posts an inbound transaction (`IN`) to replenish stock.
  4. Warehouse Keeper posts an outbound transaction (`OUT`) transferring materials to the contractor, including base64 scan images.
  5. Fetch dashboard charts to verify statistics updated.
* **Verification Points**:
  - Verification that the dashboard cache was invalidated after outbound posting.
  - Verification that the outbound transaction does not include the heavy base64 image in the list endpoint, but does in the detail view.
  - Verification that audit log records are written for every mutating step.

### Scenario 2: High-Volume Material Balance Reconciliation
* **Goal**: Verify system integrity and efficiency under high-volume transaction loads.
* **User Persona**: Technical Office Auditor.
* **Steps**:
  1. Seed the database with 1,000 transaction records across multiple materials and contractors.
  2. Request a global material balance listing.
  3. Traverse paginated pages to view calculations.
  4. Query the server-side audit logs with filtering.
* **Verification Points**:
  - Verification of pagination schema (count, next, previous, results) for each page.
  - Verification that query count is bounded and does not grow linearly with category list sizes (N+1 query prevention).
  - Validation that PDF/CSV generation requests are throttled correctly.

### Scenario 3: Material Depletion Alert and Storage Restocking Pipeline
* **Goal**: Verify that when inventory drops below critical thresholds due to contractor outbound operations, warnings are logged, notifications generated, and cache states remain correct.
* **User Persona**: Warehouse Keeper.
* **Steps**:
  1. Set a material item's safety threshold.
  2. Record a transaction with quantity exceeding safety margins.
  3. Request system notifications endpoint.
  4. Replenish stock via a new inbound transaction.
  5. Re-check notifications.
* **Verification Points**:
  - The notifications endpoint reflects the depleted item.
  - Outbound transaction does not leak image payloads in listing.
  - Restocking invalidates the dashboard cache and removes the notification warning.

### Scenario 4: Concurrent Multi-Contractor Balance Export and Real-time Tracking
* **Goal**: Verify that multiple users can spawn concurrent background report generation tasks and track progress individually without race conditions.
* **User Persona**: Multiple Contractors / Technical Office Staff.
* **Steps**:
  1. Authenticate multiple users concurrently.
  2. Initiate separate Excel export tasks.
  3. Connect to the WebSocket endpoint for each respective task ID.
  4. Broadcast progress values from Celery tasks.
* **Verification Points**:
  - Parallel WebSockets receive correct, segregated task IDs and progress updates.
  - Task results are persisted to media storage as valid, non-corrupted `.xlsx` spreadsheets.
  - Caching layers remain decoupled and do not conflict.

### Scenario 5: Historical Modifications Review and Auditing Trail Analysis
* **Goal**: Ensure changes to critical data (contractors, materials) are audited, paginated, and accessible only to superusers.
* **User Persona**: System Superuser.
* **Steps**:
  1. Modify details of a material and contractor.
  2. Access the `/api/audit-logs/` endpoint as a normal user (asserting 403 Forbidden).
  3. Access the `/api/audit-logs/` endpoint as a superuser.
  4. Paginate, filter, and inspect modifications.
* **Verification Points**:
  - Verification of role enforcement for audit logs.
  - Verification that the changes payload accurately stores `'before'` and `'after'` snapshots.
  - Verification that query execution is optimized for audit logs.

### Scenario 6: Fault Tolerant Task Interruption and Rolled-back Transactions
* **Goal**: Ensure that database transactions roll back on validation failure without leaking invalid state to the cache or leaving orphaned background tasks.
* **User Persona**: Technical Office Clerk.
* **Steps**:
  1. Attempt to register a transaction with an invalid material reference or negative quantities.
  2. Trigger task cancellation on an active Celery export.
  3. Request dashboard charts.
* **Verification Points**:
  - Verification of database rollback (no transaction registered).
  - Dashboard cache is NOT invalidated because database state did not mutate.
  - Excel export state updates to `CANCELLED` and resources are cleaned up.

---

## 5. Coverage Thresholds (72 Total Tests)

To satisfy the test runner quality metrics, a minimum of 72 test cases must be implemented, divided into four logical Tiers.

### 5.1 Tier 1: Feature Coverage (30 Tests)

#### Feature 1: Dashboard Caching & Invalidation (5 Tests)
1. `test_dashboard_charts_retrieval_success`: Verify authenticated users can retrieve dashboard charts data with default parameters.
2. `test_dashboard_charts_redis_caching`: Verify that a second call to dashboard charts returns data from the Redis cache (query count is zero or significantly reduced).
3. `test_dashboard_charts_invalidation_on_create`: Verify that creating a new transaction invalidates the cache (subsequent GET fetches fresh data and re-caches it).
4. `test_dashboard_charts_invalidation_on_update`: Verify that updating an existing transaction invalidates the cache.
5. `test_dashboard_charts_invalidation_on_delete`: Verify that deleting a transaction invalidates the cache.

#### Feature 2: Warehouse Transaction Image Deferral (5 Tests)
6. `test_transaction_list_excludes_images`: Verify that `bill_of_lading_image` and `exit_document_image` are omitted or null in the transaction list GET API response.
7. `test_transaction_detail_includes_images`: Verify that detail GET api `/api/transactions/<id>/` successfully returns `bill_of_lading_image` and `exit_document_image` data.
8. `test_transaction_list_sql_deferral`: Verify by capturing queries that the image columns are indeed deferred (omitted from the SELECT query fields).
9. `test_transaction_create_with_images`: Verify that creating a transaction with base64 images succeeds and stores data correctly.
10. `test_transaction_update_images`: Verify that updating the image fields in a transaction details works correctly and only detail GET returns the updated values.

#### Feature 3: WorkCategory N+1 Optimization (5 Tests)
11. `test_work_category_list_success`: Verify categories can be listed and serialized successfully.
12. `test_work_category_n_plus_one_prevention`: Verify that query count remains constant when listing N categories compared to 1 category (asserting O(1) query behavior for materials_count).
13. `test_work_category_materials_count_correctness`: Verify that `materials_count` returned matches the actual number of materials under each category.
14. `test_work_category_empty_category_count`: Verify that a category with 0 materials returns `materials_count = 0` correctly.
15. `test_work_category_add_material_updates_count`: Verify that adding a material updates the annotated count in subsequent list requests.

#### Feature 4: Server-Side Pagination (5 Tests)
16. `test_contractors_pagination_format`: Verify `/api/contractors/` returns standard keys: `count`, `next`, `previous`, `results`.
17. `test_materials_pagination_format`: Verify `/api/materials/` returns standard keys: `count`, `next`, `previous`, `results`.
18. `test_inventory_pagination_format`: Verify `/api/balance/inventory/` returns standard keys: `count`, `next`, `previous`, `results`.
19. `test_audit_logs_pagination_format`: Verify `/api/audit-logs/` (superuser) returns standard keys: `count`, `next`, `previous`, `results`.
20. `test_pagination_page_size_parameter`: Verify that changing `page_size` query parameter controls the number of items returned in `results`.

#### Feature 5: Celery Excel Export Optimization (5 Tests)
21. `test_excel_export_task_creation`: Verify that POSTing to the export endpoint creates an `ExportTask` in the database with status `'PENDING'`.
22. `test_excel_export_openpyxl_write_only`: Mock/spy on openpyxl's `Workbook` instantiation during task execution to assert `write_only=True` is enabled.
23. `test_excel_export_chunk_size`: Verify that the task processes database records using the configured chunk size of 5000 rows.
24. `test_excel_export_writes_file_successfully`: Verify that task runs successfully, saves the excel file to the media directory, and updates `ExportTask` status to `'SUCCESS'`.
25. `test_excel_export_progress_updates`: Verify that `ExportTask` progress is updated periodically (e.g. 1%, 50%, 100%) during generation.

#### Feature 6: WebSocket Progress Updates (5 Tests)
26. `test_websocket_connection_success`: Verify a client can connect to `ws/export-progress/<task_id>/`.
27. `test_websocket_invalid_task_id`: Verify WebSocket connection is closed or rejected when task ID is non-existent.
28. `test_websocket_sends_progress_json`: Verify that when task progress is updated in Celery, the WebSocket consumer pushes a message in the correct JSON format.
29. `test_websocket_sends_success_status`: Verify WebSocket sends terminal SUCCESS message with `result_url` when task completes.
30. `test_websocket_closes_on_completion`: Verify WebSocket connection is closed by the server once the task reaches a terminal status (`SUCCESS` or `FAILURE`).

---

### 5.2 Tier 2: Boundary & Corner Cases (30 Tests)

#### Feature 1: Dashboard Caching & Invalidation (5 Tests)
31. `test_dashboard_charts_invalid_period`: Verify request fallback and validation behavior when an invalid period parameter is passed.
32. `test_dashboard_charts_empty_date_range`: Verify correct behavior when custom date range has no transactions (should return empty trends structure without raising exceptions).
33. `test_dashboard_charts_nonexistent_contractor_id`: Verify that filtering by a non-existent contractor ID returns zero-valued response instead of error.
34. `test_dashboard_charts_concurrent_cache_stampede`: Verify cache handling under concurrent identical requests (subsequent requests must wait or reuse first result).
35. `test_dashboard_charts_cache_TTL`: Verify that the dashboard cache expires after the configured Time-To-Live (TTL).

#### Feature 2: Warehouse Transaction Image Deferral (5 Tests)
36. `test_transaction_detail_missing_images`: Verify detail endpoint returns null or empty string fields for transactions created without images.
37. `test_transaction_large_base64_payload`: Verify server handles extremely large base64 image strings without memory overflow or timeout.
38. `test_transaction_invalid_base64_format`: Verify request validation fails with 400 Bad Request when malformed base64 strings are posted.
39. `test_transaction_partial_update_only_images`: Verify that patching only `bill_of_lading_image` or `exit_document_image` updates them successfully without altering other fields.
40. `test_transaction_delete_removes_image_references`: Verify transaction deletion cleans up database and any file storage resources associated with deferred images.

#### Feature 3: WorkCategory N+1 Optimization (5 Tests)
41. `test_work_category_serializer_zero_categories`: Verify that listing categories returns an empty list `[]` without error when none exist in DB.
42. `test_work_category_name_max_length`: Verify serializer/database validation when creating a work category with name matching maximum field length boundaries.
43. `test_work_category_duplicate_name`: Verify unique constraints prevent creating two work categories with the same name.
44. `test_work_category_nested_materials_serialization`: Verify materials nested serialization remains optimized and does not trigger N+1 when displaying material details inside category lists.
45. `test_work_category_unicode_and_persian_normalization`: Verify work category names containing special characters or Persian letters are normalized and searched properly.

#### Feature 4: Server-Side Pagination (5 Tests)
46. `test_pagination_invalid_page_number`: Verify requesting a negative, non-integer, or out-of-range page number returns 404.
47. `test_pagination_zero_page_size`: Verify requesting `page_size=0` defaults to standard page size or returns an error.
48. `test_pagination_max_page_size_limit`: Verify that requesting a huge page size (e.g. 100000) is capped at `max_page_size` (e.g. 1000).
49. `test_pagination_empty_results_page`: Verify that when page is valid but results are empty, standard pagination structure is still returned with empty list.
50. `test_pagination_links_ssl_behind_proxy`: Verify that `next` and `previous` URLs construct absolute paths with correct schema (http vs https) when behind a reverse proxy.

#### Feature 5: Celery Excel Export Optimization (5 Tests)
51. `test_excel_export_empty_database`: Verify that exporting when there are no transactions works and generates a valid empty workbook with headers.
52. `test_excel_export_task_cancellation`: Verify that cancelling an active export task updates status to `'CANCELLED'` and aborts Celery execution gracefully.
53. `test_excel_export_unauthorized_user`: Verify non-staff/unauthorized users are denied export task creation.
54. `test_excel_export_disk_full_handling`: Verify task handles write failures (e.g., out of disk space) gracefully, updating task status to `'FAILURE'` with a descriptive error message.
55. `test_excel_export_unicode_sheet_names`: Verify exporting data containing complex Persian characters does not crash the openpyxl workbook engine.

#### Feature 6: WebSocket Progress Updates (5 Tests)
56. `test_websocket_unauthenticated_connection`: Verify WebSocket connection is rejected if authentication token is invalid or missing.
57. `test_websocket_task_failure_broadcast`: Verify WebSocket broadcasts error status and message when the Celery task fails.
58. `test_websocket_multiple_listeners`: Verify multiple WebSocket clients can connect to the same task ID and all receive the same progress broadcast.
59. `test_websocket_connection_mid_task`: Verify a client connecting midway through task execution receives the last cached progress state immediately.
60. `test_websocket_inactive_task_cleanup`: Verify channel group resources are freed and connections terminated for idle/abandoned tasks.

---

### 5.3 Tier 3: Cross-Feature Combinations (6 Tests)

61. `test_dashboard_caching_during_large_excel_export`: Verify that running a heavy Celery Excel export (F5) does not block or clear unrelated dashboard cache entries (F1).
62. `test_image_deferral_under_pagination`: Verify that paginating warehouse transactions (F4) correctly defers image fields (F2) across all paginated pages.
63. `test_websocket_progress_for_pagination_export`: Verify WebSocket progress updates (F6) function correctly for an Excel export (F5) of large paginated datasets.
64. `test_cache_invalidation_via_bulk_transaction_create`: Verify that bulk creating transactions invalidates the dashboard cache (F1) and that the query count for the invalidated page is correct.
65. `test_work_category_materials_count_in_paginated_list`: Verify that pagination (F4) and N+1 query optimization (F3) work together without issues on categories listing.
66. `test_transaction_detail_reloading_deferred_images_during_pagination`: Verify that while paginating transactions (F4), retrieving details (F2) correctly loads lazy images without N+1 query regression.

---

### 5.4 Tier 4: Real-World Application Scenarios (6 Tests)

67. `test_scenario_contractor_onboarding_and_first_delivery`: Complex onboarding pipeline + stock procurement + dispatch with image upload + dashboard caching assertion.
68. `test_scenario_large_scale_material_distribution_and_balance_verification`: Multi-material distribution across multiple contractors + verification of paginated lists and balance reports without database query explosion.
69. `test_scenario_critical_stock_warning_and_replenishment`: Transaction drops stock below safety limits, notifications are broadcast, replenishment is registered, invalidation is verified.
70. `test_scenario_concurrent_multi_contractor_billing_export`: Parallel Celery export task instantiation tracked concurrently via WebSockets, ensuring data isolation and output consistency.
71. `test_scenario_historical_audit_log_review_and_filtering`: Performing administrative edits and querying the audit log under strict authorization, checking result pagination and DB query overhead.
72. `test_scenario_transaction_rollback_and_cache_integrity`: Failed transaction validation rolls back the DB cleanly, verifying that dashboard cache is untouched and remains consistent with the DB.
