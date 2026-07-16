"""
serializers.py - سریالایزرهای DRF برای سیستم بالانس متریال جهانپارس
======================================================================
"""

from rest_framework import serializers
from .models import (
    User,
    Contractor,
    WorkCategory,
    MaterialItem,
    WarehouseTransaction,
    TechnicalOfficeApproval,
    AuditLog,
)


# ─────────────────────────────────────────────────────────────────────────────
# ۱. سریالایزر کاربر و پیمانکار
# ─────────────────────────────────────────────────────────────────────────────
class UserReadSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'email', 'role', 'role_display']
        read_only_fields = fields

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.username


class ContractorSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    # annotate شده در ViewSet این فیلد را تعریف می‌کند. بدون N+1 Query.
    transaction_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Contractor
        fields = ['id', 'first_name', 'last_name', 'full_name', 'transaction_count']

    def get_full_name(self, obj) -> str:
        return obj.get_full_name()


# ─────────────────────────────────────────────────────────────────────────────
# ۲. سریالایزر رسته کاری (WorkCategory)
# ─────────────────────────────────────────────────────────────────────────────
class WorkCategorySerializer(serializers.ModelSerializer):
    materials_count = serializers.IntegerField(
        read_only=True,
        default=0
    )

    class Meta:
        model = WorkCategory
        fields = ['id', 'name', 'description', 'materials_count']

    def validate_name(self, value: str) -> str:
        qs = WorkCategory.objects.filter(name__iexact=value.strip())
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("این رسته کاری قبلاً ثبت شده است.")
        return value.strip()


# ─────────────────────────────────────────────────────────────────────────────
# ۳. سریالایزر کالا / متریال (MaterialItem)
# ─────────────────────────────────────────────────────────────────────────────
class MaterialItemSerializer(serializers.ModelSerializer):
    work_category_name = serializers.CharField(source='work_category.name', read_only=True)
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)

    class Meta:
        model = MaterialItem
        fields = [
            'id', 'name', 'work_category', 'work_category_name',
            'size', 'material_type', 'thickness',
            'unit', 'unit_display', 'waste_percentage',
            'low_stock_threshold',
        ]

    def validate_waste_percentage(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("درصد پرتی باید عددی بین ۰ تا ۱۰۰ باشد.")
        return value

    def validate(self, data):
        # Only validate duplicate constraints if we are updating (self.instance is not None).
        # For creation, the ViewSet handles the "get or create" flow.
        if self.instance:
            name = data.get('name', self.instance.name).strip()
            work_category = data.get('work_category', self.instance.work_category)
            material_type = data.get('material_type', self.instance.material_type or '').strip()
            size = data.get('size', self.instance.size or '').strip()
            thickness = data.get('thickness', self.instance.thickness or '').strip()
            unit = data.get('unit', self.instance.unit).strip()

            qs = MaterialItem.objects.filter(
                name__iexact=name,
                work_category=work_category,
                material_type__iexact=material_type,
                size__iexact=size,
                thickness__iexact=thickness,
                unit=unit
            ).exclude(pk=self.instance.pk)

            if qs.exists():
                raise serializers.ValidationError(
                    "این متریال با مشخصات وارد شده (نام، رسته، جنس، سایز، ضخامت و واحد) قبلاً در سیستم ثبت شده است."
                )
        return data


class MaterialItemMinimalSerializer(serializers.ModelSerializer):
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)
    specs = serializers.SerializerMethodField()

    class Meta:
        model = MaterialItem
        fields = ['id', 'name', 'unit', 'unit_display', 'specs', 'waste_percentage']

    def get_specs(self, obj) -> str:
        parts = filter(None, [obj.size, obj.material_type, obj.thickness])
        return " / ".join(parts) or "—"


