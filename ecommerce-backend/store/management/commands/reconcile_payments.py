from django.core.management.base import BaseCommand
from store.models import Payment
from store.views import reconcile_payment


class Command(BaseCommand):
    help = 'Retry payment/refund confirmation for unresolved checkouts. Schedule this in production.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=50)

    def handle(self, *args, **options):
        if options['limit'] < 1:
            self.stderr.write('Limit must be positive.')
            return
        payments = Payment.objects.filter(fulfilled=False, status__in=['PENDING', 'REFUND_REQUIRED', 'REFUND_PENDING']).order_by('created_at')[:options['limit']]
        for payment in payments:
            result = reconcile_payment(payment)
            self.stdout.write(f'{payment.provider_order_id}: {result.data.get("payment_status", "retry required")}')
