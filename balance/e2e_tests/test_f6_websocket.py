import unittest
from django.test import TransactionTestCase
from balance.e2e_tests.helpers import CHANNELS_INSTALLED, WebsocketCommunicator
from balance.models import ExportTask

if CHANNELS_INSTALLED:
    from jahanpars.asgi import application
else:
    application = None

@unittest.skipUnless(CHANNELS_INSTALLED, "Django Channels is not installed")
class WebSocketE2ETests(TransactionTestCase):
    # --- Tier 1: Feature Coverage (5 tests) ---
    async def test_websocket_connection_success(self):
        task = ExportTask.objects.create(status='PENDING', progress=0)
        communicator = WebsocketCommunicator(application, f"ws/export-progress/{task.id}/")
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_websocket_invalid_task_id(self):
        communicator = WebsocketCommunicator(application, "ws/export-progress/00000000-0000-0000-0000-000000000000/")
        connected, subprotocol = await communicator.connect()
        # Non-existent task connection should be closed/rejected immediately
        self.assertFalse(connected)

    async def test_websocket_sends_progress_json(self):
        task = ExportTask.objects.create(status='PROCESSING', progress=25)
        communicator = WebsocketCommunicator(application, f"ws/export-progress/{task.id}/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        
        # Trigger progression broadcast in Channels group
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            f"task_{task.id}",
            {
                "type": "task.update",
                "status": "PROCESSING",
                "progress": 50
            }
        )
        
        response = await communicator.receive_json_from()
        self.assertEqual(response['status'], 'PROCESSING')
        self.assertEqual(response['progress'], 50)
        await communicator.disconnect()

    async def test_websocket_sends_success_status(self):
        task = ExportTask.objects.create(status='PROCESSING', progress=90)
        communicator = WebsocketCommunicator(application, f"ws/export-progress/{task.id}/")
        connected, _ = await communicator.connect()
        
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            f"task_{task.id}",
            {
                "type": "task.update",
                "status": "SUCCESS",
                "progress": 100,
                "file_url": "/media/exports/report.xlsx"
            }
        )
        
        response = await communicator.receive_json_from()
        self.assertEqual(response['status'], 'SUCCESS')
        self.assertEqual(response['result_url'], "/media/exports/report.xlsx")
        await communicator.disconnect()

    async def test_websocket_closes_on_completion(self):
        task = ExportTask.objects.create(status='PROCESSING', progress=90)
        communicator = WebsocketCommunicator(application, f"ws/export-progress/{task.id}/")
        connected, _ = await communicator.connect()
        
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        # Update to SUCCESS terminal status
        await channel_layer.group_send(
            f"task_{task.id}",
            {
                "type": "task.update",
                "status": "SUCCESS",
                "progress": 100,
                "file_url": "/media/exports/report.xlsx"
            }
        )
        
        _ = await communicator.receive_json_from()
        # Connection should close upon terminal state
        closed = await communicator.wait_for_connection_close()
        self.assertTrue(closed)

    # --- Tier 2: Boundary & Corner Cases (5 tests) ---
    async def test_websocket_unauthenticated_connection(self):
        # Access with invalid credentials
        communicator = WebsocketCommunicator(application, "ws/export-progress/11111111-2222-3333-4444-555555555555/?token=invalid")
        connected, _ = await communicator.connect()
        self.assertFalse(connected)

    async def test_websocket_task_failure_broadcast(self):
        task = ExportTask.objects.create(status='PROCESSING', progress=10)
        communicator = WebsocketCommunicator(application, f"ws/export-progress/{task.id}/")
        connected, _ = await communicator.connect()
        
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            f"task_{task.id}",
            {
                "type": "task.update",
                "status": "FAILURE",
                "progress": 0,
                "error_message": "Disk Full"
            }
        )
        response = await communicator.receive_json_from()
        self.assertEqual(response['status'], 'FAILURE')
        self.assertEqual(response['error'], 'Disk Full')
        await communicator.disconnect()

    async def test_websocket_multiple_listeners(self):
        task = ExportTask.objects.create(status='PROCESSING', progress=10)
        c1 = WebsocketCommunicator(application, f"ws/export-progress/{task.id}/")
        c2 = WebsocketCommunicator(application, f"ws/export-progress/{task.id}/")
        
        await c1.connect()
        await c2.connect()
        
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            f"task_{task.id}",
            {
                "type": "task.update",
                "status": "PROCESSING",
                "progress": 20
            }
        )
        
        r1 = await c1.receive_json_from()
        r2 = await c2.receive_json_from()
        self.assertEqual(r1['progress'], 20)
        self.assertEqual(r2['progress'], 20)
        
        await c1.disconnect()
        await c2.disconnect()

    async def test_websocket_connection_mid_task(self):
        task = ExportTask.objects.create(status='PROCESSING', progress=65)
        communicator = WebsocketCommunicator(application, f"ws/export-progress/{task.id}/")
        connected, _ = await communicator.connect()
        # Upon connection, should automatically push current status from DB
        response = await communicator.receive_json_from()
        self.assertEqual(response['progress'], 65)
        await communicator.disconnect()

    async def test_websocket_inactive_task_cleanup(self):
        task = ExportTask.objects.create(status='FAILURE', progress=0)
        communicator = WebsocketCommunicator(application, f"ws/export-progress/{task.id}/")
        connected, _ = await communicator.connect()
        # Since it is already in terminal failure state, connection must be closed immediately
        self.assertFalse(connected)
