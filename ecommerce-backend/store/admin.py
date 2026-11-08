from django.contrib import admin
from .models import Product, Order, Payment

admin.site.register(Product)
admin.site.register(Order)

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'provider_order_id', 'amount', 'status', 'fulfilled', 'created_at')
    list_filter = ('status', 'fulfilled')
    readonly_fields = [field.name for field in Payment._meta.fields]
    search_fields = ('provider_order_id', 'provider_payment_id')

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
