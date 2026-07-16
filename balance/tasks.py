from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
import os
import logging
from django.conf import settings
from .models import ExportTask
from .services import generate_global_material_balance_excel
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

def send_task_progress(task_id, progress, status='PROCESSING', file_url=None, error_message=None, eta=None, phase=None):
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f'task_{task_id}',
            {
                'type': 'task_progress',
                'progress': progress,
                'status': status,
                'file_url': file_url,
                'error_message': error_message,
                'eta': eta,
                'phase': phase
            }
        )



def _save_export_file(file_name, file_bytes):
    """
    ذخیره فایل خروجی: اگر MinIO/S3 تنظیم شده از object storage استفاده می‌کند،
    در غیر این صورت به دیسک محلی می‌نویسد.
    """
    export_storage = getattr(settings, 'EXPORT_STORAGE', None)

    if export_storage:
        # Object storage (MinIO/S3)
        from django.core.files.base import ContentFile
        saved_name = export_storage.save(f"exports/{file_name}", ContentFile(file_bytes))
        file_url = export_storage.url(saved_name)
        return file_url
    else:
        # دیسک محلی (حالت توسعه)
        exports_dir = os.path.join(settings.MEDIA_ROOT, 'exports')
        os.makedirs(exports_dir, exist_ok=True)
        file_path = os.path.join(exports_dir, file_name)
        with open(file_path, 'wb') as f:
            f.write(file_bytes)
        return f"{settings.MEDIA_URL}exports/{file_name}"


@shared_task(soft_time_limit=1800, time_limit=1860)
def generate_global_balance_excel_task(task_id, is_superuser, resume_from=None):
    """
    تسک سلری برای تولید فایل اکسل گزارش موازنه کل در پس‌زمینه.
    """
    logger.info(f"Starting async Excel export for task: {task_id} (resume_from: {resume_from})")
    try:
        # آپدیت وضعیت به PROCESSING
        ExportTask.objects.filter(pk=task_id).update(status='PROCESSING', progress=1)

        # اجرای متد تولید اکسل. ما task_id را پاس می‌دهیم تا در طول فرآیند، پیشرفت کار آپدیت شود.
        excel_bytes = generate_global_material_balance_excel(
            is_superuser=is_superuser,
            task_id=task_id,
            resume_from=resume_from
        )

        if not excel_bytes:
            raise ValueError("فایل اکسل با محتوای خالی یا نامعتبر مواجه شد.")

        # ── ذخیره فایل: object storage یا دیسک محلی ──────────────────────
        file_name = f"global_material_balance_{task_id}.xlsx"
        file_url = _save_export_file(file_name, excel_bytes)

        # آپدیت تسک به SUCCESS
        ExportTask.objects.filter(pk=task_id).update(
            status='SUCCESS',
            progress=100,
            eta=0,
            file_url=file_url
        )
        send_task_progress(task_id, 100, status='SUCCESS', file_url=file_url)
        logger.info(f"Excel export completed successfully for task: {task_id}")

    except SoftTimeLimitExceeded:
        logger.error(f"Excel export timed out for task: {task_id}")
        msg = 'زمان تولید گزارش اکسل به پایان رسید (حداکثر ۳۰ دقیقه). لطفاً دوباره تلاش کنید یا از خروجی CSV استفاده نمایید.'
        ExportTask.objects.filter(pk=task_id).update(
            status='FAILURE',
            error_message=msg,
            progress=0,
            eta=0
        )
        send_task_progress(task_id, 0, status='FAILURE', error_message=msg)
    except Exception as e:
        logger.error(f"Error during async Excel export: {str(e)}", exc_info=True)
        # ثبت وضعیت خطا در تسک
        msg = str(e)
        ExportTask.objects.filter(pk=task_id).update(
            status='FAILURE',
            error_message=msg,
            progress=0,
            eta=0
        )
        send_task_progress(task_id, 0, status='FAILURE', error_message=msg)


@shared_task(soft_time_limit=1800, time_limit=1860)
def generate_global_balance_pdf_task(task_id, is_superuser, resume_from=None):
    """
    تسک سلری برای تولید فایل PDF گزارش موازنه کل در پس‌زمینه.
    """
    logger.info(f"Starting async PDF export for task: {task_id} (resume_from: {resume_from})")
    try:
        # آپدیت وضعیت به PROCESSING
        ExportTask.objects.filter(pk=task_id).update(status='PROCESSING', progress=1)

        # اجرای متد جدید تولید PDF موازنه کل
        from .pdf_service import generate_global_material_balance_pdf
        pdf_bytes = generate_global_material_balance_pdf(
            is_superuser=is_superuser,
            task_id=task_id,
            resume_from=resume_from
        )

        if not pdf_bytes:
            raise ValueError("فایل PDF با محتوای خالی یا نامعتبر مواجه شد.")

        # ── ذخیره فایل: object storage یا دیسک محلی ──────────────────────
        file_name = f"global_material_balance_{task_id}.pdf"
        file_url = _save_export_file(file_name, pdf_bytes)

        # آپدیت تسک به SUCCESS
        ExportTask.objects.filter(pk=task_id).update(
            status='SUCCESS',
            progress=100,
            eta=0,
            file_url=file_url
        )
        send_task_progress(task_id, 100, status='SUCCESS', file_url=file_url)
        logger.info(f"PDF export completed successfully for task: {task_id}")

    except SoftTimeLimitExceeded:
        logger.error(f"PDF export timed out for task: {task_id}")
        msg = 'زمان تولید گزارش PDF به پایان رسید (حداکثر ۳۰ دقیقه). لطفاً از خروجی اکسل یا CSV استفاده نمایید.'
        ExportTask.objects.filter(pk=task_id).update(
            status='FAILURE',
            error_message=msg,
            progress=0,
            eta=0
        )
        send_task_progress(task_id, 0, status='FAILURE', error_message=msg)
    except Exception as e:
        logger.error(f"Error during async PDF export: {str(e)}", exc_info=True)
        # ثبت وضعیت خطا در تسک
        msg = str(e)
        ExportTask.objects.filter(pk=task_id).update(
            status='FAILURE',
            error_message=msg,
            progress=0,
            eta=0
        )
        send_task_progress(task_id, 0, status='FAILURE', error_message=msg)
