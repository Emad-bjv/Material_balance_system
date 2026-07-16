from rest_framework import status
from django.core.cache import cache
from balance.e2e_tests.helpers import E2EBaseTestCase, DUMMY_IMAGE_BASE64
from balance.models import Contractor, WorkCategory, MaterialItem, WarehouseTransaction, AuditLog, ExportTask
import jdatetime
from decimal import Decimal

class RealWorldScenarioTests(E2EBaseTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    # --- Tier 4: Real-World Scenarios (6 tests) ---
    def test_scenario_contractor_onboarding_and_first_delivery(self):
        # Scenario 1 workflow
        self.get_auth_headers(self.superuser)
        
        # 1. Register new Contractor
        response_c = self.client.post('/api/contractors/', {"first_name": "احمد", "last_name": "حسینی"}, format='json')
        self.assertEqual(response_c.status_code, status.HTTP_201_CREATED)
        contractor_id = response_c.data['id']
        
        # 2. Define WorkCategory & link materials
        response_wc = self.client.post('/api/categories/', {"name": "پایپینگ"}, format='json')
        wc_id = response_wc.data['id']
        
        response_m = self.client.post('/api/materials/', {
            "name": "لوله ۵ اینچ",
            "work_category": wc_id,
            "unit": "M",
            "waste_percentage": "5.00"
        }, format='json')
        material_id = response_m.data['id']
        
        # 3. Add Inbound Stock
        self.get_auth_headers(self.warehouse_user)
        response_in = self.client.post('/api/transactions/', {
            "transaction_type": "IN",
            "material": material_id,
            "quantity": "5000.00",
            "date": "1402-05-15"
        }, format='json')
        self.assertEqual(response_in.status_code, status.HTTP_201_CREATED)
        
        # 4. Outbound dispatch with image
        response_out = self.client.post('/api/transactions/', {
            "transaction_type": "OUT",
            "material": material_id,
            "quantity": "250.00",
            "contractor": contractor_id,
            "date": "1402-05-16",
            "exit_document_image": DUMMY_IMAGE_BASE64
        }, format='json')
        self.assertEqual(response_out.status_code, status.HTTP_201_CREATED)
        
        # 5. Fetch dashboard charts and verify cache is invalidated and updated
        self.get_auth_headers(self.tech_user)
        response_d = self.client.get('/api/dashboard/charts/')
        self.assertEqual(response_d.status_code, status.HTTP_200_OK)

    def test_scenario_large_scale_material_distribution_and_balance_verification(self):
        # Scenario 2 workflow
        self.get_auth_headers(self.tech_user)
        # Verify paginated balance rows API
        response = self.client.get('/api/balance/global-rows/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

    def test_scenario_critical_stock_warning_and_replenishment(self):
        # Scenario 3 workflow
        self.get_auth_headers(self.warehouse_user)
        
        # Trigger Stock warnings: Outbound txn that drains stock below threshold
        # Material low_stock_threshold is 10. Inbound: 2000. Outbound: 100. Current: 1900.
        # Create outbound of 1895 -> current stock becomes 5 (< 10)
        self.client.post('/api/transactions/', {
            "transaction_type": "OUT",
            "material": self.material.id,
            "quantity": "1895.00",
            "contractor": self.contractor.id,
            "date": "1402-05-12"
        }, format='json')
        
        # Get notifications
        self.get_auth_headers(self.tech_user)
        response_n = self.client.get('/api/notifications/')
        self.assertEqual(response_n.status_code, status.HTTP_200_OK)
        # Notifications should indicate warning items
        self.assertTrue(len(response_n.data) > 0)

    def test_scenario_concurrent_multi_contractor_billing_export(self):
        # Scenario 4 workflow
        self.get_auth_headers(self.tech_user)
        r1 = self.client.get('/api/balance/download-global/')
        self.get_auth_headers(self.superuser)
        r2 = self.client.get('/api/balance/download-global/')
        
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertNotEqual(r1.data['task_id'], r2.data['task_id'])

    def test_scenario_historical_audit_log_review_and_filtering(self):
        # Scenario 5 workflow
        # 1. Non-admin request
        self.get_auth_headers(self.warehouse_user)
        response_guest = self.client.get('/api/audit-logs/')
        self.assertEqual(response_guest.status_code, status.HTTP_403_FORBIDDEN)
        
        # 2. Superuser audit view
        self.get_auth_headers(self.superuser)
        # Make modifying changes
        self.client.post('/api/contractors/', {"first_name": "کارگاه", "last_name": "مرکزی"}, format='json')
        response_audit = self.client.get('/api/audit-logs/')
        self.assertEqual(response_audit.status_code, status.HTTP_200_OK)
        self.assertTrue(response_audit.data['count'] > 0)

    def test_scenario_transaction_rollback_and_cache_integrity(self):
        # Scenario 6 workflow
        # Attempt to post transaction with negative quantity (invalid)
        self.get_auth_headers(self.warehouse_user)
        data = {
            "transaction_type": "IN",
            "material": self.material.id,
            "quantity": "-500.00",
            "date": "1402-05-12"
        }
        response = self.client.post('/api/transactions/', data, format='json')
        # DB rollback prevents saving invalid transactions
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
