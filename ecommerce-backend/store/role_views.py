from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from .models import Order, UserProfile
from .serializers import OrderSerializer, UserProfileSerializer, UserSerializer

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    profile, created = UserProfile.objects.get_or_create(user=request.user)

    if request.method == 'PUT':
        mobile = request.data.get('mobile')
        if mobile is not None:
            profile.mobile = mobile
            profile.save()

    serializer = UserSerializer(request.user)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_get_orders(request):
    try:
        if request.user.profile.role != 'ADMIN':
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
    except UserProfile.DoesNotExist:
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    orders = Order.objects.all().order_by('-created_at')
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_get_delivery_partners(request):
    try:
        if request.user.profile.role != 'ADMIN':
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
    except:
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    partners = User.objects.filter(profile__role='DELIVERY')
    serializer = UserSerializer(partners, many=True)
    return Response(serializer.data)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_assign_delivery(request, order_id):
    try:
        if request.user.profile.role != 'ADMIN':
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
    except:
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    partner_id = request.data.get('partner_id')
    try:
        order = Order.objects.get(id=order_id)
        if order.status not in ['PENDING', 'ASSIGNED']:
            return Response({'error': 'This order cannot be reassigned'}, status=400)
        partner = User.objects.get(id=partner_id, profile__role='DELIVERY')
        if partner.profile.kyc_status != 'APPROVED':
            return Response({"error": "Cannot assign order! Partner KYC is not approved."}, status=status.HTTP_400_BAD_REQUEST)
        order.delivery_partner = partner
        order.status = 'ASSIGNED'
        order.save()
        return Response({"message": "Delivery partner assigned successfully"})
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
    except User.DoesNotExist:
        return Response({"error": "Partner not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def delivery_get_orders(request):
    try:
        if request.user.profile.role != 'DELIVERY':
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
    except:
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    orders = Order.objects.filter(delivery_partner=request.user).order_by('-created_at')
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def delivery_update_status(request, order_id):
    try:
        if request.user.profile.role != 'DELIVERY':
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
    except:
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    new_status = request.data.get('status')
    if new_status not in ['OUT_FOR_DELIVERY', 'DELIVERED']:
        return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        order = Order.objects.get(id=order_id, delivery_partner=request.user)
        if request.user.profile.kyc_status != 'APPROVED':
            return Response({'error': 'Approved KYC is required'}, status=403)
        if {'ASSIGNED': 'OUT_FOR_DELIVERY', 'OUT_FOR_DELIVERY': 'DELIVERED'}.get(order.status) != new_status:
            return Response({'error': 'Invalid status transition'}, status=400)
        order.status = new_status
        order.save()
        return Response({"message": "Order status updated successfully"})
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_approve_kyc(request, partner_id):
    try:
        if request.user.profile.role != 'ADMIN':
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
    except:
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    try:
        partner = User.objects.get(id=partner_id, profile__role='DELIVERY')
        action = request.data.get('action') # 'APPROVE' or 'REJECT'
        if action not in ['APPROVE', 'REJECT']:
            return Response({'error': 'Invalid KYC action'}, status=400)
        if action == 'APPROVE':
            partner.profile.kyc_status = 'APPROVED'
        else:
            partner.profile.kyc_status = 'REJECTED'
        partner.profile.save()
        return Response({"message": f"KYC {action}D successfully"})
    except User.DoesNotExist:
        return Response({"error": "Partner not found"}, status=status.HTTP_404_NOT_FOUND)
