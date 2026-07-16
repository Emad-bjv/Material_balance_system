# Task List — بهینه‌سازی جهان‌پارس (ادامه)

## فاز ۱: بک‌اند — کش Redis و سیگنال‌ها (بحرانی)
- `[ ]` 1.1 اضافه کردن `django-redis` به requirements.txt
- `[ ]` 1.2 تنظیم `CACHES` با Redis در settings.py
- `[ ]` 1.3 پیاده‌سازی Redis caching در views.py (dashboard, charts)
- `[ ]` 1.4 اضافه کردن cache invalidation در signals.py

## فاز ۲: بک‌اند — رفع N+1 و Pagination (مهم)
- `[ ]` 2.1 رفع N+1 در WorkCategorySerializer (annotate در ViewSet)
- `[ ]` 2.2 اضافه کردن pagination به ContractorViewSet
- `[ ]` 2.3 اضافه کردن pagination به WorkCategoryViewSet و MaterialItemViewSet
- `[ ]` 2.4 بهبود pagination در audit_logs_list

## فاز ۳: بک‌اند — بهینه‌سازی Excel و خدمات (متوسط)
- `[ ]` 3.1 اعمال `write_only=True` در openpyxl Workbook در services.py
- `[ ]` 3.2 بهینه‌سازی recalculate_all_balances_for_material با bulk processing

## فاز ۴: WebSocket (متوسط)
- `[ ]` 4.1 اضافه کردن `channels` و `channels-redis` به requirements.txt
- `[ ]` 4.2 تنظیم Django Channels در settings.py و asgi.py
- `[ ]` 4.3 ایجاد WebSocket Consumer (balance/consumers.py)
- `[ ]` 4.4 ایجاد routing.py برای WebSocket
- `[ ]` 4.5 ارسال progress از Celery task به WebSocket

## فاز ۵: فرانت‌اند (متوسط)
- `[ ]` 5.1 Code Splitting با React.lazy() در App.jsx
- `[ ]` 5.2 اضافه کردن pagination به فرانت‌اند ContractorsManager
- `[ ]` 5.3 اضافه کردن pagination به فرانت‌اند WarehouseInventory
- `[ ]` 5.4 اضافه کردن pagination به فرانت‌اند AuditLog
- `[ ]` 5.5 جایگزینی polling با WebSocket در DownloadContext.jsx
- `[ ]` 5.6 شکستن DashboardOverview.jsx به کامپوننت‌های کوچکتر
