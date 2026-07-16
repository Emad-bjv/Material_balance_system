from django.db import models, transaction
from django.db.models import Sum
from django.core.exceptions import ValidationError
from django.contrib.auth.models import AbstractUser, Group
from django_jalali.db import models as jmodels
from .utils import normalize_persian_text


class User(AbstractUser):
    """
    جدول کاربران سیستم
    فقط شامل نقش‌های: دفتر فنی و انباردار
    (پیمانکاران کاربر سیستم نیستند و در جدول جداگانه مدیریت می‌شوند)
    """
    ROLE_CHOICES = (
        ('TECHNICAL', 'دفتر فنی'),
        ('WAREHOUSE', 'انباردار'),
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        verbose_name="نقش کاربری",
        blank=True,
        null=True,
        help_text="دفتر فنی = مهندسین و کارشناسان | انباردار = مسئول انبار کارگاه",
    )

    class Meta:
        verbose_name = "کاربر"
        verbose_name_plural = "کاربران"

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    def save(self, *args, **kwargs):
        # هنگام ایجاد کاربر جدید، در صورت داشتن نقش، وضعیت کارمندی به طور خودکار فعال می‌شود
        if not self.pk and self.role in dict(self.ROLE_CHOICES).keys() and not self.is_superuser:
            self.is_staff = True
        super().save(*args, **kwargs)
        
        # ثبت و اختصاص گروه کاربری استاندارد جنگو بر اساس Role
        if self.role:
            try:
                group_name = f"{self.role}_GROUP"
                group = Group.objects.get(name=group_name)
                self.groups.clear()
                self.groups.add(group)
            except Group.DoesNotExist:
                pass


class Contractor(models.Model):
    """
    جدول پیمانکاران
    فقط شامل نام و نام خانوادگی. این رکوردها به صورت خودکار
    هنگام ثبت تراکنش خروج از انبار ساخته می‌شوند.
    """
    first_name = models.CharField(max_length=100, verbose_name="نام پیمانکار")
    last_name = models.CharField(max_length=100, verbose_name="نام خانوادگی پیمانکار")

    class Meta:
        verbose_name = "پیمانکار"
        verbose_name_plural = "پیمانکاران"
        unique_together = ('first_name', 'last_name')

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"


class WorkCategory(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="رسته کاری")
    description = models.TextField(blank=True, null=True, verbose_name="توضیحات")

    class Meta:
        verbose_name = "رسته کاری"
        verbose_name_plural = "رسته های کاری"

    def __str__(self):
        return self.name


class MaterialItem(models.Model):
    UNIT_CHOICES = (
        ('KG', 'کیلوگرم'),
        ('M', 'متر'),
        ('SQM', 'متر مربع'),
        ('PCS', 'عدد'),
    )
    name = models.CharField(max_length=255, verbose_name="نام کالا")
    work_category = models.ForeignKey(WorkCategory, on_delete=models.SET_NULL, null=True, related_name='materials', verbose_name="رسته کاری")
    size = models.CharField(max_length=100, blank=True, null=True, verbose_name="سایز")
    material_type = models.CharField(max_length=100, blank=True, null=True, verbose_name="جنس متریال")
    thickness = models.CharField(max_length=100, blank=True, null=True, verbose_name="ضخامت")
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, verbose_name="واحد اندازه گیری")
    waste_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name="درصد پرتی مجاز")
    low_stock_threshold = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        verbose_name="آستانه موجودی بحرانی",
        help_text="اگر موجودی انبار از این مقدار کمتر شود، هشدار صادر می‌شود. مقدار ۰ = غیرفعال."
    )
    current_stock = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        verbose_name="موجودی لحظه‌ای",
        help_text="توسط سیستم و به صورت اتمیک به‌روز می‌شود."
    )

    class Meta:
        verbose_name = "کالا / متریال"
        verbose_name_plural = "کالاها / متریال ها"

    def __str__(self):
        parts = [self.name]
        if self.size:
            parts.append(self.size)
        if self.material_type:
            parts.append(self.material_type)
        return " - ".join(parts)


