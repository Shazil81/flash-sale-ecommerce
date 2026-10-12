from django.urls import path
from .views import get_products, buy_product, register_user, get_cart, add_to_cart, remove_from_cart, create_razorpay_order, verify_payment, get_orders
from .role_views import get_user_profile, admin_get_orders, admin_get_delivery_partners, admin_assign_delivery, delivery_get_orders, delivery_update_status, admin_approve_kyc
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('products/', get_products, name='get_products'),
    path('buy/', buy_product, name='buy_product'),
    path('cart/', get_cart, name='get_cart'),
    path('cart/add/', add_to_cart, name='add_to_cart'),
    path('cart/remove/', remove_from_cart, name='remove_from_cart'),
    path('payment/create-order/', create_razorpay_order, name='create_razorpay_order'),
    path('payment/verify/', verify_payment, name='verify_payment'),
    path('orders/', get_orders, name='get_orders'),
    path('register/', register_user, name='register_user'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Role-based endpoints
    path('me/', get_user_profile, name='get_user_profile'),
    path('admin/orders/', admin_get_orders, name='admin_get_orders'),
    path('admin/delivery-partners/', admin_get_delivery_partners, name='admin_get_delivery_partners'),
    path('admin/delivery-partners/<int:partner_id>/kyc/', admin_approve_kyc, name='admin_approve_kyc'),
    path('admin/orders/<int:order_id>/assign/', admin_assign_delivery, name='admin_assign_delivery'),
    path('delivery/orders/', delivery_get_orders, name='delivery_get_orders'),
    path('delivery/orders/<int:order_id>/status/', delivery_update_status, name='delivery_update_status'),
]
