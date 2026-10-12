import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { getAuthToken } from '../utils/auth';

function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState('');
  const [pageState, setPageState] = useState({ key: '', page: 1 });
  const [selectedCategory, setSelectedCategory] = useState('All');

  const productsPerPage = 8;
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;
    api.get('/products/').then(({ data }) => { if (active) { setProducts(data); setLoading(false); } }).catch(() => { if (active) { setLoadError(true); setLoading(false); } });
      return () => { active = false; };
  }, []);

  const dispatchCartEvent = () => {
    window.dispatchEvent(new Event('cartUpdated'));
  };

  const handleAddToCart = async (productId) => {
    const token = getAuthToken();
    if (!token) {
      setMessage('Please login first to add to cart.');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    try {
      await api.post('/cart/add/', { product_id: productId, quantity: 1 });
      setMessage("Added to Cart successfully!");
      dispatchCartEvent();
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage("Something went wrong!");
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleBuy = async (productId) => {
    const token = getAuthToken();
    if (!token) {
      setMessage('Please login first to buy products.');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    try {
      await api.post('/cart/add/', { product_id: productId, quantity: 1 });
      dispatchCartEvent();
      navigate('/cart');
    } catch {
      setMessage("Failed to process Buy Now!");
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Filter Logic
  const params = new URLSearchParams(location.search);
  const searchQuery = (params.get('search') || '').toLowerCase();

  let filteredProducts = products;

  if (searchQuery) {
    filteredProducts = filteredProducts.filter(p =>
      p.name.toLowerCase().includes(searchQuery) ||
      p.description.toLowerCase().includes(searchQuery)
    );
  }

  if (selectedCategory !== 'All') {
    filteredProducts = filteredProducts.filter(p => p.category_name === selectedCategory);
  }

  // Categories Extraction
  const categories = ['All', ...new Set(products.map(p => p.category_name).filter(Boolean))];

  // Pagination Logic
  const filterKey = `${searchQuery}:${selectedCategory}`;
  const currentPage = pageState.key === filterKey ? pageState.page : 1;
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const paginate = (pageNumber) => setPageState({ key: filterKey, page: pageNumber });

  if (loading) return <div className="container py-5" role="status">Loading products…</div>;
  if (loadError) return <div className="container py-5" role="alert">Unable to load products. <button className="btn btn-outline-primary" onClick={() => window.location.reload()}>Try again</button></div>;

  return (
    <div className="container pb-5">

      {message && (
        <div className="alert alert-dark text-center position-fixed start-50 translate-middle-x shadow-lg" role="alert" style={{top: '20px', zIndex: 1050, minWidth: '300px', borderRadius: '8px'}}>
          {message}
        </div>
      )}

      {!searchQuery && (
        <div className="alert flash-banner text-center fw-bold fs-4 mb-4 shadow-sm" role="alert">
          ⚡ MEGA FLASH SALE IS LIVE! Explore today's products! ⚡
        </div>
      )}

      {/* Categories Section */}
      <div className="mb-5 overflow-auto pb-2">
        <h5 className="mb-3 fw-bold" style={{ color: 'var(--text-dark)' }}>Explore Categories</h5>
        <div className="d-flex gap-3">
          {categories.map((cat, idx) => (
            <button type="button"
              key={idx}
              onClick={() => setSelectedCategory(cat)}
              className={`badge rounded-pill px-4 py-2 category-pill fs-6 ${selectedCategory === cat ? 'active' : 'text-dark bg-white border'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {searchQuery && <h5 className="mb-4">Search results for: "{searchQuery}"</h5>}

      <div className="row">
        {currentProducts.length === 0 ? (
          <div className="col-12 text-center py-5 text-muted">
            <h5>No products found.</h5>
          </div>
        ) : (
          currentProducts.map((item) => {

            return (
              <div className="col-md-3 mb-4" key={item.id}>
                <div className="card h-100 border-0 product-card">
                  <div className="position-absolute top-0 end-0 bg-danger text-white px-3 py-1 m-2 rounded-pill shadow-sm" style={{fontSize: '0.85rem', zIndex: 1, fontWeight: '600'}}>
                    Featured
                  </div>
                  <div className="card-img-wrapper">
                    <img src={item.image_url || 'https://via.placeholder.com/150'} className="img-fluid" alt={item.name} />
                  </div>
                  <div className="card-body d-flex flex-column justify-content-between">
                    <div>
                      <h6 className="card-title text-truncate fw-bold mb-1" style={{ color: 'var(--text-dark)' }} title={item.name}>{item.name}</h6>
                      <p className="card-text text-muted small text-truncate mb-2" title={item.description}>{item.description}</p>
                      <div className="d-flex align-items-center gap-2 mb-2 mt-3">
                        <h5 className="text-danger fw-bold mb-0">₹ {item.price}</h5>
                      </div>
                      <p className={item.stock > 0 ? "text-success fw-bold small mb-3" : "text-danger fw-bold small mb-3"}>
                        {item.stock > 0 ? `In Stock: ${item.stock}` : "Sold Out"}
                      </p>
                    </div>
                    <div className="d-flex justify-content-between gap-2 mt-auto pt-3 border-top">
                      <button className="btn btn-outline-dark btn-sm w-50 fw-bold rounded-pill" onClick={() => handleAddToCart(item.id)} disabled={item.stock <= 0}>
                        <i className="bi bi-cart-plus me-1"></i> Cart
                      </button>
                      <button className="btn btn-primary-custom btn-sm w-50 fw-bold rounded-pill" onClick={() => handleBuy(item.id)} disabled={item.stock <= 0}>
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Page navigation" className="mt-5">
          <ul className="pagination justify-content-center">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button className="page-link shadow-sm" onClick={() => paginate(currentPage - 1)}>Previous</button>
            </li>
            {[...Array(totalPages)].map((_, index) => (
              <li key={index + 1} className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}>
                <button className="page-link shadow-sm" onClick={() => paginate(index + 1)}>{index + 1}</button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button className="page-link shadow-sm" onClick={() => paginate(currentPage + 1)}>Next</button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}

export default Home;
