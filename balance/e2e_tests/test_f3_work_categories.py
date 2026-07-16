from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework import status
from balance.e2e_tests.helpers import E2EBaseTestCase
from balance.models import WorkCategory, MaterialItem
from decimal import Decimal

class WorkCategoryOptimizationTests(E2EBaseTestCase):
    # --- Tier 1: Feature Coverage (5 tests) ---
    def test_work_category_list_success(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_work_category_n_plus_one_prevention(self):
        self.get_auth_headers(self.tech_user)
        
        # Request with 1 category in db
        with CaptureQueriesContext(connection) as ctx1:
            self.client.get('/api/categories/')
        q1_count = len(ctx1.captured_queries)

        # Create 5 additional categories
        for i in range(5):
            WorkCategory.objects.create(name=f"رسته کمکی {i}")
            
        # Request with 6 categories in db
        with CaptureQueriesContext(connection) as ctx2:
            self.client.get('/api/categories/')
        q2_count = len(ctx2.captured_queries)

        # Query counts should remain constant (annotated in viewset)
        self.assertEqual(q1_count, q2_count, f"N+1 query detected! 1 Category: {q1_count} queries, 6 Categories: {q2_count} queries.")

    def test_work_category_materials_count_correctness(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/categories/')
        results = response.data.get('results', response.data)
        for item in results:
            if item.get('id') == self.category.id:
                # Should find 1 material assigned to it
                self.assertEqual(item.get('materials_count'), 1)

    def test_work_category_empty_category_count(self):
        self.get_auth_headers(self.tech_user)
        empty_cat = WorkCategory.objects.create(name="رسته خالی")
        response = self.client.get('/api/categories/')
        results = response.data.get('results', response.data)
        for item in results:
            if item.get('id') == empty_cat.id:
                self.assertEqual(item.get('materials_count'), 0)

    def test_work_category_add_material_updates_count(self):
        self.get_auth_headers(self.tech_user)
        MaterialItem.objects.create(
            name="کابل دوم",
            work_category=self.category,
            unit="M",
            waste_percentage=Decimal("2.00")
        )
        response = self.client.get('/api/categories/')
        results = response.data.get('results', response.data)
        for item in results:
            if item.get('id') == self.category.id:
                self.assertEqual(item.get('materials_count'), 2)

    # --- Tier 2: Boundary & Corner Cases (5 tests) ---
    def test_work_category_serializer_zero_categories(self):
        self.get_auth_headers(self.tech_user)
        # Delete all categories
        MaterialItem.objects.all().delete()
        WorkCategory.objects.all().delete()
        response = self.client.get('/api/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 0)

    def test_work_category_name_max_length(self):
        self.get_auth_headers(self.tech_user)
        long_name = "X" * 100
        response = self.client.post('/api/categories/', {"name": long_name}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_work_category_duplicate_name(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.post('/api/categories/', {"name": "ابزاردقیق"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_work_category_nested_materials_serialization(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Serializer should display nested material information
        results = response.data.get('results', response.data)
        for cat in results:
            if cat.get('id') == self.category.id:
                self.assertIn('materials', cat)

    def test_work_category_unicode_and_persian_normalization(self):
        self.get_auth_headers(self.tech_user)
        # Creating Category with non-standard Arabic/Persian letters
        # 'ي' should be normalized to 'ی'
        response = self.client.post('/api/categories/', {"name": "پيپينگ"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WorkCategory.objects.get(id=response.data['id']).name, "پیپینگ")
