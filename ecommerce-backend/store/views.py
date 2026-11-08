from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework import status
from django.core.cache import cache
from django.conf import settings
import razorpay
import logging
import hashlib
import hmac
import json
from decimal import Decimal
from uuid import uuid4
from django.db import transaction
from rest_framework import serializers
from .models import Product, Order, Cart, CartItem, Payment
from .serializers import ProductSerializer, OrderSerializer, RegisterSerializer, CartSerializer

from rest_framework.permissions import IsAuthenticated, AllowAny

logger = logging.getLogger(__name__)
razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

class CartChangeSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(default=1)

class CheckoutSerializer(serializers.Serializer):
    address = serializers.CharField(min_length=10, max_length=2000)


def invalidate_products():
    try:
        cache.delete('all_products')
    except Exception:
        logger.warning('Product cache invalidation failed', exc_info=True)

@api_view(['POST'])
def register_user(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"message": "User registered successfully!"}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def get_products(request):
    search_query = request.GET.get('search', '').strip()

    if search_query:
        products = Product.objects.filter(name__icontains=search_query)
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    cache_key = "all_products"
    try:
        cached_products = cache.get(cache_key)
        if cached_products:
            return Response(cached_products)
    except Exception:
        pass

    products = Product.objects.select_related('category').all()
    serializer = ProductSerializer(products, many=True)

    try:
        cache.set(cache_key, serializer.data, timeout=60)
    except Exception:
        pass

    return Response(serializer.data)

