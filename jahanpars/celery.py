import os
from celery import Celery

# Set default Django settings module for 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jahanpars.settings')

app = Celery('jahanpars')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# ─── Export task isolation ──────────────────────────────────────────────────
app.conf.task_routes = {'balance.tasks.*': {'queue': 'exports'}}
app.conf.task_acks_late = True
app.conf.worker_prefetch_multiplier = 1
