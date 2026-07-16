# Project: Jahan Pars Optimization

## Architecture
The project is a Django backend with a React frontend. The backend uses Django REST Framework (DRF) for APIs, Celery for background tasks, and Redis for caching and Celery message broking. The frontend is a React single page application built with Vite.

The goal is to optimize both ends to handle larger datasets (1M to 10M records) and transition file export progress tracking from polling to WebSockets.

- **Backend Stack**: Django, DRF, Celery, Redis, openpyxl, django-jalali.
- **Frontend Stack**: React (v18), React Router Dom (v6), Vite, Axios, Recharts, React Select.

## Code Layout
- `balance/models.py`: Database models (User, Contractor, WorkCategory, MaterialItem, WarehouseTransaction, TechnicalOfficeApproval, AuditLog, ExportTask).
- `balance/serializers.py`: Serializers (WorkCategorySerializer, WarehouseTransactionSerializer, etc.).
- `balance/views.py`: API views and ViewSets (dashboard aggregation, listings).
- `balance/services.py`: Business logic and Excel generation functions.
- `balance/signals.py`: Signal handlers for cache invalidation.
- `balance/tasks.py`: Celery background tasks (such as export tasks).
- `jahanpars/settings.py`: Django settings.
- `jahanpars/asgi.py`: ASGI configuration (to be configured for WebSockets).
- `jahanpars/urls.py`: Main Django URL routing.
- `frontend/src/App.jsx`: React entrypoint and routes.
- `frontend/src/contexts/DownloadContext.jsx`: Handles download state and polling.
- `frontend/src/pages/Dashboard/DashboardOverview.jsx`: Main dashboard layout and stats.
- `frontend/src/pages/Dashboard/ContractorsManager.jsx`: Contractor management table.
- `frontend/src/pages/Dashboard/MaterialsManager.jsx`: Material/inventory management table.
- `frontend/src/pages/Dashboard/AuditLog.jsx`: Audit log viewer table.
- `frontend/src/components/WarehouseInventory.jsx`: Inventory viewer.

## Milestones
| # | Name | Scope | Dependencies | Status | Conv ID |
|---|------|-------|-------------|--------|---------|
| 1 | E2E Testing Track Setup | Design and build comprehensive requirement-driven, opaque-box E2E test suite (Tiers 1-4). | None | DONE | c054d637-c1d0-45ff-8df3-2e30a6264326 |
| 2 | Backend Optimization | R1 & R2: Image deferring, Redis dashboard caching with signals, WorkCategorySerializer N+1 fix, server-side pagination, openpyxl optimizations. | None | IN_PROGRESS | ccb7fa57-ac6a-41f8-8a19-2e8914fc8795 |
| 3 | WebSocket Channels Setup | R3: Setup django-channels, channels-redis, configure ASGI/Daphne, and create progress consumer. | M2 | PLANNED | TBD |
| 4 | Frontend Refactoring | R4: App.jsx lazy loading, DashboardOverview components split, update tables for pagination, remove polling, integrate WebSockets. | M2, M3 | PLANNED | TBD |
| 5 | E2E & Hardening (Final) | Phase 1: Pass 100% of E2E tests. Phase 2: White-box adversarial coverage hardening (Tier 5). | M1, M2, M3, M4 | PLANNED | TBD |

## Interface Contracts
### Paginated Lists
For inventory, contractors, materials, and audit logs, the backend must return a standard DRF paginated response format:
- `count` (integer, total count)
- `next` (nullable string, next page URL)
- `previous` (nullable string, previous page URL)
- `results` (array of objects, paginated data)

### WebSocket Connection
- **URL**: `ws://<host>/ws/export-progress/<task_id>/`
- **Direction**: Server to Client
- **Message Format**:
  ```json
  {
    "status": "PROGRESS" | "SUCCESS" | "FAILURE",
    "progress": 0 to 100,
    "result_url": "/media/exports/filename.xlsx"  // only when status is SUCCESS
  }
  ```