@api_view(['GET'])
def get_product(request, product_id):
    product = Product.objects.select_related('category').filter(pk=product_id).first()
    if not product:
        return Response({'error': 'Product not found'}, status=404)
    return Response(ProductSerializer(product).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_cart(request):
    cart, created = Cart.objects.get_or_create(user=request.user)
    serializer = CartSerializer(cart)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_to_cart(request):
    payload = CartChangeSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    quantity = payload.validated_data['quantity']
    if quantity == 0:
        return Response({'error': 'Quantity change cannot be zero'}, status=400)
    with transaction.atomic():
        cart, _ = Cart.objects.get_or_create(user=request.user)
        Cart.objects.select_for_update().get(pk=cart.pk)
        product = Product.objects.filter(pk=payload.validated_data['product_id']).first()
        if not product:
            return Response({'error': 'Product not found'}, status=404)
        item = CartItem.objects.filter(cart=cart, product=product).first()
        new_quantity = (item.quantity if item else 0) + quantity
        if new_quantity < 0 or (not item and quantity < 0):
            return Response({'error': 'Quantity must be positive'}, status=400)
        if new_quantity > product.stock:
            return Response({'error': 'Requested quantity exceeds available stock'}, status=400)
        if new_quantity == 0:
            item.delete()
        elif item:
            item.quantity = new_quantity
            item.save(update_fields=['quantity'])
        else:
            CartItem.objects.create(cart=cart, product=product, quantity=new_quantity)
    return Response({'message': 'Cart updated'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def remove_from_cart(request):
    payload = CartChangeSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    try:
        cart = Cart.objects.select_for_update().get(user=request.user)
    except Cart.DoesNotExist:
        return Response({"error": "Cart not found"}, status=status.HTTP_404_NOT_FOUND)

    product_id = payload.validated_data['product_id']

    try:
        cart_item = CartItem.objects.get(cart=cart, product_id=product_id)
        cart_item.delete()
        return Response({"message": "Product removed from cart"}, status=status.HTTP_200_OK)
    except CartItem.DoesNotExist:
        return Response({"error": "Item not in cart"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def buy_product(request):
    return Response({'error': 'Use the verified payment checkout to place orders.'}, status=410)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_razorpay_order(request):
    payload = CheckoutSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return Response({'error': 'Payments are not configured. Please contact the store.'}, status=503)
    with transaction.atomic():
        cart = Cart.objects.filter(user=request.user).first()
        if not cart:
            return Response({'error': 'Cart is empty'}, status=400)
        Cart.objects.select_for_update().get(pk=cart.pk)
        items = list(cart.items.select_related('product').order_by('product_id'))
        if not items:
            return Response({'error': 'Cart is empty'}, status=400)
        snapshot = []
        for item in items:
            if item.quantity <= 0 or item.quantity > item.product.stock:
                return Response({'error': f'Insufficient stock for {item.product.name}'}, status=400)
            snapshot.append({'product_id': item.product_id, 'quantity': item.quantity, 'unit_price': str(item.product.price)})
        amount = int(sum(Decimal(i['unit_price']) * i['quantity'] for i in snapshot) * 100)
        if amount <= 0:
            return Response({'error': 'Invalid cart total'}, status=400)
        try:
            provider_order = razorpay_client.order.create({'amount': amount, 'currency': 'INR', 'receipt': uuid4().hex}, timeout=15)
        except Exception:
            logger.exception('Payment order creation failed')
            return Response({'error': 'Payment service unavailable. Please try again.'}, status=502)
        Payment.objects.create(user=request.user, provider_order_id=provider_order['id'], amount=amount, items=snapshot, address=payload.validated_data['address'])
    return Response({'order_id': provider_order['id'], 'amount': amount, 'currency': 'INR', 'key': settings.RAZORPAY_KEY_ID})

def refund_unfulfilled_payment(payment_pk):
    # Persist intent before the network call; the same key makes retries safe after a crash.
    payment = Payment.objects.get(pk=payment_pk)
    try:
        refund = razorpay_client.payment.refund(payment.provider_payment_id, payment.amount,
            headers={'X-Refund-Idempotency': f'flashsale-refund-{payment.pk}'}, timeout=15)
        if not isinstance(refund, dict) or not refund.get('id') or refund.get('status') not in ('pending', 'processed'):
            raise ValueError('Invalid refund response')
        with transaction.atomic():
            locked = Payment.objects.select_for_update().get(pk=payment.pk)
            if locked.status != 'REFUNDED':
                locked.provider_refund_id = refund['id']
                locked.status = 'REFUNDED' if refund['status'] == 'processed' else 'REFUND_PENDING'
                locked.save(update_fields=['provider_refund_id', 'status'])
    except Exception:
        logger.exception('Refund needs retry for local payment %s', payment.pk)
    payment.refresh_from_db()
    messages = {
        'REFUNDED': 'Stock became unavailable. Your payment has been refunded.',
        'REFUND_PENDING': 'Stock became unavailable. Your refund has been initiated.',
        'REFUND_REQUIRED': 'Stock became unavailable. Refund confirmation is pending; please retry or contact support.',
    }
    return Response({'error': messages[payment.status], 'payment_status': payment.status,
        'reference': payment.provider_order_id}, status=409)


def settle_payment(payment_pk, payment_id, provider_payment):
    needs_refund = False
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment_pk)
        if (provider_payment.get('order_id') != payment.provider_order_id or
            provider_payment.get('amount') != payment.amount or provider_payment.get('currency') != 'INR' or
            (provider_payment.get('id') and provider_payment['id'] != payment_id)):
            return Response({'error': 'Payment does not match this order'}, status=400)
        if payment.provider_payment_id and payment.provider_payment_id != payment_id:
            return Response({'error': 'Another payment is already associated with this order'}, status=409)
        if payment.fulfilled:
            return Response({'message': 'Payment already processed successfully', 'payment_status': 'FULFILLED'})
        if payment.status in ('REFUNDED', 'REFUND_PENDING'):
            return Response({'error': 'This payment is being refunded.', 'payment_status': payment.status}, status=409)
        if provider_payment.get('status') == 'authorized':
            return Response({'message': 'Waiting for payment capture. Please do not pay again.', 'payment_status': 'PENDING'}, status=202)
        if provider_payment.get('status') != 'captured':
            return Response({'error': 'Payment is not captured'}, status=400)
        if provider_payment.get('amount_refunded', 0):
            return Response({'error': 'Payment has already been refunded; contact support.', 'payment_status': 'REFUNDED'}, status=409)
        payment.provider_payment_id = payment_id
        cart, _ = Cart.objects.get_or_create(user=payment.user)
        Cart.objects.select_for_update().get(pk=cart.pk)
        products = {p.pk: p for p in Product.objects.select_for_update().filter(pk__in=[i['product_id'] for i in payment.items]).order_by('pk')}
        if payment.status == 'REFUND_REQUIRED' or any(not products.get(i['product_id']) or products[i['product_id']].stock < i['quantity'] for i in payment.items):
            payment.status = 'REFUND_REQUIRED'
            needs_refund = True
        else:
            for item in payment.items:
                product = products[item['product_id']]
                Order.objects.create(user=payment.user, product=product, quantity=item['quantity'], unit_price=item['unit_price'], payment=payment, address=payment.address)
                product.stock -= item['quantity']
                product.save(update_fields=['stock'])
                cart_item = cart.items.filter(product=product).first()
                if cart_item:
                    if cart_item.quantity <= item['quantity']:
                        cart_item.delete()
                    else:
                        cart_item.quantity -= item['quantity']
                        cart_item.save(update_fields=['quantity'])
            payment.fulfilled = True
            payment.status = 'FULFILLED'
            transaction.on_commit(invalidate_products)
        payment.save(update_fields=['fulfilled', 'status', 'provider_payment_id'])
    if needs_refund:
        return refund_unfulfilled_payment(payment.pk)
    return Response({'message': 'Payment successful and order placed!', 'payment_status': 'FULFILLED'})


def reconcile_payment(payment):
    try:
        if payment.status == 'REFUND_REQUIRED':
            return refund_unfulfilled_payment(payment.pk)
        if payment.status == 'REFUND_PENDING':
            refund = razorpay_client.refund.fetch(payment.provider_refund_id, timeout=15)
            if refund.get('status') == 'processed':
                Payment.objects.filter(pk=payment.pk, status='REFUND_PENDING').update(status='REFUNDED')
            elif refund.get('status') == 'failed':
                logger.error('Refund failed for local payment %s; manual intervention required', payment.pk)
            return Response({'payment_status': Payment.objects.get(pk=payment.pk).status})
        if payment.fulfilled or payment.status == 'REFUNDED':
            return Response({'payment_status': 'FULFILLED' if payment.fulfilled else payment.status})
        payments = razorpay_client.order.payments(payment.provider_order_id, timeout=15)
        for entity in payments.get('items', []):
            if entity.get('status') == 'captured':
                return settle_payment(payment.pk, entity['id'], entity)
        return Response({'payment_status': 'PENDING'}, status=202)
    except Exception:
        logger.exception('Payment reconciliation failed for local payment %s', payment.pk)
        return Response({'error': 'Unable to confirm payment yet. Please retry; do not pay again.'}, status=502)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_payment(request):
    data = request.data
    if not all(isinstance(data.get(k), str) and data[k] for k in ('razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature')):
        return Response({'error': 'Missing payment verification details'}, status=400)
    payment = Payment.objects.filter(user=request.user, provider_order_id=data['razorpay_order_id']).first()
    if not payment:
        return Response({'error': 'Payment order not found'}, status=404)
    try:
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': payment.provider_order_id,
            'razorpay_payment_id': data['razorpay_payment_id'], 'razorpay_signature': data['razorpay_signature']})
    except razorpay.errors.SignatureVerificationError:
        return Response({'error': 'Payment verification failed'}, status=400)
    try:
        entity = razorpay_client.payment.fetch(data['razorpay_payment_id'], timeout=15)
    except Exception:
        return Response({'error': 'Unable to confirm payment yet. Please retry; do not pay again.'}, status=502)
    return settle_payment(payment.pk, data['razorpay_payment_id'], entity)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_status(request, provider_order_id):
    payment = Payment.objects.filter(user=request.user, provider_order_id=provider_order_id).first()
    if not payment:
        return Response({'error': 'Payment order not found'}, status=404)
    return reconcile_payment(payment)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def payment_webhook(request):
    secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not secret:
        return Response({'error': 'Webhook is not configured'}, status=503)
    signature = request.headers.get('X-Razorpay-Signature', '')
    expected = hmac.new(secret.encode(), request.body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return Response({'error': 'Invalid webhook signature'}, status=400)
    try:
        event = json.loads(request.body)
        event_name = event.get('event', '')
        if event_name not in ('payment.captured', 'order.paid', 'refund.processed', 'refund.failed'):
            return Response({'received': True})
        if event_name.startswith('refund.'):
            refund = event['payload']['refund']['entity']
            payment = Payment.objects.filter(provider_payment_id=refund.get('payment_id'), provider_refund_id=refund.get('id')).first()
        else:
            order_id = event.get('payload', {}).get('payment', {}).get('entity', {}).get('order_id')
            if not order_id:
                order_id = event['payload']['order']['entity']['id']
            payment = Payment.objects.filter(provider_order_id=order_id).first()
    except (ValueError, KeyError, TypeError, AttributeError):
        return Response({'error': 'Invalid webhook payload'}, status=400)
    if not payment:
        return Response({'received': True})
    result = reconcile_payment(payment)
    if result.status_code >= 500:
        return result
    if result.data.get('payment_status') == 'REFUND_REQUIRED':
        return Response({'error': 'Refund retry required'}, status=503)
    return Response({'received': True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_orders(request):
    orders = Order.objects.filter(user=request.user).select_related('product__category', 'user__profile', 'delivery_partner__profile').order_by('-created_at')
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_history(request):
    payments = Payment.objects.filter(user=request.user).order_by('-created_at')
    return Response([{'reference': p.provider_order_id, 'amount': p.amount,
        'status': 'FULFILLED' if p.fulfilled else p.status, 'created_at': p.created_at}
        for p in payments])
