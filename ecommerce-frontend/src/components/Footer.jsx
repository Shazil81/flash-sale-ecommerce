
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getAuthToken, getAuthUsername, clearThisTabAuth } from '../utils/auth';

function Footer() {
  const navigate = useNavigate();

  const handlePortalNavigation = async (targetPath, targetRole) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const token = getAuthToken();
    const storedUsername = getAuthUsername();

    if (!token || !storedUsername) {
      navigate(targetPath);
      return;
    }

    try {
      const res = await api.get('/me/');
      const currentRole = res.data.profile?.role || res.data.role;

      if (currentRole === targetRole) {
        // Already logged in as this role in THIS tab -> go straight to dashboard
        if (targetRole === 'ADMIN') navigate('/admin-dashboard');
        else if (targetRole === 'DELIVERY') navigate('/delivery-dashboard');
        else navigate('/');
      } else {
        // In THIS tab only, switch portal cleanly without logging out other open tabs
        clearThisTabAuth();
        navigate(targetPath);
      }
    } catch {
      clearThisTabAuth();
      navigate(targetPath);
    }
  };

  return (
    <footer
      className="bg-dark text-light py-5 mt-auto"
      style={{ position: 'relative', zIndex: 100, pointerEvents: 'auto' }}
    >
      <div className="container">
        <div className="row text-center text-md-start align-items-center">
          <div className="col-md-6 mb-4 mb-md-0">
            <h5 className="fw-bold text-white mb-2 d-flex align-items-center justify-content-center justify-content-md-start gap-2">
              <span className="fs-4">🛒</span> Flash Sale Store
            </h5>
            <p className="text-muted mb-0 small">
              Your favorite one-stop destination for genuine products and unbeatable deals.<br/>
              © 2026 Flash Sale Inc. All rights reserved.
            </p>
          </div>

          <div className="col-md-6 text-md-end">
            <h6
              className="text-white mb-3 text-uppercase fw-bold"
              style={{ letterSpacing: '1px', fontSize: '0.8rem' }}
            >
              Partner & Staff Portals
            </h6>
            <div className="d-flex flex-column flex-sm-row justify-content-center justify-content-md-end gap-2">
              <button
                type="button"
                onClick={() => handlePortalNavigation('/delivery-login', 'DELIVERY')}
                className="btn footer-portal-link border-0 text-start"
              >
                <i className="bi bi-truck text-warning fs-6"></i>
                <span>Delivery Partner Hub</span>
              </button>
              <button
                type="button"
                onClick={() => handlePortalNavigation('/admin-login', 'ADMIN')}
                className="btn footer-portal-link border-0 text-start"
              >
                <i className="bi bi-shield-lock text-info fs-6"></i>
                <span>Admin Portal</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
