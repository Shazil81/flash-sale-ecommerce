import { useState, useEffect, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
import api from '../api';
import { useNavigate } from 'react-router-dom';

function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/admin/orders/');
      setOrders(response.data);
    } catch (error) {
      if (error.response?.status === 403) navigate('/');
      console.error("Error fetching admin orders:", error);
    }
  }, [navigate]);

  const fetchPartners = useCallback(async () => {
    try {
      const response = await api.get('/admin/delivery-partners/');
      setPartners(response.data);
    } catch (error) {
      console.error("Error fetching partners:", error);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/admin/orders/').then(({ data }) => { if (active) { setOrders(data); } }).catch(() => { if (active) { setMessage('Unable to load data. Please try again.'); } });
    api.get('/admin/delivery-partners/').then(({ data }) => { if (active) { setPartners(data); } }).catch(() => { if (active) { setMessage('Unable to load data. Please try again.'); } });
      return () => { active = false; };
  }, []);

  const handleKyc = async (partnerId, action) => {
    try {
      await api.put(`/admin/delivery-partners/${partnerId}/kyc/`, { action });
      setMessageType('success');
      setMessage(`Partner KYC has been ${action === 'APPROVE' ? 'APPROVED' : 'REJECTED'} successfully!`);
      fetchPartners();
      setTimeout(() => setMessage(''), 4000);
    } catch {
      setMessageType('danger');
      setMessage('Failed to update KYC status.');
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const assignPartner = async (orderId, partnerId) => {
    if (!partnerId) return;
    try {
      await api.put(`/admin/orders/${orderId}/assign/`, { partner_id: partnerId });
      setMessageType('success');
      setMessage('Delivery partner assigned successfully!');
      fetchOrders();
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessageType('danger');
      setMessage('Failed to assign partner.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">Admin Dashboard</h2>
          <p className="text-muted mb-0">Manage orders, analytics, and delivery partner KYC approvals</p>
        </div>
      </div>

      {/* Transaction & Platform Analytics */}
      <div className="card shadow-sm rounded-4 border-0 mb-4 p-4">
        <h4 className="fw-bold mb-3 text-primary-custom">Platform Analytics</h4>
        <div className="row g-3">
          <div className="col-md-4">
            <div className="p-3 bg-light rounded text-center border h-100 d-flex flex-column justify-content-center">
              <h5 className="text-muted mb-1 small text-uppercase fw-bold">Total Revenue</h5>
              <h2 className="fw-bold text-success mb-0">
                ₹{orders.filter(o => o.status === 'DELIVERED').reduce((acc, o) => acc + parseFloat(o.product?.price || 0) * o.quantity, 0).toLocaleString()}
              </h2>
            </div>
          </div>
          <div className="col-md-4">
            <div className="p-3 bg-light rounded text-center border h-100 d-flex flex-column justify-content-center">
              <h5 className="text-muted mb-1 small text-uppercase fw-bold">Total Orders</h5>
              <h2 className="fw-bold text-primary mb-0">{orders.length}</h2>
            </div>
          </div>
          <div className="col-md-4">
            <div style={{ height: '150px' }}>
              <Bar
                data={{
                  labels: ['Pending', 'Assigned', 'Out', 'Delivered'],
                  datasets: [{
                    label: 'Orders by Status',
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

      {message && (
        <div className={`alert alert-${messageType} alert-dismissible fade show shadow-sm rounded-3`}>
          <i className={`bi ${messageType === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
          {message}
        </div>
      )}

      {/* Recent Orders Section */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
        <h4 className="fw-bold mb-3">Recent Orders</h4>
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Order ID</th>
                <th>Product</th>
                <th>Customer</th>
                <th>Address</th>
                <th>Status</th>
                <th>Assign Delivery Partner</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="fw-bold">#{order.id}</td>
                  <td>
                    <span className="fw-semibold">{order.product?.name}</span>
                    <br/>
                    <small className="text-muted">Qty: {order.quantity}</small>
                  </td>
                  <td>{order.user_details?.username}</td>
                  <td><small className="text-muted">{order.address}</small></td>
                  <td>
                    <span className={`badge ${order.status === 'DELIVERED' ? 'bg-success' : 'bg-warning text-dark'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    {order.status === 'PENDING' || order.status === 'ASSIGNED' ? (
                      <select
                        className="form-select form-select-sm"
                        defaultValue={order.delivery_partner_details?.id || ""}
                        onChange={(e) => assignPartner(order.id, e.target.value)}
                      >
                        <option value="" disabled>Select Partner</option>
                        {partners.map(p => (
                          <option
                            key={p.id}
                            value={p.id}
                            disabled={p.profile?.kyc_status !== 'APPROVED'}
                          >
                            {p.username} {p.profile?.kyc_status === 'APPROVED' ? '✓ (Verified)' : '(KYC: ' + (p.profile?.kyc_status || 'Pending') + ' - Not Eligible)'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge bg-light text-dark border">
                        🚚 {order.delivery_partner_details?.username || 'None'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan="6" className="text-center py-4 text-muted">No orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delivery Partners KYC Approval Section */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="fw-bold mb-1">Delivery Partners KYC Approval</h4>
            <p className="text-muted small mb-0">Approve or reject delivery partners before assigning them orders</p>
          </div>
          <span className="badge bg-primary rounded-pill px-3 py-2">
            Total Partners: {partners.length}
          </span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>KYC Status</th>
                <th style={{ minWidth: '220px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {partners.map(partner => {
                const status = partner.profile?.kyc_status || 'NONE';
                return (
                  <tr key={partner.id}>
                    <td className="fw-bold">#{partner.id}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-person-badge text-primary fs-5"></i>
                        <span className="fw-semibold">{partner.username}</span>
                      </div>
                    </td>
                    <td>{partner.email || 'N/A'}</td>
                    <td>
                      <span className="font-monospace text-muted">
                        {partner.profile?.mobile || 'Not Provided'}
                      </span>
                    </td>
                    <td>
                      {status === 'APPROVED' && (
                        <span className="badge bg-success-subtle text-success border border-success px-3 py-2 rounded-pill fw-bold">
                          <i className="bi bi-patch-check-fill me-1"></i> APPROVED
                        </span>
                      )}
                      {status === 'REJECTED' && (
                        <span className="badge bg-danger-subtle text-danger border border-danger px-3 py-2 rounded-pill fw-bold">
                          <i className="bi bi-x-circle-fill me-1"></i> REJECTED
                        </span>
                      )}
                      {status === 'PENDING' && (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning px-3 py-2 rounded-pill fw-bold">
                          <i className="bi bi-clock-history me-1"></i> PENDING
                        </span>
                      )}
                      {status === 'NONE' && (
                        <span className="badge bg-secondary-subtle text-secondary border px-3 py-2 rounded-pill fw-bold">
                          <i className="bi bi-question-circle me-1"></i> NOT VERIFIED
                        </span>
                      )}
                    </td>
                    <td>
                      {status === 'APPROVED' && (
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-success small fw-bold">
                            <i className="bi bi-check2-circle"></i> Active
                          </span>
                          <button
                            className="btn btn-sm btn-outline-danger rounded-pill px-3"
                            onClick={() => handleKyc(partner.id, 'REJECT')}
                            title="Revoke KYC Approval"
                          >
                            <i className="bi bi-slash-circle me-1"></i> Revoke
                          </button>
                        </div>
                      )}

                      {status === 'REJECTED' && (
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-danger small fw-bold me-1">
                            <i className="bi bi-x-circle"></i> Inactive
                          </span>
                          <button
                            className="btn btn-sm btn-success rounded-pill px-3 shadow-sm d-flex align-items-center gap-1"
                            onClick={() => handleKyc(partner.id, 'APPROVE')}
                            title="Re-approve Partner KYC"
                          >
                            <i className="bi bi-check-lg"></i> Approve KYC
                          </button>
                        </div>
                      )}

                      {status !== 'APPROVED' && status !== 'REJECTED' && (
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-success rounded-pill px-3 shadow-sm d-flex align-items-center gap-1"
                            onClick={() => handleKyc(partner.id, 'APPROVE')}
                          >
                            <i className="bi bi-check-lg"></i> Approve KYC
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger rounded-pill px-3 d-flex align-items-center gap-1"
                            onClick={() => handleKyc(partner.id, 'REJECT')}
                          >
                            <i className="bi bi-x-lg"></i> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {partners.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">
                    No delivery partners registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
