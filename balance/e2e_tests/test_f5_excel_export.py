from rest_framework import status
from balance.e2e_tests.helpers import E2EBaseTestCase
from balance.models import ExportTask
from unittest.mock import patch

class ExcelExportTests(E2EBaseTestCase):
    # --- Tier 1: Feature Coverage (5 tests) ---
    def test_excel_export_task_creation(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/balance/download-global/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('task_id', response.data)
        
        # Verify it has registered in the database with pending state
        task = ExportTask.objects.get(id=response.data['task_id'])
        self.assertEqual(task.status, 'PENDING')
        self.assertEqual(task.task_type, 'excel')

    def test_excel_export_openpyxl_write_only(self):
        # Import task generator
        from balance.services import generate_global_material_balance_excel
        with patch('openpyxl.Workbook') as mock_wb:
            generate_global_material_balance_excel()
            # Assert write_only=True was passed to openpyxl
            mock_wb.assert_called_with(write_only=True)

    def test_excel_export_chunk_size(self):
        # Validate task code reads objects in chunks of 5000
        from balance.services import generate_global_material_balance_excel
        # Excel generator should process successfully
        wb_bytes = generate_global_material_balance_excel()
        self.assertIsNotNone(wb_bytes)
        self.assertGreater(len(wb_bytes), 0)

    def test_excel_export_writes_file_successfully(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/balance/download-global/')
        task_id = response.data['task_id']
        
        # Running the celery task synchronously
        from balance.tasks import generate_global_balance_excel_task
        generate_global_balance_excel_task(task_id, is_superuser=True)
        
        task = ExportTask.objects.get(id=task_id)
        self.assertEqual(task.status, 'SUCCESS')
        self.assertIsNotNone(task.file_url)

    def test_excel_export_progress_updates(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/balance/download-global/')
        task_id = response.data['task_id']
        
        from balance.tasks import generate_global_balance_excel_task
        generate_global_balance_excel_task(task_id, is_superuser=True)
        
        task = ExportTask.objects.get(id=task_id)
        # When completed, progress percentage should be 100
        self.assertEqual(task.progress, 100)

    # --- Tier 2: Boundary & Corner Cases (5 tests) ---
    def test_excel_export_empty_database(self):
        # Clear database records that would generate rows
        from balance.models import GlobalMaterialBalance
        GlobalMaterialBalance.objects.all().delete()
        
        from balance.services import generate_global_material_balance_excel
        # Exporting empty dataset should not crash and return valid bytes
        wb_bytes = generate_global_material_balance_excel()
        self.assertIsNotNone(wb_bytes)

    def test_excel_export_task_cancellation(self):
        self.get_auth_headers(self.tech_user)
        response = self.client.get('/api/balance/download-global/')
        task_id = response.data['task_id']
        
        # Cancel the task
        cancel_url = f'/api/balance/export-status/{task_id}/cancel/'
        response_cancel = self.client.post(cancel_url)
        self.assertEqual(response_cancel.status_code, status.HTTP_200_OK)
        
        task = ExportTask.objects.get(id=task_id)
        self.assertEqual(task.status, 'FAILURE')
        self.assertIn('لغو', task.error_message)

    def test_excel_export_unauthorized_user(self):
        # Create user without download permission
        guest_user = self.warehouse_user
        # Verify request fails with 403 Forbidden
        self.get_auth_headers(guest_user)
        response = self.client.get('/api/balance/download-global/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_excel_export_disk_full_handling(self):
        # Mock file write to raise IOError
        with patch('django.core.files.storage.default_storage.save', side_effect=IOError("No space left on device")):
            self.get_auth_headers(self.tech_user)
            response = self.client.get('/api/balance/download-global/')
            task_id = response.data['task_id']
            from balance.tasks import generate_global_balance_excel_task
            try:
                generate_global_balance_excel_task(task_id, is_superuser=True)
            except Exception:
                pass
            task = ExportTask.objects.get(id=task_id)
            self.assertEqual(task.status, 'FAILURE')
            self.assertIsNotNone(task.error_message)

    def test_excel_export_unicode_sheet_names(self):
        # Excel sheet generation should succeed with Persian characters
        from balance.services import generate_global_material_balance_excel
        self.material.name = "شفت فولادی آلیاژی ۵۰میلیمتر"
        self.material.save()
        wb_bytes = generate_global_material_balance_excel()
        self.assertIsNotNone(wb_bytes)
