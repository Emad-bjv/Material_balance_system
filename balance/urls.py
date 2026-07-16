"""
urls.py - مسیرهای API برای اپلیکیشن بالانس متریال جهانپارس
============================================================
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    WorkCategoryViewSet,
    MaterialItemViewSet,
    WarehouseTransactionViewSet,
    TechnicalOfficeApprovalViewSet,
    ContractorViewSet,
    download_balance,
    download_balance_pdf,
    download_global_balance,
    download_global_pdf,
    export_task_status,
    cancel_export_task,
    active_export_tasks,
    download_warehouse_inventory,

    current_user,
    dashboard_summary,
    download_contractors,
    download_approvals,
    live_material_inventory,
    live_contractor_material_received,
    system_notifications,
    audit_logs_list,
    global_material_inventory,
    contractor_outbound_summary,
    technical_approval_summary,
    global_balance_rows,
    dashboard_charts,
    global_balance_csv,
)

# ─── Router اصلی ─────────────────────────────────────────────────────────────
router = DefaultRouter()

router.register(prefix='contractors', viewset=ContractorViewSet, basename='contractor')
router.register(prefix='categories', viewset=WorkCategoryViewSet, basename='workcategory')
router.register(prefix='materials', viewset=MaterialItemViewSet, basename='materialitem')
router.register(prefix='transactions', viewset=WarehouseTransactionViewSet, basename='warehousetransaction')
router.register(prefix='approvals', viewset=TechnicalOfficeApprovalViewSet, basename='technicalofficapproval')

# ─── URLهای نهایی اپ ─────────────────────────────────────────────────────────
urlpatterns = [
    # مسیرهای خودکار ViewSet‌ها
    path('', include(router.urls)),

    # دانلود گزارش‌های
    path('balance/download/', download_balance, name='balance-download'),
    path('balance/download-pdf/', download_balance_pdf, name='balance-download-pdf'),
    path('balance/download-global/', download_global_balance, name='balance-download-global'),
    path('balance/download-global-pdf/', download_global_pdf, name='balance-download-global-pdf'),
    path('balance/export-status/<uuid:task_id>/', export_task_status, name='balance-export-status'),
    path('balance/export-status/<uuid:task_id>/cancel/', cancel_export_task, name='balance-export-cancel'),
    path('balance/active-tasks/', active_export_tasks, name='balance-active-tasks'),

    path('balance/download-warehouse/', download_warehouse_inventory, name='balance-download-warehouse'),
    path('balance/download-contractors/', download_contractors, name='balance-download-contractors'),
    path('balance/download-approvals/', download_approvals, name='balance-download-approvals'),
    path('balance/download-global-csv/', global_balance_csv, name='balance-download-global-csv'),

    # استعلام آمار زنده
    path('balance/material-inventory/', live_material_inventory, name='balance-live-inventory'),
    path('balance/contractor-material-received/', live_contractor_material_received, name='balance-live-received'),
    path('balance/inventory/', global_material_inventory, name='balance-global-inventory'),
    path('balance/contractor-outbound/', contractor_outbound_summary, name='balance-contractor-outbound'),
    path('balance/contractor-approvals/', technical_approval_summary, name='balance-contractor-approvals'),
    path('balance/global-rows/', global_balance_rows, name='balance-global-rows'),

    # هشدارهای سیستم (نوتیفیکیشن)
    path('notifications/', system_notifications, name='system-notifications'),

    # لاگ تغییرات (فقط سوپریوزر)
    path('audit-logs/', audit_logs_list, name='audit-logs'),

    # اطلاعات کاربر و داشبورد
    path('users/me/', current_user, name='current-user'),
    path('dashboard/', dashboard_summary, name='dashboard-summary'),
    path('dashboard/charts/', dashboard_charts, name='dashboard-charts'),
]
