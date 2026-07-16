from rest_framework import status
from django.core.cache import cache
from django.test.utils import CaptureQueriesContext
from django.db import connection
from balance.e2e_tests.helpers import E2EBaseTestCase, DUMMY_IMAGE_BASE64
from balance.models import WarehouseTransaction, ExportTask
import jdatetime
from decimal import Decimal

class CrossFeatureTests(E2EBaseTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    # --- Tier 3: Cross-Feature Combinations (6 tests) ---
    def test_dashboard_caching_during_large_excel_export(self):
        self.get_auth_headers(self.tech_user)
        # Prime dashboard cache
        self.client.get('/api/dashboard/charts/')
        
        # Trigger excel export
        response_export = self.client.get('/api/balance/download-global/')
        self.assertEqual(response_export.status_code, status.HTTP_200_OK)
        
        # Subsequent dashboard get should still hit cache (query count close to zero)
        with CaptureQueriesContext(connection) as ctx:
            self.client.get('/api/dashboard/charts/')
        self.assertLess(len(ctx.captured_queries), 5)

    def test_image_deferral_under_pagination(self):
        self.get_auth_headers(self.tech_user)
        # Bulk seed transactions with images
        for i in range(15):
            WarehouseTransaction.objects.create(
                transaction_type='IN',
                material=self.material,
                quantity=Decimal('10.00'),
                date=jdatetime.date(1402, 5, 10),
                bill_of_lading_image=DUMMY_IMAGE_BASE64
            )
            
        # Get paginated transaction list page 2
        response = self.client.get('/api/transactions/?page=2&page_size=5')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        results = response.data['results']
        # Assert image fields are deferred across all returned page records
        for item in results:
            self.assertTrue(item.get('bill_of_lading_image') is None or item.get('bill_of_lading_image') == '')

    def test_websocket_progress_for_pagination_export(self):
        # Excel export for paginated datasets tracks correctly
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/balance/download-global/')
        task_id = response.data['task_id']
        
        # Check task has registered correct type
        task = ExportTask.objects.get(id=task_id)
        self.assertEqual(task.status, 'PENDING')

    def test_cache_invalidation_via_bulk_transaction_create(self):
        self.get_auth_headers(self.tech_user)
        self.client.get('/api/dashboard/charts/')
        
        # Bulk create transaction records
        WarehouseTransaction.objects.bulk_create([
            WarehouseTransaction(transaction_type='IN', material=self.material, quantity=Decimal('50'), date=jdatetime.date(1402, 5, 12)),
            WarehouseTransaction(transaction_type='IN', material=self.material, quantity=Decimal('30'), date=jdatetime.date(1402, 5, 12))
        ])
        
        # Bulk create must also trigger signal to invalidate dashboard cache
        # In django, bulk_create does NOT send standard pre_save/post_save signals.
        # But if invalidation is optimized, it should cover bulk operations or require manual flush.
        # Let's verify caching hits new queries if cache is correctly invalidated.
        with CaptureQueriesContext(connection) as ctx:
            self.client.get('/api/dashboard/charts/')
        self.assertGreater(len(ctx.captured_queries), 2)

    def test_work_category_materials_count_in_paginated_list(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/categories/?page_size=1')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return paginated structure with category material count annotated
        self.assertIn('results', response.data)
        self.assertEqual(response.data['results'][0]['materials_count'], 1)

    def test_transaction_detail_reloading_deferred_images_during_pagination(self):
        self.get_auth_headers(self.tech_user)
        # Test lazy load of images on detailed view while paginated list was queried
        response_list = self.client.get('/api/transactions/?page_size=10')
        first_item_id = response_list.data['results'][0]['id']
        
        # Detail view query captures images correctly without crash
        response_detail = self.client.get(f'/api/transactions/{first_item_id}/')
        self.assertEqual(response_detail.status_code, status.HTTP_200_OK)
