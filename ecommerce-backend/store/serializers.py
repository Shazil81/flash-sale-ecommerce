from rest_framework import serializers
from .models import Category, Product, Cart, CartItem, Order, UserProfile
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db import transaction

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Product
        fields = '__all__'

class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source='product', write_only=True
    )

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_id', 'quantity']

class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ['id', 'user', 'created_at', 'items', 'total_price']

    def get_total_price(self, obj):
        return sum(item.product.price * item.quantity for item in obj.items.all())

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role', 'mobile', 'kyc_status']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile']

class OrderSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    delivery_partner_details = UserSerializer(source='delivery_partner', read_only=True)
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = Order
        fields = '__all__'

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=['USER', 'DELIVERY'], write_only=True, required=False, default='USER')
    mobile = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'mobile']

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop('role', 'USER')
        mobile = validated_data.pop('mobile', '')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )

        kyc_status = 'PENDING' if role == 'DELIVERY' else 'NONE'
        UserProfile.objects.create(user=user, role=role, mobile=mobile, kyc_status=kyc_status)

        if role == 'USER':
            Cart.objects.create(user=user)
        return user