class WarehouseTransaction(models.Model):
    TRANSACTION_TYPE_CHOICES = (
        ('IN', 'ورود متریال به انبار'),
        ('OUT', 'خروج متریال به پیمانکار'),
    )
    transaction_type = models.CharField(max_length=3, choices=TRANSACTION_TYPE_CHOICES, verbose_name="نوع تراکنش", db_index=True)
    material = models.ForeignKey(MaterialItem, on_delete=models.PROTECT, related_name='transactions', verbose_name="متریال")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="مقدار")

    bill_of_lading = models.CharField(
        max_length=100, blank=True, null=True, verbose_name="شماره بارنامه",
        help_text="شماره بارنامه حمل متریال (فقط برای تراکنش ورود)."
    )
    bill_of_lading_image = models.TextField(
        blank=True, null=True, verbose_name="تصویر بارنامه اسکن شده",
        help_text="تصویر بارنامه به صورت کدگذاری شده Base64."
    )

    contract_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="شماره قرارداد")
    contract_subject = models.CharField(max_length=255, blank=True, null=True, verbose_name="موضوع قرارداد")
    exit_document_image = models.TextField(
        blank=True, null=True, verbose_name="تصویر برگه خروج اسکن شده",
        help_text="تصویر برگه خروج به صورت کدگذاری شده Base64."
    )

    contractor = models.ForeignKey(
        'Contractor', on_delete=models.PROTECT, null=True, blank=True,
        verbose_name="پیمانکار"
    )

    date = jmodels.jDateField(verbose_name="تاریخ", db_index=True)
    created_at = jmodels.jDateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت در سیستم")

    objects = jmodels.jManager()

    class Meta:
        verbose_name = "تراکنش انبار"
        verbose_name_plural = "تراکنش های انبار"
        indexes = [
            models.Index(fields=['contractor', 'material']),
            models.Index(fields=['transaction_type', 'date']),
        ]

    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.material.name} - {self.quantity}"

    def clean(self):
        super().clean()
        if self.transaction_type == 'OUT':
            if not self.contractor:
                raise ValidationError({'contractor': 'برای تراکنش خروج، انتخاب پیمانکار الزامی است.'})
            
            # This is a soft check for forms. The hard check is inside save() with select_for_update()
            if not self.pk and self.quantity > self.material.current_stock:
                raise ValidationError({
                    'quantity': f'موجودی کافی نیست! موجودی فعلی انبار: {self.material.current_stock}'
                })

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if self.contract_subject:
            self.contract_subject = normalize_persian_text(self.contract_subject)
            
        if self.transaction_type == 'IN':
            self.contractor = None
            self.contract_number = None
            self.contract_subject = None
            self.exit_document_image = None
        elif self.transaction_type == 'OUT':
            self.bill_of_lading_image = None

        with transaction.atomic():
            mat = MaterialItem.objects.select_for_update().get(pk=self.material_id)
            
            if is_new:
                diff = self.quantity
            else:
                old_instance = WarehouseTransaction.objects.only('quantity').get(pk=self.pk)
                diff = self.quantity - old_instance.quantity

            if self.transaction_type == 'IN':
                mat.current_stock += diff
            elif self.transaction_type == 'OUT':
                # Re-check stock in atomic block
                old_qty = 0 if is_new else old_instance.quantity
                if self.quantity > (mat.current_stock + old_qty):
                    raise ValidationError({'quantity': f'موجودی کافی نیست! موجودی فعلی انبار: {mat.current_stock}'})
                mat.current_stock -= diff
            
            mat.save()
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            mat = MaterialItem.objects.select_for_update().get(pk=self.material_id)
            if self.transaction_type == 'IN':
                mat.current_stock -= self.quantity
            elif self.transaction_type == 'OUT':
                mat.current_stock += self.quantity
            mat.save()
            super().delete(*args, **kwargs)


class TechnicalOfficeApproval(models.Model):
    contractor = models.ForeignKey('Contractor', on_delete=models.PROTECT, related_name='approvals', verbose_name="پیمانکار")
    material = models.ForeignKey(MaterialItem, on_delete=models.PROTECT, related_name='approvals', verbose_name="نوع متریال")
    approved_quantity = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="مقدار کار تایید شده")
    contract_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="شماره قرارداد")
    contract_subject = models.CharField(max_length=255, blank=True, null=True, verbose_name="موضوع قرارداد")
    approval_date = jmodels.jDateField(verbose_name="تاریخ تایید", db_index=True)
    created_at = jmodels.jDateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت در سیستم")

    objects = jmodels.jManager()

    class Meta:
        verbose_name = "تاییدیه عملکرد دفتر فنی"
        verbose_name_plural = "تاییدیه‌های عملکرد دفتر فنی"
        indexes = [
            models.Index(fields=['contractor', 'material']),
        ]

    def __str__(self):
        return f"تایید {self.approved_quantity} {self.material.get_unit_display()} از {self.material.name} برای {self.contractor}"


