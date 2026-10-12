import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getAuthToken } from '../utils/auth';

function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const token = getAuthToken();
    if (!token) {
      navigate('/login');
    } else {
      api.get('/orders/').then(({ data }) => { if (active) { setOrders(data); setLoading(false); } }).catch((error) => { if (active) { console.error(error); setLoading(false); } });
    }
      return () => { active = false; };
  }, [navigate]);

  if (loading) {
    return <div className="container mt-5 text-center"><h5>Loading Orders...</h5></div>;
  }

  return (
    <div className="container mt-4 pb-5">
      <h2 className="mb-4">My Orders</h2>

      {orders.length === 0 ? (
        <div className="text-center mt-5">
          <h4>No orders found</h4>
          <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="row">
          <div className="col-md-10 offset-md-1">
            {orders.map((order) => (
              <div className="card mb-3 shadow-sm border-0" key={order.id}>
                <div className="row g-0">
                  <div className="col-md-2 p-2 bg-light d-flex align-items-center justify-content-center">
                    <img
                      src={order.product.image_url || 'https://via.placeholder.com/150'}
                      className="img-fluid rounded"
                      alt={order.product.name}
                      style={{ maxHeight: '100px', objectFit: 'contain' }}
                    />
                  </div>
                  <div className="col-md-10">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h5 className="card-title mb-0">{order.product.name}</h5>
                        <span className="badge bg-success">Placed</span>
                      </div>
                      <p className="mb-1 text-muted small">
                        <strong>Order ID:</strong> #{order.id} | <strong>Date:</strong> {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <p className="mb-1">
                        <strong>Quantity:</strong> {order.quantity} | <strong>Total:</strong> ₹ {order.product.price * order.quantity}
                      </p>
                      <p className="mb-0 small text-secondary">
                        <strong>Delivering to:</strong> {order.address}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderHistory;
