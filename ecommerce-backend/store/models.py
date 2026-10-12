from django.db import models
from django.contrib.auth.models import User
from datetime import timedelta
from django.utils import timezone

class UserProfile(models.Model):
    ROLE_CHOICES = (
        ('USER', 'User'),
        ('DELIVERY', 'Delivery Partner'),
        ('ADMIN', 'Admin'),
    )
    KYC_CHOICES = (
        ('NONE', 'Not Applied'),
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=15, choices=ROLE_CHOICES, default='USER')
    mobile = models.CharField(max_length=15, blank=True, null=True)
    kyc_status = models.CharField(max_length=15, choices=KYC_CHOICES, default='NONE')

    def __str__(self):
        return f"{self.user.username} - {self.role}"

class Wishlist(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='wishlist')
    products = models.ManyToManyField('Product', blank=True)

    def __str__(self):
        return f"Wishlist - {self.user.username}"

# Category Table
class Category(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, blank=True, null=True)

    def __str__(self):
        return self.name

# Product Table
class Product(models.Model):
    name = models.CharField(max_length=200) # Product name
    description = models.TextField()         # Details
    price = models.DecimalField(max_digits=10, decimal_places=2) # Price
    stock = models.IntegerField(default=10)  # Total quantity available
    image_url = models.URLField(max_length=500, blank=True)
    category = models.ForeignKey(Category, related_name='products', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name

# Cart Table
class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Cart - {self.user.username}"

# Cart Item Table
class CartItem(models.Model):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"

# Order Table
class Order(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('ASSIGNED', 'Assigned'),
        ('OUT_FOR_DELIVERY', 'Out for Delivery'),
        ('DELIVERED', 'Delivered'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    address = models.TextField(default="Not Provided")
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    estimated_delivery_date = models.DateTimeField(null=True, blank=True)
    delivery_partner = models.ForeignKey(User, related_name='deliveries', on_delete=models.SET_NULL, null=True, blank=True)
    delivery_fee = models.DecimalField(max_digits=6, decimal_places=2, default=50.00)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment = models.ForeignKey('Payment', on_delete=models.PROTECT, null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.estimated_delivery_date:
            self.estimated_delivery_date = timezone.now() + timedelta(days=3)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Order #{self.id} - {self.product.name}"


class Payment(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    provider_order_id = models.CharField(max_length=100, unique=True)
    provider_payment_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    amount = models.PositiveIntegerField()
    items = models.JSONField()
    address = models.TextField()
    fulfilled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