class AuditLog(models.Model):
    """
    جدول لاگ تغییرات سیستم (Audit Trail)
    ثبت تمام عملیات‌های ایجاد، ویرایش و حذف روی مدل‌های اصلی سیستم.
    """
    ACTION_CHOICES = (
        ('CREATE', 'ایجاد'),
        ('UPDATE', 'ویرایش'),
        ('DELETE', 'حذف'),
    )
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs', verbose_name="کاربر"
    )
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, verbose_name="نوع عملیات", db_index=True)
    model_name = models.CharField(max_length=100, verbose_name="نام مدل", db_index=True)
    object_id = models.PositiveIntegerField(verbose_name="شناسه رکورد", null=True, blank=True)
    object_repr = models.CharField(max_length=300, verbose_name="شرح رکورد", blank=True)
    changes = models.JSONField(default=dict, blank=True, verbose_name="جزئیات تغییرات")
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="آدرس IP")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="زمان", db_index=True)

    class Meta:
        verbose_name = "لاگ تغییرات"
        verbose_name_plural = "لاگ‌های تغییرات"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp', 'model_name']),
            models.Index(fields=['user', '-timestamp']),
        ]

    def __str__(self):
        user_str = self.user.username if self.user else "سیستم"
        return f"{user_str} → {self.get_action_display()} {self.model_name} ({self.object_repr})"


class GlobalMaterialBalance(models.Model):
    """
    جدول پیش‌محاسبه شده موازنه متریال کل کارگاه برای افزایش سرعت تا سطح میلی‌ثانیه.
    داده‌های این جدول توسط سیگنال‌های جنگو در هنگام ذخیره یا حذف تراکنش‌ها/تاییدیه عملکرد به‌روز می‌شود.
    """
    contractor = models.ForeignKey(Contractor, on_delete=models.CASCADE, related_name='global_balances', verbose_name="پیمانکار")
    material = models.ForeignKey(MaterialItem, on_delete=models.CASCADE, related_name='global_balances', verbose_name="نوع متریال")
    contract_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="شماره قرارداد")
    contract_subject = models.CharField(max_length=255, blank=True, null=True, verbose_name="موضوع قرارداد")

    total_issued = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="کل صادر شده")
    approved_work = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="کار تایید شده")
    allowed_waste = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name="پرت مجاز")
    balance = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="موازنه انحراف")
    balance_label = models.CharField(max_length=100, db_index=True, verbose_name="وضعیت موازنه")

    class Meta:
        verbose_name = "موازنه متریال کل کارگاه"
        verbose_name_plural = "موازنه متریال کل کارگاه"
        unique_together = ('contractor', 'material', 'contract_number', 'contract_subject')
        indexes = [
            models.Index(fields=['contractor', 'material']),
            models.Index(fields=['contract_number']),
            models.Index(fields=['balance_label']),
        ]

    def __str__(self):
        return f"{self.contractor} - {self.material} - {self.balance_label}"


import uuid

class ExportTask(models.Model):
    """
    جدول رهگیری وضعیت تولید فایل‌های اکسل در پس‌زمینه.
    """
    STATUS_CHOICES = (
        ('PENDING', 'در انتظار'),
        ('PROCESSING', 'در حال پردازش'),
        ('SUCCESS', 'موفق'),
        ('FAILURE', 'خطا'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', verbose_name="وضعیت")
    task_type = models.CharField(
        max_length=10, 
        choices=(('excel', 'Excel'), ('pdf', 'PDF')), 
        default='excel', 
        verbose_name="نوع فایل"
    )
    progress = models.IntegerField(default=0, verbose_name="درصد پیشرفت")
    eta = models.IntegerField(default=0, verbose_name="زمان باقی‌مانده (ثانیه)")
    file_url = models.CharField(max_length=255, blank=True, null=True, verbose_name="آدرس دانلود فایل")
    error_message = models.TextField(blank=True, null=True, verbose_name="پیام خطا")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")

    class Meta:
        verbose_name = "تسک خروجی فایل"
        verbose_name_plural = "تسک‌های خروجی فایل"
        ordering = ['-created_at']

    def __str__(self):
        return f"Task {self.id} - {self.status} ({self.progress}%)"


