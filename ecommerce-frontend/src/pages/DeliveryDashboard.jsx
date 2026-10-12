import { useState, useEffect, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
import api from '../api';
import { useNavigate } from 'react-router-dom';

function DeliveryDashboard() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const [kycStatus, setKycStatus] = useState('NONE');
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/delivery/orders/');
      setOrders(response.data);
    } catch (error) {
      if (error.response?.status === 403) navigate('/');
      console.error("Error fetching delivery orders:", error);
    }
  }, [navigate]);

  useEffect(() => {
    let active = true;
    api.get('/delivery/orders/').then(({ data }) => { if (active) { setOrders(data); } }).catch(() => { if (active) { setMessage('Unable to load data. Please try again.'); } });
    api.get('/me/').then(({ data }) => { if (active) { setKycStatus(data.profile?.kyc_status || 'NONE'); } }).catch(() => { if (active) { setMessage('Unable to load data. Please try again.'); } });
      return () => { active = false; };
  }, []);

  const updateStatus = async (orderId, status) => {
    try {
      await api.put(`/delivery/orders/${orderId}/status/`, { status });
      setMessage(`Order marked as ${status.replace('_', ' ')}`);
      fetchOrders();
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to update status');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="container py-5">
      <h2 className="mb-3 fw-bold">Delivery Partner Dashboard</h2>

      {/* KYC Status Banner */}
      {kycStatus === 'PENDING' && (
        <div className="alert alert-warning border-warning shadow-sm rounded-3 d-flex align-items-center mb-4 p-3">
          <i className="bi bi-clock-history fs-3 text-warning me-3"></i>
          <div>
            <h6 className="fw-bold mb-1">⏳ KYC Verification Under Review</h6>
            <p className="mb-0 small text-muted">Your delivery partner registration has been received and is waiting for Admin approval. You will receive order assignments once verified.</p>
          </div>
        </div>
      )}

      {kycStatus === 'APPROVED' && (
        <div className="alert alert-success border-success shadow-sm rounded-3 d-flex align-items-center mb-4 p-3">
          <i className="bi bi-patch-check-fill fs-3 text-success me-3"></i>
          <div>
            <h6 className="fw-bold mb-1">✓ Verified Delivery Partner</h6>
            <p className="mb-0 small text-muted">Your account is fully verified and eligible to receive customer delivery assignments.</p>
          </div>
        </div>
      )}

      {kycStatus === 'REJECTED' && (
        <div className="alert alert-danger border-danger shadow-sm rounded-3 d-flex align-items-center mb-4 p-3">
          <i className="bi bi-x-octagon-fill fs-3 text-danger me-3"></i>
          <div>
            <h6 className="fw-bold mb-1">🚫 Account Suspended / KYC Rejected</h6>
            <p className="mb-0 small text-muted">Your delivery partner account was rejected by the Admin. You cannot receive or process orders.</p>
          </div>
        </div>
      )}

      {/* Income Analytics */}
      <div className="card shadow-sm rounded-4 border-0 mb-4 p-4">
        <h4 className="fw-bold mb-3 text-primary-custom">Income Analytics</h4>
        <div className="row">
          <div className="col-md-4 mb-3">
            <div className="p-3 bg-light rounded text-center border h-100 d-flex flex-column justify-content-center">
              <h5 className="text-muted mb-1">Total Delivered</h5>
              <h2 className="fw-bold text-success">{orders.filter(o => o.status === 'DELIVERED').length}</h2>
            </div>
          </div>
          <div className="col-md-4 mb-3">
            <div className="p-3 bg-light rounded text-center border h-100 d-flex flex-column justify-content-center">
              <h5 className="text-muted mb-1">Total Income</h5>
              <h2 className="fw-bold text-success">₹{orders.filter(o => o.status === 'DELIVERED').length * 50}</h2>
            </div>
          </div>
          <div className="col-md-4 mb-3">
             <div style={{height: '150px'}}>
               <Bar
                 data={{
                   labels: ['Pending', 'Assigned', 'Out', 'Delivered'],
                   datasets: [{
                     label: 'Order Status Count',
                     data: [
                       orders.filter(o => o.status === 'PENDING').length,
                       orders.filter(o => o.status === 'ASSIGNED').length,
                       orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length,
                       orders.filter(o => o.status === 'DELIVERED').length
                     ],
                     backgroundColor: ['#ffc107', '#0dcaf0', '#fd7e14', '#198754']
                   }]
                 }}
                 options={{ maintainAspectRatio: false }}
               />
             </div>
          </div>
        </div>
      </div>
      {message && <div className="alert alert-success">{message}</div>}

      <div className="row">
        {orders.length === 0 ? (
          <div className="col-12">
            <div className="alert alert-light shadow-sm text-center py-4">
              You have no assigned orders right now.
            </div>
          </div>
        ) : (
          orders.map(order => (
            <div className="col-md-6 mb-4" key={order.id}>
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="fw-bold mb-0">Order #{order.id}</h5>
                    <span className={`badge d-flex align-items-center ${order.status === 'DELIVERED' ? 'bg-success px-3 py-2' : 'bg-warning text-dark px-3 py-2'}`}>
                      {order.status === 'DELIVERED' && <i className="bi bi-check-circle-fill me-2 fs-6"></i>}
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                  <hr/>
                  <p className="mb-1"><strong>Product:</strong> {order.product?.name} (Qty: {order.quantity})</p>
                  <p className="mb-1"><strong>Customer:</strong> {order.user_details?.username}</p>
                  <p className="mb-3"><strong>Delivery Address:</strong> {order.address}</p>

                  {order.status === 'DELIVERED' ? (
                    <div className="d-flex align-items-center justify-content-center text-success mt-auto p-2 bg-success bg-opacity-10 rounded">
                      <i className="bi bi-check-circle-fill fs-4 me-2"></i>
                      <span className="fw-bold">Successfully Delivered</span>
                    </div>
                  ) : (
                    <div className="d-flex gap-2 mt-auto">
                      {order.status === 'ASSIGNED' && (
                        <button
                          className="btn btn-primary w-100 rounded-pill"
                          onClick={() => updateStatus(order.id, 'OUT_FOR_DELIVERY')}
                        >
                          Mark Out for Delivery
                        </button>
                      )}
                      {order.status === 'OUT_FOR_DELIVERY' && (
                        <button
                          className="btn btn-success w-100 rounded-pill"
                          onClick={() => updateStatus(order.id, 'DELIVERED')}
                        >
                          Mark as Delivered
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DeliveryDashboard;
