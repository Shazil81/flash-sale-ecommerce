import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { getAuthToken, getAuthUsername, setAuthSession, clearThisTabAuth } from '../utils/auth';

function Login({ portal = 'USER' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Check if someone is already logged in in THIS tab
  useEffect(() => {
    const token = getAuthToken();
    const storedUsername = getAuthUsername();
    if (token && storedUsername) {
      api.get('/me/')
        .then(res => {
          const userRole = res.data.profile?.role || res.data.role || 'USER';
          if (userRole === portal) {
            // Already authenticated in this portal in this tab -> go directly to dashboard
            if (portal === 'ADMIN') navigate('/admin-dashboard');
            else if (portal === 'DELIVERY') navigate('/delivery-dashboard');
            else navigate('/');
          } else {
            // Visiting a DIFFERENT portal's login page in this tab -> clear only this tab
            clearThisTabAuth();
          }
        })
        .catch(() => {
          clearThisTabAuth();
        });
    }
  }, [portal, navigate]);

  const getPortalDetails = () => {
    switch (portal) {
      case 'ADMIN':
        return {
          title: 'Admin Secure Login',
          subtitle: 'Restricted area for store administrators',
          gradient: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          textColor: '#ffffff',
          icon: 'bi-shield-lock-fill',
          btnClass: 'btn-dark'
        };
      case 'DELIVERY':
        return {
          title: 'Delivery Partner Portal',
          subtitle: 'Orders, route delivery and earnings',
          gradient: 'linear-gradient(135deg, #ff9f00 0%, #f76707 100%)',
          textColor: '#212529',
          icon: 'bi-truck',
          btnClass: 'btn-warning text-dark'
        };
      default:
        return {
          title: 'Customer Login',
          subtitle: 'Access your account, orders and wishlist',
          gradient: 'linear-gradient(135deg, #2874f0 0%, #1257c9 100%)',
          textColor: '#ffffff',
          icon: 'bi-person-circle',
          btnClass: 'btn-primary-custom'
        };
    }
  };

  const portalInfo = getPortalDetails();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await api.post('/login/', { username, password });
      const { access, refresh } = response.data;

      // Temporarily set token in this tab to fetch profile
      setAuthSession(access, refresh, username, portal);

      const profileRes = await api.get('/me/');
      const userRole = profileRes.data.profile?.role || 'USER';
      const kycStatus = profileRes.data.profile?.kyc_status || 'NONE';

      if (portal !== userRole) {
        clearThisTabAuth();
        setError(`Access Denied: This account is not authorized for the ${portal} portal.`);
        setIsLoading(false);
        return;
      }

      // Block rejected delivery partners
      if (portal === 'DELIVERY' && kycStatus === 'REJECTED') {
        clearThisTabAuth();
        setError('🚫 Access Denied: Your delivery partner application / KYC was REJECTED by the Administrator. Please contact support.');
        setIsLoading(false);
        return;
      }

      // Successfully set tab-isolated session!
      setAuthSession(access, refresh, username, userRole);

      if (userRole === 'ADMIN') navigate('/admin-dashboard');
      else if (userRole === 'DELIVERY') navigate('/delivery-dashboard');
      else navigate('/');

    } catch {
      clearThisTabAuth();
      setError('Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePortalSwitch = (path) => {
    // Clear only this tab's session
    clearThisTabAuth();
    navigate(path);
  };

  return (
    <div className="container mt-5 mb-5" style={{ maxWidth: '460px' }}>
      <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
        <div
          className="card-header border-0 text-center py-4 px-3"
          style={{
            background: portalInfo.gradient,
            color: portalInfo.textColor,
            borderBottom: 'none'
          }}
        >
          <div
            className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 shadow-sm"
            style={{
              width: '74px',
              height: '74px',
              backgroundColor: portalInfo.textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.12)',
              border: `2px solid ${portalInfo.textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.25)'}`
            }}
          >
            <i className={`bi ${portalInfo.icon}`} style={{ fontSize: '2.6rem', color: portalInfo.textColor }}></i>
          </div>
          <h3 className="mb-1 fw-bold" style={{ color: portalInfo.textColor }}>{portalInfo.title}</h3>
          <p className="mb-0 small" style={{ opacity: 0.9, color: portalInfo.textColor }}>{portalInfo.subtitle}</p>
        </div>

        <div className="card-body p-4 p-md-5 bg-white">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-bold text-muted small text-uppercase">Username</label>
              <input
                type="text"
                className="form-control form-control-lg bg-light"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-bold text-muted small text-uppercase">Password</label>
              <div className="input-group">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control form-control-lg bg-light"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary bg-light"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`btn btn-lg w-100 rounded-pill fw-bold shadow-sm ${portalInfo.btnClass}`}
            >
              {isLoading ? 'Signing In...' : 'Login Securely'}
            </button>
          </form>

          {portal !== 'ADMIN' && (
            <p className="text-center mt-4 mb-0 text-muted">
              New {portal === 'DELIVERY' ? 'Partner' : 'Customer'}?{' '}
              <Link to="/register" className="fw-bold text-primary-custom text-decoration-none">
                Register here
              </Link>
            </p>
          )}

          {/* Quick links to alternate portals */}
          <div className="mt-4 pt-3 border-top text-center">
            <small className="text-muted d-block mb-2">Looking for a different portal?</small>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              {portal !== 'USER' && (
                <button
                  type="button"
                  onClick={() => handlePortalSwitch('/login')}
                  className="btn btn-sm btn-outline-primary rounded-pill px-3"
                >
                  Customer Login
                </button>
              )}
              {portal !== 'DELIVERY' && (
                <button
                  type="button"
                  onClick={() => handlePortalSwitch('/delivery-login')}
                  className="btn btn-sm btn-outline-warning text-dark rounded-pill px-3"
                >
                  Delivery Portal
                </button>
              )}
              {portal !== 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => handlePortalSwitch('/admin-login')}
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                >
                  Admin Portal
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Login;
