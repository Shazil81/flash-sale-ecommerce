from unittest.mock import patch
from django.test import override_settings
import razorpay
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from .models import Cart, CartItem, Order, Payment, Product, UserProfile

class ShoppingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('customer', password='SafePassword123!')
        UserProfile.objects.create(user=self.user)
        self.cart = Cart.objects.create(user=self.user)
        self.product = Product.objects.create(name='Test item', description='Example', price='100.00', stock=3)
        self.client.force_authenticate(self.user)

    def test_public_admin_registration_rejected(self):
        self.client.force_authenticate(None)
        r = self.client.post('/api/register/', {'username': 'attacker', 'password': 'SafePassword123!', 'role': 'ADMIN'})
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(username='attacker').exists())

    def test_customer_cannot_access_admin(self):
        self.assertEqual(self.client.get('/api/admin/orders/').status_code, 403)

    def test_cart_validates_quantities(self):
        for quantity in ['abc', 0, -1, 4, 1.5]:
            with self.subTest(quantity=quantity):
                self.assertEqual(self.client.post('/api/cart/add/', {'product_id': self.product.pk, 'quantity': quantity}).status_code, 400)
        self.assertEqual(self.cart.items.count(), 0)

    def test_cart_decrement_and_remove(self):
        self.assertEqual(self.client.post('/api/cart/add/', {'product_id': self.product.pk, 'quantity': 2}).status_code, 200)
        self.client.post('/api/cart/add/', {'product_id': self.product.pk, 'quantity': -1})
        self.assertEqual(self.cart.items.get().quantity, 1)
        self.client.post('/api/cart/remove/', {'product_id': self.product.pk})
        self.assertEqual(self.cart.items.count(), 0)

    def payment(self):
        return Payment.objects.create(user=self.user, provider_order_id='order_test', amount=10000, items=[{'product_id': self.product.pk, 'quantity': 1, 'unit_price': '100.00'}], address='123 Example Street')

    def verify(self):
        return self.client.post('/api/payment/verify/', {'razorpay_order_id': 'order_test', 'razorpay_payment_id': 'pay_test', 'razorpay_signature': 'signature'})

    @patch('store.views.razorpay_client')
    def test_payment_snapshot_and_replay(self, provider):
        payment = self.payment()
        CartItem.objects.create(cart=self.cart, product=self.product, quantity=2)
        provider.payment.fetch.return_value = {'order_id': 'order_test', 'amount': 10000, 'currency': 'INR', 'status': 'captured'}
        self.assertEqual(self.verify().status_code, 200)
        self.assertEqual(self.verify().status_code, 200)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Order.objects.get().unit_price, 100)
        self.assertEqual(self.cart.items.get().quantity, 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 2)
        payment.refresh_from_db()
        self.assertTrue(payment.fulfilled)

    @patch('store.views.razorpay_client')
    def test_wrong_amount_does_not_fulfill(self, provider):
        self.payment()
        provider.payment.fetch.return_value = {'order_id': 'order_test', 'amount': 1, 'currency': 'INR', 'status': 'captured'}
        self.assertEqual(self.verify().status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_other_customer_cannot_verify_payment(self):
        self.payment()
        self.client.force_authenticate(User.objects.create_user('other'))
        self.assertEqual(self.verify().status_code, 404)

    @patch('store.views.razorpay_client')
    def test_insufficient_stock_rolls_back(self, provider):
        self.payment()
        self.product.stock = 0
        self.product.save()
        provider.payment.fetch.return_value = {'order_id': 'order_test', 'amount': 10000, 'currency': 'INR', 'status': 'captured'}
        self.assertEqual(self.verify().status_code, 409)
        self.assertEqual(Order.objects.count(), 0)

    def test_unpaid_direct_purchase_disabled(self):
        self.assertEqual(self.client.post('/api/buy/', {'product_id': self.product.pk}).status_code, 410)

    @override_settings(RAZORPAY_KEY_ID='test-key', RAZORPAY_KEY_SECRET='test-secret')
    @patch('store.views.razorpay_client')
    def test_register_login_cart_checkout_history(self, provider):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post('/api/register/', {'username': 'newbuyer', 'password': 'SafePassword123!', 'role': 'USER'}).status_code, 201)
        login = self.client.post('/api/login/', {'username': 'newbuyer', 'password': 'SafePassword123!'})
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + login.data['access'])
        self.assertEqual(self.client.get('/api/products/').status_code, 200)
        self.assertEqual(self.client.post('/api/cart/add/', {'product_id': self.product.pk, 'quantity': 1}).status_code, 200)
        provider.order.create.return_value = {'id': 'order_test'}
        response = self.client.post('/api/payment/create-order/', {'address': '123 Example Street'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['amount'], 10000)
        # Changing the live price after checkout must not change the purchased price.
        self.product.price = '200.00'
        self.product.save()
        provider.payment.fetch.return_value = {'order_id': 'order_test', 'amount': 10000, 'currency': 'INR', 'status': 'captured'}
        self.assertEqual(self.verify().status_code, 200)
        history = self.client.get('/api/orders/')
        self.assertEqual(len(history.data), 1)
        self.assertEqual(history.data[0]['unit_price'], '100.00')
        self.assertEqual(self.client.get('/api/cart/').data['items'], [])

    @patch('store.views.razorpay_client')
    def test_invalid_signature_rejected(self, provider):
        self.payment()
        provider.utility.verify_payment_signature.side_effect = razorpay.errors.SignatureVerificationError('Invalid')
        self.assertEqual(self.verify().status_code, 400)
        self.assertEqual(Order.objects.count(), 0)
