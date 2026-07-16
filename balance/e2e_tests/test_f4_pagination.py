from rest_framework import status
from balance.e2e_tests.helpers import E2EBaseTestCase
from balance.models import Contractor, MaterialItem, WarehouseTransaction, AuditLog

class ServerSidePaginationTests(E2EBaseTestCase):
    # --- Tier 1: Feature Coverage (5 tests) ---
    def test_contractors_pagination_format(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/contractors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)

    def test_materials_pagination_format(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/materials/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

    def test_inventory_pagination_format(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/balance/inventory/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

    def test_audit_logs_pagination_format(self):
        self.get_auth_headers(self.superuser)
        # Trigger an audit action to log
        Contractor.objects.create(first_name="تست", last_name="جدید")
        response = self.client.get('/api/audit-logs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

    def test_pagination_page_size_parameter(self):
        self.get_auth_headers(self.tech_user)
        # Create additional contractors to test page size limiting
        for i in range(10):
            Contractor.objects.get_or_create(first_name=f"پیمانکار_{i}", last_name="پیمانکاران")
            
        response = self.client.get('/api/contractors/?page_size=3')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 3)

    # --- Tier 2: Boundary & Corner Cases (5 tests) ---
    def test_pagination_invalid_page_number(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/contractors/?page=99999')
        # DRF PageNumberPagination returns 404 for out of range pages
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_pagination_zero_page_size(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/contractors/?page_size=0')
        # Zero page size should fallback to standard page size or work gracefully
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_pagination_max_page_size_limit(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/contractors/?page_size=100000')
        # Page size must be capped at max_page_size (e.g. 1000)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(response.data['results']), 1000)

    def test_pagination_empty_results_page(self):
        self.get_auth_headers(self.tech_user)
        # Fetching a valid page layout on empty contractors table
        Contractor.objects.all().delete()
        response = self.client.get('/api/contractors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 0)

    def test_pagination_links_ssl_behind_proxy(self):
        self.get_auth_headers(self.tech_user)
        for i in range(10):
            Contractor.objects.get_or_create(first_name=f"پیمانکار_{i}", last_name="پیمانکاران")
        # Simulate SSL proxy headers
        response = self.client.get('/api/contractors/?page_size=1', HTTP_X_FORWARDED_PROTO='https')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        if response.data.get('next'):
            self.assertTrue(response.data['next'].startswith('https'))
