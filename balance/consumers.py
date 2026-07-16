import json
from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async

User = get_user_model()

class TaskProgressConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        user = self.scope.get('user')
        if (not user or user.is_anonymous) and token:
            try:
                access_token = AccessToken(token)
                user_id = access_token['user_id']
                user = await database_sync_to_async(User.objects.get)(id=user_id)
            except Exception as e:
                user = None

        if not user or user.is_anonymous:
            await self.close()
            return

        self.task_id = self.scope['url_route']['kwargs']['task_id']
        self.room_group_name = f'task_{self.task_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    # Receive message from room group
    async def task_progress(self, event):
        progress = event['progress']
        status = event.get('status', 'PROCESSING')
        file_url = event.get('file_url')
        error_message = event.get('error_message')
        eta = event.get('eta')
        phase = event.get('phase')

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'progress': progress,
            'status': status,
            'file_url': file_url,
            'error_message': error_message,
            'eta': eta,
            'phase': phase
        }))
