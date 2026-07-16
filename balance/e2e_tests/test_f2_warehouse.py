from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework import status
from balance.e2e_tests.helpers import E2EBaseTestCase, DUMMY_IMAGE_BASE64
from balance.models import WarehouseTransaction
import jdatetime
from decimal import Decimal

class WarehouseImageDeferralTests(E2EBaseTestCase):
    # --- Tier 1: Feature Coverage (5 tests) ---
    def test_transaction_list_excludes_images(self):
        self.get_auth_headers(self.tech_user)
        # Create a transaction with base64 image
        txn = WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('20.00'),
            date=jdatetime.date(1402, 5, 12),
            bill_of_lading_image=DUMMY_IMAGE_BASE64
        )
        
        response = self.client.get('/api/transactions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # In a list response, image fields must be deferred (either not present or null)
        results = response.data.get('results', response.data)
        for item in results:
            if item.get('id') == txn.id:
                self.assertTrue(item.get('bill_of_lading_image') is None or item.get('bill_of_lading_image') == '')

    def test_transaction_detail_includes_images(self):
        self.get_auth_headers(self.tech_user)
        txn = WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('20.00'),
            date=jdatetime.date(1402, 5, 12),
            bill_of_lading_image=DUMMY_IMAGE_BASE64
        )
        response = self.client.get(f'/api/transactions/{txn.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('bill_of_lading_image'), DUMMY_IMAGE_BASE64)

    def test_transaction_list_sql_deferral(self):
        self.get_auth_headers(self.tech_user)
        with CaptureQueriesContext(connection) as ctx:
            self.client.get('/api/transactions/')
        
        # Inspect queries to ensure image fields are not listed in the select fields
        for q in ctx.captured_queries:
            sql = q['sql'].lower()
            if 'select' in sql and 'warehousetransaction' in sql:
                self.assertNotIn('bill_of_lading_image', sql)
                self.assertNotIn('exit_document_image', sql)

    def test_transaction_create_with_images(self):
        self.get_auth_headers(self.warehouse_user)
        data = {
            "transaction_type": "IN",
            "material": self.material.id,
            "quantity": "50.00",
            "date": "1402-05-12",
            "bill_of_lading_image": DUMMY_IMAGE_BASE64
        }
        response = self.client.post('/api/transactions/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WarehouseTransaction.objects.get(id=response.data['id']).bill_of_lading_image, DUMMY_IMAGE_BASE64)

    def test_transaction_update_images(self):
        self.get_auth_headers(self.warehouse_user)
        txn = WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('20.00'),
            date=jdatetime.date(1402, 5, 12)
        )
        new_image = DUMMY_IMAGE_BASE64.replace("A", "B")
        response = self.client.patch(f'/api/transactions/{txn.id}/', {"bill_of_lading_image": new_image}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(WarehouseTransaction.objects.get(id=txn.id).bill_of_lading_image, new_image)

    # --- Tier 2: Boundary & Corner Cases (5 tests) ---
    def test_transaction_detail_missing_images(self):
        self.get_auth_headers(self.tech_user)
        # Transaction detail when images are null
        response = self.client.get(f'/api/transactions/{self.outbound_txn.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(response.data.get('exit_document_image'), (None, ''))

    def test_transaction_large_base64_payload(self):
        self.get_auth_headers(self.warehouse_user)
        # A larger base64 string
        large_base64 = DUMMY_IMAGE_BASE64 * 10
        data = {
            "transaction_type": "IN",
            "material": self.material.id,
            "quantity": "10.00",
            "date": "1402-05-12",
            "bill_of_lading_image": large_base64
        }
        response = self.client.post('/api/transactions/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_transaction_invalid_base64_format(self):
        self.get_auth_headers(self.warehouse_user)
        data = {
            "transaction_type": "IN",
            "material": self.material.id,
            "quantity": "10.00",
            "date": "1402-05-12",
            # Base64 requires valid characters, try sending invalid special characters
            "bill_of_lading_image": "!!!invalid_chars!!!"
        }
        response = self.client.post('/api/transactions/', data, format='json')
        # Server should validation fail (400 Bad Request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_transaction_partial_update_only_images(self):
        self.get_auth_headers(self.tech_user)
        # Verify partial patching works without validation errors
        response = self.client.patch(
            f'/api/transactions/{self.outbound_txn.id}/',
            {"exit_document_image": DUMMY_IMAGE_BASE64},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_transaction_delete_removes_image_references(self):
        self.get_auth_headers(self.tech_user)
        txn = WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('20.00'),
            date=jdatetime.date(1402, 5, 12),
            bill_of_lading_image=DUMMY_IMAGE_BASE64
        )
        tid = txn.id
        response = self.client.delete(f'/api/transactions/{txn.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(WarehouseTransaction.objects.filter(id=tid).exists())