# ─────────────────────────────────────────────────────────────────────────────
# ۴. سریالایزر تراکنش انبار (WarehouseTransaction)
# ─────────────────────────────────────────────────────────────────────────────
class WarehouseTransactionSerializer(serializers.ModelSerializer):
    material_detail = MaterialItemSerializer(source='material', read_only=True)
    contractor_detail = ContractorSerializer(source='contractor', read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)

    class Meta:
        model = WarehouseTransaction
        fields = [
            'id',
            'transaction_type', 'transaction_type_display',
            'material', 'material_detail',
            'quantity',
            'bill_of_lading', 'bill_of_lading_image',
            'contract_number', 'contract_subject', 'exit_document_image',
            'contractor', 'contractor_detail',
            'date', 'created_at',
        ]
        read_only_fields = ['created_at']

    def validate(self, data):
        txn_type = data.get('transaction_type', getattr(self.instance, 'transaction_type', None))

        if txn_type == 'IN':
            img = data.get('bill_of_lading_image', getattr(self.instance, 'bill_of_lading_image', None))
            if not img or not str(img).strip():
                raise serializers.ValidationError({'bill_of_lading_image': 'اسکن تصویر بارنامه برای تراکنش ورود الزامی است.'})
        elif txn_type == 'OUT':
            if not data.get('contractor') and getattr(self.instance, 'contractor_id', None) is None:
                raise serializers.ValidationError({'contractor': 'برای تراکنش خروج، پیمانکار الزامی است.'})
            img = data.get('exit_document_image', getattr(self.instance, 'exit_document_image', None))
            if not img or not str(img).strip():
                raise serializers.ValidationError({'exit_document_image': 'اسکن تصویر برگه خروج برای تراکنش خروج الزامی است.'})
        return data

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("مقدار باید عددی بزرگ‌تر از صفر باشد.")
        return value


class WarehouseTransactionListSerializer(WarehouseTransactionSerializer):
    class Meta(WarehouseTransactionSerializer.Meta):
        fields = [
            'id',
            'transaction_type', 'transaction_type_display',
            'material', 'material_detail',
            'quantity',
            'bill_of_lading',
            'contract_number', 'contract_subject',
            'contractor', 'contractor_detail',
            'date', 'created_at',
        ]


# ─────────────────────────────────────────────────────────────────────────────
# ۵. سریالایزر تاییدیه دفتر فنی (TechnicalOfficeApproval)
# ─────────────────────────────────────────────────────────────────────────────
class TechnicalOfficeApprovalSerializer(serializers.ModelSerializer):
    contractor_detail = ContractorSerializer(source='contractor', read_only=True)
    material_detail   = MaterialItemMinimalSerializer(source='material', read_only=True)
    allowed_waste = serializers.SerializerMethodField()
    balance_note  = serializers.SerializerMethodField()

    class Meta:
        model = TechnicalOfficeApproval
        fields = [
            'id',
            'contractor', 'contractor_detail',
            'material', 'material_detail',
            'approved_quantity',
            'contract_number', 'contract_subject',
            'allowed_waste', 'balance_note',
            'approval_date', 'created_at',
        ]
        read_only_fields = ['created_at', 'allowed_waste', 'balance_note']

    def get_allowed_waste(self, obj) -> str:
        try:
            waste = obj.approved_quantity * (obj.material.waste_percentage / 100)
            return f"{waste:.2f} {obj.material.get_unit_display()}"
        except Exception:
            return "—"

    def get_balance_note(self, obj) -> str:
        try:
            waste = obj.approved_quantity * (obj.material.waste_percentage / 100)
            max_allowed = obj.approved_quantity + waste
            return (
                f"پیمانکار مجاز است حداکثر {max_allowed:.2f} "
                f"{obj.material.get_unit_display()} از «{obj.material.name}» دریافت کند."
            )
        except Exception:
            return "—"

    def validate_approved_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("مقدار کار تاییدشده باید بزرگ‌تر از صفر باشد.")
        return value


# ─────────────────────────────────────────────────────────────────────────────
# ۶. سریالایزر لاگ تغییرات (AuditLog)
# ─────────────────────────────────────────────────────────────────────────────
class AuditLogSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_display', 'action', 'action_display',
            'model_name', 'object_id', 'object_repr',
            'changes', 'ip_address', 'timestamp',
        ]
        read_only_fields = fields

    def get_user_display(self, obj) -> str:
        if obj.user:
            return obj.user.username
        return "سیستم"
