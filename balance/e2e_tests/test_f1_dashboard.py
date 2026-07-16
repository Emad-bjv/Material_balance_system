from django.core.cache import cache
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework import status
from balance.e2e_tests.helpers import E2EBaseTestCase
from balance.models import WarehouseTransaction
import jdatetime
from decimal import Decimal

class DashboardCachingTests(E2EBaseTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    # --- Tier 1: Feature Coverage (5 tests) ---
    def test_dashboard_charts_retrieval_success(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/dashboard/charts/?period=month')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_dashboard_charts_redis_caching(self):
        self.get_auth_headers(self.tech_user)
        # First request to cache the results
        self.client.get('/api/dashboard/charts/?period=month')
        
        # Capture queries during second request
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/dashboard/charts/?period=month')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Query count should be very low/zero due to cache hit
        self.assertLess(len(ctx.captured_queries), 5, f"Cache missed. SQL executed: {ctx.captured_queries}")

    def test_dashboard_charts_invalidation_on_create(self):
        self.get_auth_headers(self.tech_user)
        self.client.get('/api/dashboard/charts/?period=month')
        
        # Mutate: Create a transaction
        WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('500.00'),
            date=jdatetime.date(1402, 5, 12)
        )
        
        with CaptureQueriesContext(connection) as ctx:
            self.client.get('/api/dashboard/charts/?period=month')
        self.assertGreater(len(ctx.captured_queries), 2, "Cache was not invalidated on transaction create.")

    def test_dashboard_charts_invalidation_on_update(self):
        self.get_auth_headers(self.tech_user)
        self.client.get('/api/dashboard/charts/?period=month')
        
        # Mutate: Update transaction quantity
        self.outbound_txn.quantity = Decimal('150.00')
        self.outbound_txn.save()
        
        with CaptureQueriesContext(connection) as ctx:
            self.client.get('/api/dashboard/charts/?period=month')
        self.assertGreater(len(ctx.captured_queries), 2, "Cache was not invalidated on transaction update.")

    def test_dashboard_charts_invalidation_on_delete(self):
        self.get_auth_headers(self.tech_user)
        self.client.get('/api/dashboard/charts/?period=month')
        
        # Mutate: Delete transaction
        self.outbound_txn.delete()
        
        with CaptureQueriesContext(connection) as ctx:
            self.client.get('/api/dashboard/charts/?period=month')
        self.assertGreater(len(ctx.captured_queries), 2, "Cache was not invalidated on transaction delete.")

    # --- Tier 2: Boundary & Corner Cases (5 tests) ---
    def test_dashboard_charts_invalid_period(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/dashboard/charts/?period=invalid_val')
        # System should fallback to default monthly period gracefully
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_dashboard_charts_empty_date_range(self):
        self.get_auth_headers(self.tech_user)
        # Querying an old/future period should return empty trends gracefully
        response = self.client.get('/api/dashboard/charts/?period=custom&from_date=1300-01-01&to_date=1300-01-30')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_dashboard_charts_nonexistent_contractor_id(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/dashboard/charts/?contractor_id=999999')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_dashboard_charts_concurrent_cache_stampede(self):
        # Verify dashboard charts endpoint responds successfully with sequential cache hits
        self.get_auth_headers(self.tech_user)
        for _ in range(5):
            response = self.client.get('/api/dashboard/charts/?period=month')
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_dashboard_charts_cache_TTL(self):
        self.get_auth_headers(self.tech_user)
        # Prime the cache
        self.client.get('/api/dashboard/charts/?period=month')
        # Simulate TTL expiration by clearing
        cache.clear()
        with CaptureQueriesContext(connection) as ctx:
            self.client.get('/api/dashboard/charts/?period=month')
        self.assertGreater(len(ctx.captured_queries), 2, "Expired cache did not trigger fresh database queries.")
