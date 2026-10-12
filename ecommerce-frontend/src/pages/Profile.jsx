import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function Profile() {
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [mobile, setMobile] = useState('');
  const [message, setMessage] = useState('');
  const [isEditingMobile, setIsEditingMobile] = useState(false);
  const navigate = useNavigate();

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/me/');
      setProfile({
        username: res.data.username,
        email: res.data.email,
        role: res.data.profile?.role || 'USER',
        kyc_status: res.data.profile?.kyc_status || 'NONE'
      });
      if (res.data.profile?.mobile) {
        setMobile(res.data.profile.mobile);
        setIsEditingMobile(false);
      } else {
        setIsEditingMobile(true);
      }
    } catch (err) {
      if (err.response?.status === 401) navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    let active = true;
    api.get('/me/').then(({ data }) => { if (active) { setProfile({ username: data.username, email: data.email, ...data.profile }); setMobile(data.profile?.mobile || ''); setIsEditingMobile(!data.profile?.mobile); } }).catch(() => { if (active) { setMessage('Unable to load data. Please try again.'); } });
    api.get('/orders/').then(({ data }) => { if (active) { setOrders(data); } }).catch(() => { if (active) { setMessage('Unable to load data. Please try again.'); } });
      return () => { active = false; };
  }, []);

  const updateProfile = async () => {
    try {
      await api.put('/me/', { mobile });
      setMessage('Profile updated successfully!');
      fetchProfile();
      setIsEditingMobile(false);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to update profile');
    }
  };

  if (!profile) return <div className="container mt-5 text-center">Loading profile...</div>;

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-md-4 mb-4">
          <div className="card shadow-sm border-0 rounded-4 p-4 text-center">
            <div className="bg-primary-custom text-white rounded-circle d-inline-flex align-items-center justify-content-center mx-auto mb-3" style={{width: '80px', height: '80px', fontSize: '2rem'}}>
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <h4 className="fw-bold">{profile.username}</h4>
            <p className="text-muted">{profile.email}</p>
            <span className="badge bg-secondary mb-3">{profile.role}</span>
            <hr />
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0 fw-bold text-start">Mobile Number</h6>
              {!isEditingMobile && (
                <button className="btn btn-sm btn-link p-0 text-decoration-none" onClick={() => setIsEditingMobile(true)}>Edit</button>
              )}
            </div>
            {message && <div className="alert alert-success py-2">{message}</div>}

            {isEditingMobile ? (
              <>
                <div className="text-start mb-3">
                  <input type="tel" className="form-control" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Enter mobile number" />
                </div>
                <button className="btn btn-primary-custom w-100 rounded-pill mb-2" onClick={updateProfile}>Save Changes</button>
                {mobile && <button className="btn btn-light w-100 rounded-pill border" onClick={() => setIsEditingMobile(false)}>Cancel</button>}
              </>
            ) : (
              <div className="text-start mb-3">
                <p className="form-control bg-light mb-0 text-muted">{mobile || 'Not provided'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="col-md-8">
          {profile.role === 'ADMIN' ? (
            <div className="card border-0 shadow-sm rounded-4 p-5 text-center">
              <h3 className="fw-bold text-primary-custom mb-3">Admin Account</h3>
              <p className="fs-5 text-muted mb-4">You are logged in as an Administrator. You don't place orders yourself.</p>
              <a href="/admin-dashboard" className="btn btn-primary btn-lg rounded-pill px-5">Go to Admin Dashboard</a>
            </div>
          ) : profile.role === 'DELIVERY' ? (
            <div className="card border-0 shadow-sm rounded-4 p-5 text-center">
              <h3 className="fw-bold text-primary-custom mb-3">Delivery Partner Account</h3>
              <p className="fs-5 text-muted mb-4">You are logged in as a Delivery Partner. Track your deliveries and income in your dashboard.</p>
              <a href="/delivery-dashboard" className="btn btn-warning btn-lg rounded-pill px-5 fw-bold text-dark">Go to Delivery Dashboard</a>
            </div>
          ) : (
            <>
              <h3 className="fw-bold mb-4">My Orders</h3>
              {orders.length === 0 ? (
                <div className="alert alert-info">You haven't placed any orders yet.</div>
              ) : (
                orders.map(order => (
                  <div className="card shadow-sm border-0 rounded-3 mb-3" key={order.id}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="fw-bold text-primary-custom mb-0">Order #{order.id}</h5>
                    <span className={`badge ${order.status === 'DELIVERED' ? 'bg-success' : 'bg-warning text-dark'}`}>{order.status}</span>
                  </div>
                  <p className="mb-1"><strong>Product:</strong> {order.product?.name} x {order.quantity}</p>
                  <p className="mb-1"><strong>Total:</strong> ₹{order.product?.price * order.quantity}</p>
                  <p className="mb-0 text-muted small"><i className="bi bi-geo-alt"></i> {order.address}</p>
                </div>
              </div>
            ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
