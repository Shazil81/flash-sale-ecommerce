"""Real database/cache tests. Only the external payment provider is mocked."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4
import os
import time

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import connection, close_old_connections, connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient
from .models import Cart, CartItem, Order, Payment, Product, UserProfile


class ConcurrentPurchaseTests(TransactionTestCase):
    def setUp(self):
        if connection.vendor != 'postgresql':
            self.skipTest('Real PostgreSQL is required for locking tests')
        self.product = Product.objects.create(name='Last units', description='Concurrency fixture', price='100.00', stock=5)

    def buyer(self, label):
        user = User.objects.create_user('buyer_' + label)
        UserProfile.objects.create(user=user)
        cart = Cart.objects.create(user=user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=1)
        payment = Payment.objects.create(user=user, provider_order_id='order_' + label, amount=10000,
            items=[{'product_id': self.product.pk, 'quantity': 1, 'unit_price': '100.00'}], address='123 Test Street')
        return user.pk, payment.provider_order_id

    def race(self, buyers):
        gate = Barrier(len(buyers))

        def request(buyer):
            close_old_connections()
            try:
                user_id, order_id = buyer
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=user_id))
                gate.wait(timeout=15)
                response = client.post('/api/payment/verify/', {
                    'razorpay_order_id': order_id, 'razorpay_payment_id': 'pay_' + order_id,
                    'razorpay_signature': 'mocked-signature'})
                return response.status_code
            finally:
                connections.close_all()

        def captured(payment_id):
            return {'order_id': payment_id.removeprefix('pay_'), 'amount': 10000, 'currency': 'INR', 'status': 'captured'}

        with patch('store.views.razorpay_client') as provider:
            provider.payment.fetch.side_effect = captured
            with ThreadPoolExecutor(max_workers=len(buyers)) as workers:
                return list(workers.map(request, buyers))

    def test_twelve_buyers_compete_for_five_units(self):
        # Repeat to catch intermittent lock ordering and lost updates.
        for round_number in range(5):
            with self.subTest(round=round_number):
                self.product.stock = 5
                self.product.save()
                buyers = [self.buyer(f'{round_number}_{i}') for i in range(12)]
                statuses = self.race(buyers)
                self.assertEqual(statuses.count(200), 5, statuses)
                self.assertEqual(statuses.count(409), 7, statuses)
                self.product.refresh_from_db()
                self.assertEqual(self.product.stock, 0)
                self.assertEqual(Order.objects.count(), (round_number + 1) * 5)
                self.assertEqual(Payment.objects.filter(fulfilled=True).count(), (round_number + 1) * 5)
                self.assertEqual(CartItem.objects.count(), (round_number + 1) * 7)

    def test_eight_simultaneous_callbacks_fulfill_once(self):
        buyer = self.buyer('duplicate')
        statuses = self.race([buyer] * 8)
        self.assertEqual(statuses, [200] * 8)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 4)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(CartItem.objects.count(), 0)


class RedisCacheTests(TransactionTestCase):
    def setUp(self):
        if not os.environ.get('INTEGRATION_REDIS_URL'):
            self.skipTest('INTEGRATION_REDIS_URL is required for real Redis tests')
        self.product = Product.objects.create(name='Cached product', description='Cache fixture', price='100.00', stock=2)
        self.client = APIClient()

    def tearDown(self):
        # Never clear shared Redis databases; delete only this run's prefixed key.
        if os.environ.get('INTEGRATION_REDIS_URL'):
            cache.delete('all_products')

    def test_real_redis_roundtrip_expiry(self):
        key = 'probe-' + uuid4().hex
        cache.set(key, {'working': True}, timeout=1)
        self.assertEqual(cache.get(key), {'working': True})
        time.sleep(1.2)
        self.assertIsNone(cache.get(key))

    def test_catalog_cache_hit_and_checkout_invalidation(self):
        cache.delete('all_products')
        self.assertEqual(self.client.get('/api/products/').status_code, 200)
        self.assertIsNotNone(cache.get('all_products'))
        with self.assertNumQueries(0):
            response = self.client.get('/api/products/')
        self.assertEqual(response.data[0]['stock'], 2)
        user = User.objects.create_user('cache_buyer')
        UserProfile.objects.create(user=user)
        cart = Cart.objects.create(user=user)
        CartItem.objects.create(cart=cart, product=self.product)
        Payment.objects.create(user=user, provider_order_id='order_cache', amount=10000,
            items=[{'product_id': self.product.pk, 'quantity': 1, 'unit_price': '100.00'}], address='123 Test Street')
        self.client.force_authenticate(user)
        with patch('store.views.razorpay_client') as provider:
            provider.payment.fetch.return_value = {'order_id': 'order_cache', 'amount': 10000, 'currency': 'INR', 'status': 'captured'}
            self.assertEqual(self.client.post('/api/payment/verify/', {'razorpay_order_id': 'order_cache',
                'razorpay_payment_id': 'pay_cache', 'razorpay_signature': 'mocked-signature'}).status_code, 200)
        self.assertIsNone(cache.get('all_products'))
        self.client.force_authenticate(None)
        refreshed = self.client.get('/api/products/')
        self.assertEqual(refreshed.data[0]['stock'], 1)
        self.assertEqual(cache.get('all_products')[0]['stock'], 1)
