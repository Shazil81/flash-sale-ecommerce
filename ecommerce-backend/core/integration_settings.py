"""Disposable PostgreSQL/Redis integration tests; never use for deployment."""
import os
from uuid import uuid4
from .test_settings import *

DATABASES = {'default': {
    'ENGINE': 'django.db.backends.postgresql',
    'NAME': 'postgres',
    'USER': os.environ.get('INTEGRATION_DB_USER', 'integration_test'),
    'PASSWORD': os.environ.get('INTEGRATION_DB_PASSWORD', ''),
    'HOST': os.environ.get('INTEGRATION_DB_HOST', '127.0.0.1'),
    'PORT': os.environ.get('INTEGRATION_DB_PORT', '55432'),
    'TEST': {'NAME': 'test_ecommerce_integration_' + uuid4().hex[:12]},
    'OPTIONS': {'options': '-c lock_timeout=10000 -c statement_timeout=20000'},
}}
if os.environ.get('INTEGRATION_REDIS_URL'):
    CACHES = {'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ['INTEGRATION_REDIS_URL'],
        'KEY_PREFIX': 'ecommerce-integration-' + uuid4().hex,
        'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
    }}
