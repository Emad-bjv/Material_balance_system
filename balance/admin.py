"""
admin.py - پنل مدیریت سیستم موازنه متریال جهانپارس
====================================================
ویژگی‌ها:
  - فرم پویای تراکنش انبار (نمایش/مخفی‌شدن فیلدها بر اساس نوع ورود/خروج)
  - ایجاد خودکار پیمانکار در پس‌زمینه
  - پنل پیمانکاران فقط‌خواندنی (ساخته‌شده توسط سیستم)
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group
from django import forms
from django_jalali.admin.filters import JDateFieldListFilter
import django_jalali.admin as jadmin
from .models import User, Contractor, WorkCategory, MaterialItem, WarehouseTransaction, TechnicalOfficeApproval


# ─────────────────────────────────────────────────────────────────────────────
# تنظیمات کلی پنل مدیریت
# ─────────────────────────────────────────────────────────────────────────────
admin.site.site_header = "سیستم موازنه متریال"
admin.site.site_title  = "پنل مدیریت"
admin.site.index_title = "خوش آمدید! از منوی زیر بخش مورد نظر را انتخاب کنید."
# Template سفارشی صفحه اصلی ادمین (تریک پیشرفت recursion: نام فایل متفاوت است از index.html)
admin.site.index_template = 'admin/custom_index.html'

admin.site.unregister(Group)


# ─────────────────────────────────────────────────────────────────────────────
# فرم ساخت کاربر جدید
# ─────────────────────────────────────────────────────────────────────────────
class UserCreationForm(forms.ModelForm):
    password1 = forms.CharField(
        label="رمز عبور",
        widget=forms.PasswordInput,
        help_text="حداقل ۸ کاراکتر. از حروف و اعداد ترکیبی استفاده کنید.",
    )
    password2 = forms.CharField(
        label="تکرار رمز عبور",
        widget=forms.PasswordInput,
        help_text="رمز عبور بالا را دقیقاً دوباره وارد کنید.",
    )

    class Meta:
        model = User
        fields = ('username', 'first_name', 'last_name', 'role')

    def clean_password2(self):
        p1 = self.cleaned_data.get('password1')
        p2 = self.cleaned_data.get('password2')
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError("رمزهای عبور یکسان نیستند!")
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user


# ─────────────────────────────────────────────────────────────────────────────
# مدیریت کاربران (User)
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'get_full_display_name', 'role_display', 'is_active', 'date_joined')
    list_display_links = ('username',)
    list_filter = ('role', 'is_active')
    search_fields = ('username', 'first_name', 'last_name')
    ordering = ('username',)

    fieldsets = (
        ('اطلاعات ورود', {
            'fields': ('username', 'password'),
            'description': 'نام کاربری و رمز عبور برای ورود به سیستم.',
        }),
        ('مشخصات فردی', {
            'fields': ('first_name', 'last_name', 'email'),
        }),
        ('نقش و دسترسی', {
            'fields': ('role', 'is_active', 'is_staff'),
            'description': (
                '• دفتر فنی: تعریف رسته، متریال، تایید عملکرد و دانلود گزارش\n'
                '• انباردار: ثبت ورود و خروج متریال'
            ),
        }),
        ('تاریخچه فعالیت', {
            'fields': ('last_login', 'date_joined'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ('last_login', 'date_joined')

    add_form = UserCreationForm
    add_fieldsets = (
        ('اطلاعات ورود', {
            'fields': ('username', 'password1', 'password2'),
        }),
        ('مشخصات فردی', {
            'fields': ('first_name', 'last_name'),
        }),
        ('نقش کاربر', {
            'fields': ('role',),
            'description': '• دفتر فنی: مهندسین و کارشناسان فنی\n• انباردار: مسئول انبار کارگاه',
        }),
    )

    @admin.display(description="نام کامل")
    def get_full_display_name(self, obj):
        full = obj.get_full_name()
        return full if full else "—"

    @admin.display(description="نقش")
    def role_display(self, obj):
        return obj.get_role_display() if obj.role else "تعیین نشده"


# ─────────────────────────────────────────────────────────────────────────────
# Inline: نمایش تراکنش‌های خروجی هر پیمانکار داخل صفحه جزئیات
# ─────────────────────────────────────────────────────────────────────────────
class ContractorTransactionInline(admin.TabularInline):
    """
    جدول درخواست‌های هر پیمانکار از انبار، به‌صورت inline در صفحه جزئیات پیمانکار.
    فقط تراکنش‌های خروجی (OUT) نمایش داده می‌شوند.
    """
    model = WarehouseTransaction
    extra = 0         # هیچ ردیف خالی اضافه‌ای نشان داده نشود
    can_delete = False
    show_change_link = True  # لینک به صفحه ویرایش تراکنش

    # فقط تراکنش‌های خروج (دریافت متریال) برای این پیمانکار
    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .filter(transaction_type='OUT')
            .select_related('material', 'material__work_category')
            .order_by('-date')
        )

    # ستون‌های قابل نمایش
    readonly_fields = (
        'date',
        'material_name',
        'material_specs',
        'quantity_with_unit',
        'contract_number',
        'contract_subject',
    )
    fields = readonly_fields

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description="کالا / متریال")
    def material_name(self, obj):
        return obj.material.name if obj.material else "—"

    @admin.display(description="مشخصات فنی")
    def material_specs(self, obj):
        if not obj.material:
            return "—"
        parts = filter(None, [obj.material.size, obj.material.material_type, obj.material.thickness])
        return " | ".join(parts) or "—"

    @admin.display(description="مقدار")
    def quantity_with_unit(self, obj):
        unit = obj.material.get_unit_display() if obj.material else ""
        return f"{obj.quantity:,.2f} {unit}"

    verbose_name = "درخواست از انبار"
    verbose_name_plural = "لیست درخواست‌های از انبار"


# ─────────────────────────────────────────────────────────────────────────────
# مدیریت پیمانکاران (Contractor) - قابل ویرایش + نمایش درخواست‌ها
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(Contractor)
class ContractorAdmin(admin.ModelAdmin):
    list_display = ('get_full_name', 'transaction_count', 'unique_contracts')
    search_fields = ('first_name', 'last_name')
    inlines = [ContractorTransactionInline]

    fieldsets = (
        ('مشخصات پیمانکار', {
            'fields': ('first_name', 'last_name'),
            'description': (
                'نام و نام خانوادگی پیمانکار را می‌توانید در صورت اشتباه اینجا ویرایش کنید.'
            ),
        }),
    )

    def has_add_permission(self, request):
        """پیمانکاران به‌صورت خودکار هنگام ثبت تراکنش خروج ساخته می‌شوند."""
        return False

    def has_delete_permission(self, request, obj=None):
        """حذف پیمانکار مجاز نیست (به تراکنش‌ها متصل است)."""
        return False

    @admin.display(description="نام پیمانکار")
    def get_full_name(self, obj):
        return obj.get_full_name()

    @admin.display(description="تعداد درخواست‌ها")
    def transaction_count(self, obj):
        count = obj.warehousetransaction_set.filter(transaction_type='OUT').count()
        return f"{count} درخواست"

    @admin.display(description="قراردادها")
    def unique_contracts(self, obj):
        contracts = (
            obj.warehousetransaction_set
            .filter(transaction_type='OUT')
            .exclude(contract_number__isnull=True)
            .exclude(contract_number='')
            .values_list('contract_number', flat=True)
            .distinct()
        )
        return " | ".join(contracts) if contracts else "—"


# ─────────────────────────────────────────────────────────────────────────────
# مدیریت رسته‌های کاری (WorkCategory)
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(WorkCategory)
class WorkCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)


# ─────────────────────────────────────────────────────────────────────────────
# مدیریت کالاها و متریال (MaterialItem)
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(MaterialItem)
class MaterialItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'work_category', 'size', 'material_type', 'thickness', 'unit', 'waste_percentage_display')
    list_filter = ('work_category', 'unit')
    search_fields = ('name', 'size', 'material_type')
    fieldsets = (
        ('مشخصات اصلی کالا', {
            'fields': ('name', 'work_category', 'unit'),
        }),
        ('مشخصات فنی', {
            'fields': ('size', 'material_type', 'thickness'),
        }),
        ('تنظیمات موازنه', {
            'fields': ('waste_percentage',),
            'description': 'درصد پرتی مجاز: مقدار هدررفت قابل‌قبول حین کار. مثال: ۵ یعنی ۵٪',
        }),
    )

    @admin.display(description="پرتی مجاز")
    def waste_percentage_display(self, obj):
        return f"{obj.waste_percentage}%"


# ─────────────────────────────────────────────────────────────────────────────
# مدیریت تراکنش‌های انبار (WarehouseTransaction) - فرم پویا
# ─────────────────────────────────────────────────────────────────────────────
class WarehouseTransactionForm(forms.ModelForm):
    """فرم سفارشی با اعتبارسنجی شرطی."""
    class Meta:
        model = WarehouseTransaction
        fields = (
            'transaction_type', 'material', 'quantity',
            'bill_of_lading',
            'contractor',
            'contract_number', 'contract_subject',
            'date',
        )

    def clean(self):
        cleaned_data = super().clean()
        txn_type = cleaned_data.get('transaction_type')

        if txn_type == 'OUT':
            if not cleaned_data.get('contractor'):
                self.add_error('contractor', 'برای خروج متریال، انتخاب پیمانکار الزامی است.')
            if not cleaned_data.get('contract_number'):
                self.add_error('contract_number', 'برای خروج متریال، شماره قرارداد الزامی است.')
            if not cleaned_data.get('contract_subject'):
                self.add_error('contract_subject', 'برای خروج متریال، موضوع قرارداد الزامی است.')
            # بارنامه برای خروج لازم نیست
            cleaned_data['bill_of_lading'] = None

        elif txn_type == 'IN':
            # برای ورود، فیلدهای پیمانکار خالی می‌شوند
            cleaned_data['contractor'] = None
            cleaned_data['contract_number'] = None
            cleaned_data['contract_subject'] = None

        return cleaned_data


@admin.register(WarehouseTransaction)
class WarehouseTransactionAdmin(admin.ModelAdmin):
    form = WarehouseTransactionForm
    list_display = ('transaction_type_display', 'material', 'quantity', 'contractor_info', 'bill_of_lading', 'date')
    list_filter = ('transaction_type', ('date', JDateFieldListFilter))
    search_fields = ('material__name', 'contractor__first_name', 'contractor__last_name', 'bill_of_lading', 'contract_number')

    fieldsets = (
        ('نوع عملیات', {
            'fields': ('transaction_type',),
            'description': 'ابتدا نوع تراکنش را انتخاب کنید. فیلدهای مربوطه به‌صورت خودکار نمایش داده می‌شوند.',
        }),
        ('جزئیات کالا', {
            'fields': ('material', 'quantity'),
        }),
        ('اطلاعات ورود (بارنامه)', {
            'fields': ('bill_of_lading',),
            'description': 'شماره بارنامه حمل متریال.',
        }),
        ('مشخصات پیمانکار و قرارداد', {
            'fields': ('contractor', 'contract_number', 'contract_subject'),
            'description': 'هنگام خروج متریال، پیمانکار را انتخاب کرده و مشخصات قرارداد را وارد کنید.',
        }),
        ('تاریخ', {
            'fields': ('date',),
        }),
    )

    @admin.display(description="نوع تراکنش")
    def transaction_type_display(self, obj):
        return obj.get_transaction_type_display()

    @admin.display(description="پیمانکار / بارنامه")
    def contractor_info(self, obj):
        if obj.transaction_type == 'OUT' and obj.contractor:
            return obj.contractor.get_full_name()
        elif obj.transaction_type == 'IN' and obj.bill_of_lading:
            return f"بارنامه: {obj.bill_of_lading}"
        return "—"


# ─────────────────────────────────────────────────────────────────────────────
# مدیریت تاییدیه‌های دفتر فنی (TechnicalOfficeApproval)
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(TechnicalOfficeApproval)
class TechnicalOfficeApprovalAdmin(admin.ModelAdmin):
    list_display = ('contractor', 'material', 'approved_quantity', 'contract_number', 'approval_date')
    list_filter = (( 'approval_date', JDateFieldListFilter), 'contractor')
    search_fields = ('contractor__first_name', 'contractor__last_name', 'material__name', 'contract_number')
    # Template سفارشی برای افزودن دکمه دانلود در بالای لیست
    change_list_template = 'admin/balance/approval_change_list.html'
    fieldsets = (
        ('مشخصات تاییدیه', {
            'fields': ('contractor', 'material', 'approved_quantity'),
            'description': 'پیمانکار، نوع متریال و مقدار تایید‌شده.',
        }),
        ('اطلاعات قرارداد', {
            'fields': ('contract_number', 'contract_subject'),
            'description': 'شماره و موضوع قراردادی که این تاییدیه مربوط به آن است.',
        }),
        ('تاریخ', {
            'fields': ('approval_date',),
        }),
    )
