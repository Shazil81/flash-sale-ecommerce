import useApiResource from '../hooks/useApiResource';
import ProductImage from '../components/ProductImage';
import api from '../api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Orders() {
  const { data, loading, error, reload } = useApiResource('/orders/');
  const orders = data || [];
  const payments = useApiResource('/payments/');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [checkingPayment, setCheckingPayment] = useState('');
  const navigate = useNavigate();

  async function checkPayment(reference) {
    setCheckingPayment(reference);
    try {
      const result = await api.get(`/payment/status/${encodeURIComponent(reference)}/`);
      setPaymentMessage(result.data.payment_status === 'PENDING' ? 'Payment confirmation is pending. Please do not pay again.' : 'Payment status updated.');
    } catch (failure) { setPaymentMessage(failure.response?.data?.error || 'Unable to check payment. Please retry.'); }
    finally { payments.reload(); reload(); setCheckingPayment(''); }
  }


  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return <span className="badge bg-warning text-dark">Pending</span>;
      case 'ASSIGNED': return <span className="badge bg-info text-dark">Assigned to Partner</span>;
      case 'OUT_FOR_DELIVERY': return <span className="badge bg-primary">Out for Delivery</span>;
      case 'DELIVERED': return <span className="badge bg-success">Delivered</span>;
      default: return <span className="badge bg-secondary">{status}</span>;
    }
  };

  if (loading) return <div className="container py-5" role="status">Loading orders…</div>;
  if (error) return <div className="container py-5" role="alert">{error} <button className="btn btn-outline-primary" onClick={reload}>Try again</button></div>;

  return (
    <div className="container py-5">
      <h2 className="mb-4 fw-bold">My Orders</h2>
      {paymentMessage && <p className="alert alert-info" role="status">{paymentMessage}</p>}
      {payments.error && <p role="alert">Unable to load payment history. <button className="btn btn-outline-primary" onClick={payments.reload}>Retry payments</button></p>}
      {payments.data?.some(payment => payment.status !== 'FULFILLED') && <section className="mb-4" aria-label="Payment updates">
        <h3 className="h5">Payment updates</h3>
        <ul className="list-group">{payments.data.filter(payment => payment.status !== 'FULFILLED').map(payment => <li className="list-group-item d-flex flex-wrap gap-3 justify-content-between align-items-center" key={payment.reference}>
          <span><strong>₹ {(payment.amount / 100).toFixed(2)}</strong> — {payment.status.replaceAll('_', ' ').toLowerCase()}<br /><small className="text-muted">Reference: {payment.reference}</small></span>
          {payment.status !== 'REFUNDED' && <button className="btn btn-outline-primary" disabled={Boolean(checkingPayment)} onClick={() => checkPayment(payment.reference)}>{checkingPayment === payment.reference ? 'Checking…' : 'Check payment status'}</button>}
        </li>)}</ul>
      </section>}
      {orders.length === 0 ? (
        <div className="alert alert-light shadow-sm text-center py-5">
          <h5>You haven't placed any orders yet.</h5>
          <button className="btn btn-primary-custom mt-3" onClick={() => navigate('/')}>Continue Shopping</button>
        </div>
      ) : (
        <div className="row">
          {orders.map((order) => (
            <div className="col-12 mb-4" key={order.id}>
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="row g-0">
                  <div className="col-md-2 bg-light d-flex align-items-center justify-content-center p-3">
                    <ProductImage src={order.product?.image_url} className="img-fluid rounded" alt={order.product?.name} style={{maxHeight: '120px'}} />
                  </div>
                  <div className="col-md-10">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h5 className="card-title fw-bold mb-1">{order.product?.name}</h5>
                          <p className="text-muted small mb-2">Order #{order.id} • Placed on {new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          {getStatusBadge(order.status)}
                        </div>
                      </div>

                      <div className="row mt-3">
                        <div className="col-md-4">
                          <p className="mb-1 text-muted small">Quantity</p>
                          <p className="fw-bold">{order.quantity}</p>
                        </div>
                        <div className="col-md-4">
                          <p className="mb-1 text-muted small">Total Amount</p>
                          <p className="fw-bold text-danger">₹ {((order.unit_price ?? order.product?.price) * order.quantity).toFixed(2)}</p>
                        </div>
                        <div className="col-md-4">
                          <p className="mb-1 text-muted small">Estimated Delivery</p>
                          <p className="fw-bold text-success">
                            {order.estimated_delivery_date ? new Date(order.estimated_delivery_date).toLocaleDateString() : 'Pending'}
                          </p>
                        </div>
                      </div>

                      {order.delivery_partner_details && order.status !== 'DELIVERED' && (
                        <div className="alert alert-info mt-2 mb-0 py-2">
                          <i className="bi bi-truck me-2"></i>
                          Your delivery partner is <strong>{order.delivery_partner_details.username}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Orders;
