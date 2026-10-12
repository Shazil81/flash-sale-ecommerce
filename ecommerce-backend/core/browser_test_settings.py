"""Isolated local browser verification; test Razorpay keys only."""
from .settings import *

if not DEBUG or not RAZORPAY_KEY_ID.startswith('rzp_test_'):
    raise ImproperlyConfigured('Browser verification requires DEBUG and Razorpay test keys.')
DATABASES['default'].update(NAME='ecommerce_browser_test', USER='integration_test', PASSWORD='', HOST='127.0.0.1', PORT='55432')
CACHES['default']['KEY_PREFIX'] = 'ecommerce-browser-verification'
