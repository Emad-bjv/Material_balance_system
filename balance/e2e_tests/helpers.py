import base64
from decimal import Decimal
import jdatetime
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from balance.models import WorkCategory, MaterialItem, Contractor, WarehouseTransaction, TechnicalOfficeApproval

User = get_user_model()

try:
    import channels
    from channels.testing import WebsocketCommunicator
    CHANNELS_INSTALLED = True
except ImportError:
    CHANNELS_INSTALLED = False
    WebsocketCommunicator = None

DUMMY_IMAGE_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

class E2EBaseTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.setup_users()
        self.setup_base_data()

    def setup_users(self):
        self.tech_user = User.objects.create_user(
            username="tech_admin",
            password="adminpassword123",
            email="tech@jahanpars.com"
        )
        self.tech_user.role = "TECHNICAL"
        self.tech_user.save()

        self.warehouse_user = User.objects.create_user(
            username="warehouse_keeper",
            password="keeperpassword123",
            email="warehouse@jahanpars.com"
        )
        self.warehouse_user.role = "WAREHOUSE"
        self.warehouse_user.save()

        self.superuser = User.objects.create_superuser(
            username="system_admin",
            password="superpassword123",
            email="admin@jahanpars.com"
        )
        self.superuser.role = "TECHNICAL"
        self.superuser.save()

    def setup_base_data(self):
        self.category = WorkCategory.objects.create(name="ابزاردقیق")
        self.material = MaterialItem.objects.create(
            name="کابل",
            work_category=self.category,
            unit="M",
            waste_percentage=Decimal("2.00"),
            low_stock_threshold=Decimal("10.00"),
            current_stock=Decimal("1000.00")
        )
        self.contractor = Contractor.objects.create(first_name="علی", last_name="رضایی")
        
        # Inbound Stock
        WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('2000.00'),
            date=jdatetime.date(1402, 5, 10)
        )
        # Outbound Stock
        self.outbound_txn = WarehouseTransaction.objects.create(
            transaction_type='OUT',
            material=self.material,
            quantity=Decimal('100.00'),
            contractor=self.contractor,
            date=jdatetime.date(1402, 5, 11)
        )
        
        # Approval
        self.approval = TechnicalOfficeApproval.objects.create(
            contractor=self.contractor,
            material=self.material,
            approved_quantity=Decimal('80.00'),
            approval_date=jdatetime.date(1402, 5, 12)
        )

    def get_auth_headers(self, user):
        self.client.force_authenticate(user=user)
        return {}
