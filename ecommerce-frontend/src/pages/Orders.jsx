import { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function Orders() {
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api.get('/orders/').then(({ data }) => { if (active) { setOrders(data); } }).catch((error) => { if (active) { console.error(error); } });
      return () => { active = false; };
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return <span className="badge bg-warning text-dark">Pending</span>;
      case 'ASSIGNED': return <span className="badge bg-info text-dark">Assigned to Partner</span>;
      case 'OUT_FOR_DELIVERY': return <span className="badge bg-primary">Out for Delivery</span>;
      case 'DELIVERED': return <span className="badge bg-success">Delivered</span>;
      default: return <span className="badge bg-secondary">{status}</span>;
    }
  };

  return (
    <div className="container py-5">
      <h2 className="mb-4 fw-bold">My Orders</h2>
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
                    <img src={order.product?.image_url || 'https://via.placeholder.com/150'} className="img-fluid rounded" alt={order.product?.name} style={{maxHeight: '120px'}} />
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
