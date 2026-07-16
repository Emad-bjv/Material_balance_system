from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import WarehouseTransaction, TechnicalOfficeApproval, MaterialItem
from .services import update_global_balance_for_key, recalculate_all_balances_for_material

def invalidate_dashboard_cache():
    cache.delete('dashboard_summary_data')


@receiver(pre_save, sender=WarehouseTransaction)
def store_old_transaction_fields(sender, instance, **kwargs):
    """
    ذخیره کلیدهای تراکنش قبل از آپدیت، تا اگر مقادیر تغییر کردند، موازنه کلید قبلی هم به‌روز شود.
    """
    if instance.pk:
        try:
            old_inst = WarehouseTransaction.objects.only('contractor', 'material', 'contract_number', 'contract_subject').get(pk=instance.pk)
            instance._old_key = (
                old_inst.contractor_id,
                old_inst.material_id,
                old_inst.contract_number or '',
                old_inst.contract_subject or ''
            )
        except WarehouseTransaction.DoesNotExist:
            instance._old_key = None
    else:
        instance._old_key = None


@receiver(post_save, sender=WarehouseTransaction)
def update_balance_on_transaction_save(sender, instance, created, **kwargs):
    """
    به‌روزرسانی جدول پیش‌محاسبه موازنه هنگام ذخیره تراکنش خروج.
    """
    if instance.transaction_type != 'OUT':
        return

    key = (
        instance.contractor_id,
        instance.material_id,
        instance.contract_number or '',
        instance.contract_subject or ''
    )
    # به‌روزرسانی کلید جدید
    update_global_balance_for_key(*key)

    # اگر فیلدهای کلید تغییر کرده بودند، کلید قبلی را هم به‌روزرسانی می‌کنیم
    if hasattr(instance, '_old_key') and instance._old_key and instance._old_key != key:
        update_global_balance_for_key(*instance._old_key)
        
    invalidate_dashboard_cache()


@receiver(post_delete, sender=WarehouseTransaction)
def update_balance_on_transaction_delete(sender, instance, **kwargs):
    """
    به‌روزرسانی جدول پیش‌محاسبه موازنه هنگام حذف تراکنش خروج.
    """
    if instance.transaction_type != 'OUT':
        return

    key = (
        instance.contractor_id,
        instance.material_id,
        instance.contract_number or '',
        instance.contract_subject or ''
    )
    update_global_balance_for_key(*key)
    invalidate_dashboard_cache()


@receiver(pre_save, sender=TechnicalOfficeApproval)
def store_old_approval_fields(sender, instance, **kwargs):
    """
    ذخیره کلیدهای تاییدیه قبل از آپدیت، تا در صورت تغییر مقادیر، موازنه کلید قبلی هم به‌روز شود.
    """
    if instance.pk:
        try:
            old_inst = TechnicalOfficeApproval.objects.get(pk=instance.pk)
            instance._old_key = (
                old_inst.contractor_id,
                old_inst.material_id,
                old_inst.contract_number or '',
                old_inst.contract_subject or ''
            )
        except TechnicalOfficeApproval.DoesNotExist:
            instance._old_key = None
    else:
        instance._old_key = None


@receiver(post_save, sender=TechnicalOfficeApproval)
def update_balance_on_approval_save(sender, instance, created, **kwargs):
    """
    به‌روزرسانی جدول پیش‌محاسبه موازنه هنگام ذخیره تاییدیه عملکرد دفتر فنی.
    """
    key = (
        instance.contractor_id,
        instance.material_id,
        instance.contract_number or '',
        instance.contract_subject or ''
    )
    # به‌روزرسانی کلید جدید
    update_global_balance_for_key(*key)

    # اگر فیلدهای کلید تغییر کرده بودند، کلید قبلی را هم به‌روزرسانی می‌کنیم
    if hasattr(instance, '_old_key') and instance._old_key and instance._old_key != key:
        update_global_balance_for_key(*instance._old_key)
        
    invalidate_dashboard_cache()


@receiver(post_delete, sender=TechnicalOfficeApproval)
def update_balance_on_approval_delete(sender, instance, **kwargs):
    """
    به‌روزرسانی جدول پیش‌محاسبه موازنه هنگام حذف تاییدیه عملکرد دفتر فنی.
    """
    key = (
        instance.contractor_id,
        instance.material_id,
        instance.contract_number or '',
        instance.contract_subject or ''
    )
    update_global_balance_for_key(*key)
    invalidate_dashboard_cache()


@receiver(pre_save, sender=MaterialItem)
def store_old_material_fields(sender, instance, **kwargs):
    """
    ذخیره درصد پرتی قبل از آپدیت، جهت تشخیص تغییر آن.
    """
    if instance.pk:
        try:
            old_inst = MaterialItem.objects.get(pk=instance.pk)
            instance._old_waste_percentage = old_inst.waste_percentage
        except MaterialItem.DoesNotExist:
            instance._old_waste_percentage = None
    else:
        instance._old_waste_percentage = None


@receiver(post_save, sender=MaterialItem)
def update_balance_on_material_save(sender, instance, created, **kwargs):
    """
    به‌روزرسانی موازنه تمام پیمانکاران مرتبط با کالا در صورت تغییر درصد پرتی کالا.
    """
    if not created and hasattr(instance, '_old_waste_percentage') and instance._old_waste_percentage != instance.waste_percentage:
        recalculate_all_balances_for_material(instance.id)
        invalidate_dashboard_cache()
