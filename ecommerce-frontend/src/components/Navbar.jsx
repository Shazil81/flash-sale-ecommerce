import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { getAuthUsername, clearThisTabAuth } from '../utils/auth';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = getAuthUsername();

  const [cartCount, setCartCount] = useState(0);
  const [searchState, setSearchState] = useState({ route: location.search, value: new URLSearchParams(location.search).get('search') || '' });
  const searchQuery = searchState.route === location.search ? searchState.value : new URLSearchParams(location.search).get('search') || '';
  const setSearchQuery = (value) => setSearchState({ route: location.search, value });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [userRole, setUserRole] = useState(null);

  // Sync user and role whenever location changes in THIS tab (per-tab isolated)
  useEffect(() => {
    const u = getAuthUsername();
    if (u) {
      api.get('/me/')
        .then(res => setUserRole(res.data.profile?.role || res.data.role))
        .catch(() => setUserRole(null));
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCartCount = useCallback(async () => {
    if (!username || userRole === 'ADMIN' || userRole === 'DELIVERY') return;
    try {
      const response = await api.get('/cart/');
      const items = response.data.items || [];
      const count = items.reduce((acc, item) => acc + item.quantity, 0);
      setCartCount(count);
    } catch (error) {
      console.error("Failed to fetch cart count", error);
    }
  }, [username, userRole]);

  useEffect(() => {
    if (username && userRole === 'USER') {
      api.get('/cart/').then(({ data }) => setCartCount((data.items || []).reduce((n, i) => n + i.quantity, 0))).catch(console.error);
    }
    window.addEventListener('cartUpdated', fetchCartCount);
    return () => window.removeEventListener('cartUpdated', fetchCartCount);
  }, [fetchCartCount, username, userRole]);

  const handleLogout = () => {
    // Log out ONLY this tab so other tabs (Admin, Customer, Delivery) stay fully logged in!
    clearThisTabAuth();
    setUserRole(null);
    navigate('/login');
    window.location.reload();
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        try {
          const res = await api.get(`/products/?search=${encodeURIComponent(searchQuery.trim())}`);
          setSuggestions(res.data.slice(0, 5));
          setShowSuggestions(true);
        } catch (err) {
          console.error(err);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/');
    }
  };

  return (
    <nav className="navbar navbar-expand-lg custom-navbar px-4 mb-4 shadow-sm sticky-top">
      <Link className="navbar-brand fw-bold text-white fs-4 d-flex align-items-center gap-2" to="/" style={{ textDecoration: 'none' }}>
        <span style={{ fontSize: '1.6rem' }}>🛒</span>
        <span className="text-white fw-bold" style={{ letterSpacing: '0.5px' }}>Flash<span style={{ color: '#ffe500' }}>Sale</span></span>
      </Link>

      <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent">
        <span className="navbar-toggler-icon"></span>
      </button>

      <div className="collapse navbar-collapse" id="navbarContent">
        {/* Search Bar in center */}
        <form className="d-flex mx-auto w-50 my-2 my-lg-0 position-relative" onSubmit={handleSearch}>
          <div className="input-group shadow-sm rounded-pill overflow-hidden" style={{ backgroundColor: 'white' }}>
            <span className="input-group-text bg-white border-0 ps-4 pe-2" style={{ cursor: 'pointer' }} onClick={handleSearch}>
              <i className="bi bi-search text-muted"></i>
            </span>
            <input
              className="form-control border-0 shadow-none search-input pe-4"
              type="search"
              placeholder="Search for products, brands and more..."
              aria-label="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              style={{ backgroundColor: 'white' }}
            />
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="position-absolute bg-white shadow-sm rounded-4 mt-2 w-100 overflow-hidden" style={{ top: '100%', zIndex: 1000, border: '1px solid #eee' }}>
              <ul className="list-unstyled mb-0">
                {suggestions.map(item => (
                  <li key={item.id}>
                    <Link
                      to={`/?search=${encodeURIComponent(item.name)}`}
                      className="text-decoration-none text-dark d-block p-3 border-bottom search-suggestion-item px-4"
                      onClick={() => {
                        setSearchQuery(item.name);
                        setShowSuggestions(false);
                      }}
                    >
                      <i className="bi bi-search text-muted me-3"></i> {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <div className="d-flex align-items-center ms-auto">
          {username ? (
            <>
              <div className="dropdown me-3 position-relative" ref={dropdownRef}>
                <button
                  className="btn btn-light border-0 fw-bold dropdown-toggle"
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  Hi, {username}
                </button>
                {isDropdownOpen && (
                  <ul className="dropdown-menu dropdown-menu-end shadow border-0 show" style={{ position: 'absolute', right: 0, top: '100%' }}>
                    {userRole === 'ADMIN' && (
                      <li>
                        <Link className="dropdown-item" to="/admin-dashboard" onClick={() => setIsDropdownOpen(false)}>
                          🛠️ Admin Dashboard
                        </Link>
                      </li>
                    )}
                    {userRole === 'DELIVERY' && (
                      <li>
                        <Link className="dropdown-item" to="/delivery-dashboard" onClick={() => setIsDropdownOpen(false)}>
                          🚚 Delivery Dashboard
                        </Link>
                      </li>
                    )}
                    {userRole !== 'ADMIN' && userRole !== 'DELIVERY' && (
                      <li>
                        <Link className="dropdown-item" to="/profile" onClick={() => setIsDropdownOpen(false)}>
                          👤 My Profile
                        </Link>
                      </li>
                    )}
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button className="dropdown-item text-danger" onClick={() => { setIsDropdownOpen(false); handleLogout(); }}>
                        Logout
                      </button>
                    </li>
                  </ul>
                )}
              </div>
              {userRole !== 'ADMIN' && userRole !== 'DELIVERY' && (
                <Link to="/cart" className="btn btn-warning position-relative rounded-pill px-4 shadow-sm fw-bold">
                  <i className="bi bi-cart-fill"></i> Cart
                  {cartCount > 0 && (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                      {cartCount}
                    </span>
                  )}
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-login-nav shadow-sm">Login</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
